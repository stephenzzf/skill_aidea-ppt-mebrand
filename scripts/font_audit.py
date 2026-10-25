#!/usr/bin/env python3
"""Audit requested PPTX fonts against Fontconfig and the rendered PDF."""
from __future__ import annotations

import argparse
import json
import posixpath
import re
import subprocess
import sys
import unicodedata
import zipfile
from collections import defaultdict
from posixpath import normpath
from pathlib import Path, PurePosixPath
from xml.etree import ElementTree as ET

NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}
FONT_TAGS = {"latin", "ea", "cs"}
STYLE_SUFFIXES = (
    "bolditalic", "semibolditalic", "mediumitalic", "lightitalic", "boldoblique",
    "boldmt", "italicmt", "bold", "semibold", "demibold", "medium", "regular",
    "italic", "oblique", "light", "book", "thin", "heavy", "black", "mt",
)


def comparison_key(value: str) -> str:
    """Normalize names while retaining Unicode letters (including CJK)."""
    normalized = unicodedata.normalize("NFKC", value).casefold()
    return "".join(char for char in normalized if char.isalnum())


def names_from_font_file(font_file: str) -> list[str]:
    if not font_file:
        return []
    try:
        proc = subprocess.run(
            ["fc-scan", "--format", "%{family}\n%{fullname}\n%{postscriptname}\n", font_file],
            check=False,
            capture_output=True,
            text=True,
            timeout=10,
        )
        if proc.returncode != 0:
            return []
        return [part.strip() for line in proc.stdout.splitlines() for part in line.split(",") if part.strip()]
    except (OSError, subprocess.TimeoutExpired):
        return []


def fontconfig_match(requested: str) -> dict:
    try:
        def match(pattern: str):
            return subprocess.run(
                ["fc-match", "--format", "%{family}|%{file}", pattern],
                check=False,
                capture_output=True,
                text=True,
                timeout=10,
            )

        proc = match(requested)
        family, _, font_file = proc.stdout.strip().partition("|")
        available = proc.returncode == 0 and bool(font_file) and Path(font_file).is_file()
        aliases = names_from_font_file(font_file) if available else []
        # Fontconfig may return a fallback for any unknown family. A match is
        # exact only when the requested Unicode name occurs in that file's
        # family, full name, or PostScript metadata.
        key = comparison_key(requested)
        exact = bool(key) and any(comparison_key(alias) == key for alias in aliases)
        if not exact:
            # Fontconfig treats "Family Regular" as a family query on some
            # platforms and may return an unrelated fallback. Retry a known
            # face-style suffix as an explicit Fontconfig style request.
            normalized = unicodedata.normalize("NFKC", requested).strip()
            for style in sorted(STYLE_SUFFIXES, key=len, reverse=True):
                suffix = re.search(rf"\s+{re.escape(style)}$", normalized, flags=re.IGNORECASE)
                if suffix is None:
                    continue
                family_request, style_request = normalized[:suffix.start()].strip(), normalized[suffix.start():].strip()
                if not family_request:
                    continue
                styled_proc = match(f"{family_request}:style={style_request}")
                styled_family, _, styled_file = styled_proc.stdout.strip().partition("|")
                styled_available = styled_proc.returncode == 0 and bool(styled_file) and Path(styled_file).is_file()
                styled_aliases = names_from_font_file(styled_file) if styled_available else []
                if any(comparison_key(alias) == key for alias in styled_aliases):
                    proc, family, font_file, available, aliases, exact = (
                        styled_proc, styled_family, styled_file, styled_available, styled_aliases, True,
                    )
                    break
        return {
            "resolved_family": family or None,
            "font_file": font_file or None,
            "available": bool(available),
            "metadata_names": aliases,
            "exact_match": exact,
            "error": proc.stderr.strip() or None,
        }
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {
            "resolved_family": None,
            "font_file": None,
            "available": False,
            "metadata_names": [],
            "exact_match": False,
            "error": str(exc),
        }


def _font_names_from_props(props: ET.Element | None) -> list[str]:
    if props is None:
        return []
    names = []
    for child in props:
        if child.tag.rsplit("}", 1)[-1] in FONT_TAGS:
            name = child.attrib.get("typeface", "").strip()
            if name and not name.startswith("+"):
                names.append(name)
    return names


def _font_scripts_for_text(text: str) -> set[str]:
    cjk = any((0x3400 <= ord(char) <= 0x4DBF) or (0x4E00 <= ord(char) <= 0x9FFF)
              or (0xF900 <= ord(char) <= 0xFAFF) or (0x3040 <= ord(char) <= 0x30FF)
              or (0xAC00 <= ord(char) <= 0xD7AF) for char in text)
    complex_script = any(0x0590 <= ord(char) <= 0x08FF for char in text)
    has_latin = any(char.isalpha() and not ((0x3400 <= ord(char) <= 0x4DBF) or
                    (0x4E00 <= ord(char) <= 0x9FFF) or (0xF900 <= ord(char) <= 0xFAFF) or
                    (0x3040 <= ord(char) <= 0x30FF) or (0xAC00 <= ord(char) <= 0xD7AF) or
                    (0x0590 <= ord(char) <= 0x08FF)) for char in text) or any(char.isdigit() for char in text)
    wanted = set()
    if cjk:
        wanted.add("ea")
    if has_latin:
        wanted.add("latin")
    if complex_script:
        wanted.add("cs")
    if not wanted:
        wanted.add("latin")
    return wanted


def _font_bindings_for_text(props: ET.Element | None, text: str) -> list[tuple[str, str]]:
    if props is None:
        return []
    specs = []
    for child in props:
        tag = child.tag.rsplit("}", 1)[-1]
        name = child.attrib.get("typeface", "").strip()
        if tag in FONT_TAGS and name and not name.startswith("+"):
            specs.append((tag, name))
    if not specs:
        return []
    wanted = _font_scripts_for_text(text)
    chosen = [(tag, name) for tag, name in specs if tag in wanted]
    # Preserve the existing family discovery behavior when only an unrelated
    # script face was explicitly declared. The "all" scope is conservative:
    # it requires a PDF match for the full visible run instead of guessing a
    # script assignment from an absent font declaration.
    return list(dict.fromkeys(chosen or [("all", name) for _, name in specs]))


def _font_names_for_text(props: ET.Element | None, text: str) -> list[str]:
    return list(dict.fromkeys(name for _, name in _font_bindings_for_text(props, text)))


def _font_bindings_from_run(run: ET.Element, paragraph: ET.Element | None = None,
                            shape: ET.Element | None = None, layout_shape: ET.Element | None = None,
                            master_root: ET.Element | None = None,
                            theme_names: list[str] | None = None) -> list[tuple[str, str]]:
    props = run.find("a:rPr", NS)
    if props is None:
        props = run.find("a:defRPr", NS)
    text_node = run.find("a:t", NS)
    text = text_node.text or "" if text_node is not None else ""
    bindings = _font_bindings_for_text(props, text)
    if bindings or paragraph is None:
        return bindings
    # Resolve the font hierarchy in order: paragraph/run defaults, local text
    # body level style, matching layout placeholder, master placeholder/text
    # style, then theme. This prevents empty direct rPr from hiding the actual
    # inherited face used by visible slide text.
    ppr = paragraph.find("a:pPr", NS)
    if ppr is not None:
        bindings = _font_bindings_for_text(ppr.find("a:defRPr", NS), text)
        if bindings:
            return bindings
    level = 1
    if ppr is not None and ppr.get("lvl", "").isdigit():
        level = max(1, min(9, int(ppr.get("lvl")) + 1))
    if shape is not None:
        tx_body = shape.find("p:txBody", NS)
        level_props = tx_body.find(f"a:lstStyle/a:lvl{level}pPr/a:defRPr", NS) if tx_body is not None else None
        bindings = _font_bindings_for_text(level_props, text)
        if bindings:
            return bindings
    if layout_shape is not None:
        layout_body = layout_shape.find("p:txBody", NS)
        layout_level = layout_body.find(f"a:lstStyle/a:lvl{level}pPr/a:defRPr", NS) if layout_body is not None else None
        bindings = _font_bindings_for_text(layout_level, text)
        if bindings:
            return bindings
        for layout_paragraph in layout_shape.findall("./p:txBody/a:p", NS):
            layout_ppr = layout_paragraph.find("a:pPr", NS)
            bindings = _font_bindings_for_text(layout_ppr.find("a:defRPr", NS) if layout_ppr is not None else None, text)
            if not bindings:
                for layout_run in layout_paragraph.findall("a:r", NS) + layout_paragraph.findall("a:fld", NS):
                    bindings.extend(_font_bindings_from_run(layout_run))
            if bindings:
                return list(dict.fromkeys(bindings))
        if master_root is not None:
            bindings = _placeholder_style_bindings(master_root, layout_shape, level, text)
            if bindings:
                return bindings
    if master_root is not None:
        bindings = _placeholder_style_bindings(master_root, shape, level, text)
        if bindings:
            return bindings
    return [("all", name) for name in (theme_names or [])]


def _font_names_from_run(run: ET.Element, paragraph: ET.Element | None = None,
                         shape: ET.Element | None = None, layout_shape: ET.Element | None = None,
                         master_root: ET.Element | None = None, theme_names: list[str] | None = None) -> list[str]:
    return list(dict.fromkeys(name for _, name in _font_bindings_from_run(
        run, paragraph, shape, layout_shape, master_root, theme_names
    )))


def _placeholder_key(shape: ET.Element | None) -> tuple[str, str] | None:
    if shape is None:
        return None
    ph = shape.find("./p:nvSpPr/p:nvPr/p:ph", NS)
    if ph is None:
        return None
    return ph.get("type", "obj"), ph.get("idx", "0")


def _matching_placeholder(root: ET.Element | None, key: tuple[str, str] | None) -> ET.Element | None:
    if root is None or key is None:
        return None
    for shape in root.findall(".//p:sp", NS):
        if _placeholder_key(shape) == key:
            return shape
    return None


def _placeholder_style_bindings(master_root: ET.Element, shape: ET.Element | None, level: int,
                                text: str = "") -> list[tuple[str, str]]:
    key = _placeholder_key(shape)
    master_shape = _matching_placeholder(master_root, key)
    if master_shape is not None:
        master_body = master_shape.find("p:txBody", NS)
        master_level = master_body.find(f"a:lstStyle/a:lvl{level}pPr/a:defRPr", NS) if master_body is not None else None
        bindings = _font_bindings_for_text(master_level, text)
        if bindings:
            return bindings
    style_name = "otherStyle"
    if key and key[0] in {"title", "ctrTitle", "subTitle"}:
        style_name = "titleStyle"
    elif key and key[0] in {"body", "obj"}:
        style_name = "bodyStyle"
    style = master_root.find(f"./p:txStyles/a:{style_name}/a:lvl{level}pPr/a:defRPr", NS)
    if style is None:
        style = master_root.find(f"./p:txStyles/a:{style_name}/a:lvl1pPr/a:defRPr", NS)
    return _font_bindings_for_text(style, text)


def _placeholder_style_fonts(master_root: ET.Element, shape: ET.Element | None, level: int,
                              text: str = "") -> list[str]:
    return list(dict.fromkeys(name for _, name in _placeholder_style_bindings(master_root, shape, level, text)))


def _font_size_from_run(run: ET.Element, paragraph: ET.Element, shape: ET.Element | None,
                        layout_shape: ET.Element | None, master_root: ET.Element | None) -> str | None:
    for props in (run.find("a:rPr", NS), run.find("a:defRPr", NS)):
        if props is not None and props.get("sz"):
            return props.get("sz")
    ppr = paragraph.find("a:pPr", NS)
    props = ppr.find("a:defRPr", NS) if ppr is not None else None
    if props is not None and props.get("sz"):
        return props.get("sz")
    level = 1
    if ppr is not None and ppr.get("lvl", "").isdigit():
        level = max(1, min(9, int(ppr.get("lvl")) + 1))
    for owner in (shape, layout_shape):
        body = owner.find("p:txBody", NS) if owner is not None else None
        props = body.find(f"a:lstStyle/a:lvl{level}pPr/a:defRPr", NS) if body is not None else None
        if props is not None and props.get("sz"):
            return props.get("sz")
    if layout_shape is not None:
        for layout_paragraph in layout_shape.findall("./p:txBody/a:p", NS):
            layout_ppr = layout_paragraph.find("a:pPr", NS)
            props = layout_ppr.find("a:defRPr", NS) if layout_ppr is not None else None
            if props is not None and props.get("sz"):
                return props.get("sz")
    if master_root is not None:
        placeholder_shape = layout_shape if layout_shape is not None else shape
        master_shape = _matching_placeholder(master_root, _placeholder_key(placeholder_shape))
        body = master_shape.find("p:txBody", NS) if master_shape is not None else None
        props = body.find(f"a:lstStyle/a:lvl{level}pPr/a:defRPr", NS) if body is not None else None
        if props is not None and props.get("sz"):
            return props.get("sz")
        key = _placeholder_key(placeholder_shape)
        style_name = "titleStyle" if key and key[0] in {"title", "ctrTitle", "subTitle"} else "bodyStyle" if key and key[0] in {"body", "obj"} else "otherStyle"
        props = master_root.find(f"./p:txStyles/a:{style_name}/a:lvl{level}pPr/a:defRPr", NS)
        if props is None:
            props = master_root.find(f"./p:txStyles/a:{style_name}/a:lvl1pPr/a:defRPr", NS)
        if props is not None and props.get("sz"):
            return props.get("sz")
    return None


def _relationships(archive: zipfile.ZipFile, part: str, rel_type: str) -> list[str]:
    folder, basename = str(PurePosixPath(part).parent), PurePosixPath(part).name
    rel_part = posixpath.join(folder, "_rels", basename + ".rels")
    if rel_part not in archive.namelist():
        return []
    try:
        root = ET.fromstring(archive.read(rel_part))
    except ET.ParseError:
        return []
    targets = []
    for rel in root.findall("rel:Relationship", NS):
        if rel.attrib.get("Type", "").endswith("/" + rel_type):
            target = rel.attrib.get("Target", "")
            targets.append(normpath(target.lstrip("/")) if target.startswith("/") else normpath(posixpath.join(folder, target)))
    return targets


def _inherited_roots(archive: zipfile.ZipFile, slide_path: str, cache: dict[str, ET.Element]):
    layout_root = master_root = None
    layout_paths = _relationships(archive, slide_path, "slideLayout")
    if layout_paths and layout_paths[0] in archive.namelist():
        layout_path = layout_paths[0]
        layout_root = cache.get(layout_path)
        if layout_root is None:
            try:
                layout_root = ET.fromstring(archive.read(layout_path)); cache[layout_path] = layout_root
            except ET.ParseError:
                layout_root = None
        master_paths = _relationships(archive, layout_path, "slideMaster")
        if master_paths and master_paths[0] in archive.namelist():
            master_path = master_paths[0]
            master_root = cache.get(master_path)
            if master_root is None:
                try:
                    master_root = ET.fromstring(archive.read(master_path)); cache[master_path] = master_root
                except ET.ParseError:
                    master_root = None
    return layout_root, master_root


def _add_use(uses: dict[str, dict], per_slide: dict[int, set[str]], name: str, slide: int,
             text: str, font_size: str | None = None, script: str = "all") -> None:
    row = uses.setdefault(name, {"requested": name, "run_count": 0, "slides": set(), "runs": []})
    row["run_count"] += 1
    row["slides"].add(slide)
    row["runs"].append({"slide": slide, "text": text, "script": script,
                        "font_size_hundredths_pt": font_size})
    per_slide[slide].add(name)


def _theme_names(archive: zipfile.ZipFile) -> list[str]:
    for name in archive.namelist():
        if name.startswith("ppt/theme/theme") and name.endswith(".xml"):
            try:
                theme = ET.fromstring(archive.read(name))
            except ET.ParseError:
                continue
            names = []
            for selector in (".//a:fontScheme/a:minorFont/a:latin", ".//a:fontScheme/a:majorFont/a:latin"):
                node = theme.find(selector, NS)
                if node is not None and node.attrib.get("typeface"):
                    names.append(node.attrib["typeface"])
            return names
    return []


def _embedded_fonts(archive: zipfile.ZipFile) -> list[dict]:
    presentation_name = "ppt/presentation.xml"
    rels_name = "ppt/_rels/presentation.xml.rels"
    if presentation_name not in archive.namelist():
        return []
    try:
        presentation = ET.fromstring(archive.read(presentation_name))
        rels = ET.fromstring(archive.read(rels_name)) if rels_name in archive.namelist() else None
    except ET.ParseError:
        return []
    targets = {}
    if rels is not None:
        for rel in rels.findall("rel:Relationship", NS):
            if rel.attrib.get("Type", "").endswith("/font"):
                targets[rel.attrib.get("Id", "")] = rel.attrib.get("Target", "")
    rows = []
    for embedded in presentation.findall(".//p:embeddedFont", {"p": "http://schemas.openxmlformats.org/presentationml/2006/main"}):
        font = embedded.find("p:font", {"p": "http://schemas.openxmlformats.org/presentationml/2006/main"})
        if font is None:
            continue
        face = font.attrib.get("typeface", "").strip()
        parts = []
        for child in embedded:
            rid = child.attrib.get(f"{{{NS['r']}}}id")
            target = targets.get(rid, "")
            if not target:
                continue
            # Relationship targets are relative to ppt/presentation.xml,
            # unless the package explicitly marks them as absolute.
            part = normpath(target.lstrip("/")) if target.startswith("/") else normpath(str(PurePosixPath("ppt") / target))
            if part in archive.namelist():
                parts.append({"variant": child.tag.rsplit("}", 1)[-1], "part": part, "bytes": len(archive.read(part))})
            else:
                parts.append({"variant": child.tag.rsplit("}", 1)[-1], "part": part, "bytes": 0})
        rows.append({"typeface": face, "parts": parts, "all_parts_present": bool(parts) and all(item["bytes"] > 0 for item in parts)})
    return rows


def _pptx_font_usage(pptx_path: Path) -> tuple[dict[str, dict], dict[int, set[str]], list[dict], int]:
    uses: dict[str, dict] = {}
    per_slide: dict[int, set[str]] = defaultdict(set)
    slide_count = 0
    with zipfile.ZipFile(pptx_path) as archive:
        theme_names = _theme_names(archive)
        inherited_cache: dict[str, ET.Element] = {}
        slide_paths = sorted(
            (name for name in archive.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)),
            key=lambda value: int(re.search(r"slide(\d+)", value).group(1)),
        )
        for slide_path in slide_paths:
            slide_number = int(re.search(r"slide(\d+)", slide_path).group(1))
            slide_count = max(slide_count, slide_number)
            try:
                root = ET.fromstring(archive.read(slide_path))
            except ET.ParseError:
                continue
            layout_root, master_root = _inherited_roots(archive, slide_path, inherited_cache)
            parent = {child: node for node in root.iter() for child in node}
            for paragraph in root.findall(".//a:p", NS):
                shape = paragraph
                while shape is not None and shape.tag != f"{{{NS['p']}}}sp":
                    shape = parent.get(shape)
                layout_shape = _matching_placeholder(layout_root, _placeholder_key(shape))
                runs = paragraph.findall("a:r", NS) + paragraph.findall("a:fld", NS)
                for run in runs:
                    text_node = run.find("a:t", NS)
                    if text_node is None or not (text_node.text or "").strip():
                        continue
                    bindings = _font_bindings_from_run(run, paragraph, shape, layout_shape, master_root, theme_names)
                    font_size = _font_size_from_run(run, paragraph, shape, layout_shape, master_root)
                    for script, name in bindings:
                        _add_use(uses, per_slide, name, slide_number, text_node.text or "", font_size, script)

            # Include only literal static content inherited from layouts and
            # masters. Unreferenced layouts and authoring prompts never become
            # font requirements for the rendered slides.
            if layout_root is not None:
                for layout_shape in layout_root.findall(".//p:sp", NS):
                    ph = layout_shape.find("./p:nvSpPr/p:nvPr/p:ph", NS)
                    if ph is not None:
                        # Placeholder content is inherited from the slide only
                        # when supplied there; a layout prompt is edit-time UI.
                        continue
                    for paragraph in layout_shape.findall("./p:txBody/a:p", NS):
                        for run in paragraph.findall("a:r", NS) + paragraph.findall("a:fld", NS):
                            text_node = run.find("a:t", NS)
                            if text_node is None or not (text_node.text or "").strip():
                                continue
                            bindings = _font_bindings_from_run(run, paragraph, layout_shape, None, master_root, theme_names)
                            font_size = _font_size_from_run(run, paragraph, layout_shape, None, master_root)
                            for script, name in bindings:
                                _add_use(uses, per_slide, name, slide_number, text_node.text or "", font_size, script)
            if master_root is not None and root.attrib.get("showMasterSp") != "0":
                for master_shape in master_root.findall(".//p:sp", NS):
                    if _placeholder_key(master_shape) is not None:
                        continue
                    for paragraph in master_shape.findall("./p:txBody/a:p", NS):
                        for run in paragraph.findall("a:r", NS) + paragraph.findall("a:fld", NS):
                            text_node = run.find("a:t", NS)
                            if text_node is None or not (text_node.text or "").strip():
                                continue
                            bindings = _font_bindings_from_run(run, paragraph, master_shape, None, master_root, theme_names)
                            font_size = _font_size_from_run(run, paragraph, master_shape, None, master_root)
                            for script, name in bindings:
                                _add_use(uses, per_slide, name, slide_number, text_node.text or "", font_size, script)
        embedded = _embedded_fonts(archive)
    for row in uses.values():
        row["slides"] = sorted(row["slides"])
    return uses, per_slide, embedded, len(slide_paths)


def _pdf_fonts(pdf_path: Path | None) -> dict[int, dict]:
    if pdf_path is None:
        return {}
    try:
        import fitz  # type: ignore
    except ImportError as exc:
        raise RuntimeError("PyMuPDF is required to relate PPTX fonts to rendered PDF fonts") from exc
    doc = fitz.open(pdf_path)
    result: dict[int, dict] = {}
    for index, page in enumerate(doc, start=1):
        found = set()
        span_text = []
        font_spans = []
        for block in page.get_text("dict").get("blocks", []):
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    if span.get("text", "").strip() and span.get("font"):
                        found.add(span["font"])
                        span_text.append(span.get("text", ""))
                        font_spans.append({"font": span["font"], "text": span.get("text", "")})
        descriptors = []
        for item in page.get_fonts(full=True):
            xref, extension, font_type, basefont = item[:4]
            normalized_basefont = re.sub(r"^[A-Z]{6}\+", "", basefont)
            embedded = bool(extension and extension.casefold() not in {"n/a", "none"})
            data_bytes = 0
            if embedded and xref:
                try:
                    extracted = doc.extract_font(xref)
                    data_bytes = len(extracted[3]) if extracted and len(extracted) > 3 else 0
                except Exception:
                    data_bytes = 0
            descriptors.append({
                "basefont": basefont,
                "normalized_basefont": normalized_basefont,
                "extension": extension,
                "type": font_type,
                "embedded_in_pdf": embedded and data_bytes > 0,
                "embedded_bytes": data_bytes,
            })
        result[index] = {"span_fonts": found, "span_text": span_text, "font_spans": font_spans,
                         "page_text": "\n".join(span_text), "descriptors": descriptors}
    doc.close()
    return result


def _names_match(requested: str, names: list[str]) -> bool:
    key = comparison_key(requested)
    return bool(key) and any(comparison_key(name) == key for name in names if name)


def _metadata_alias_match(requested: str, actual_names: list[str], metadata_names: list[str]) -> bool:
    """Match a rendered face only when Fontconfig metadata proves its alias."""
    metadata_keys = {comparison_key(name) for name in metadata_names if comparison_key(name)}
    if not metadata_keys or not comparison_key(requested):
        return False
    actual_keys = {comparison_key(actual) for actual in actual_names if comparison_key(actual)}
    for actual in actual_keys:
        if actual in metadata_keys:
            return True
        if any(actual == alias + suffix for alias in metadata_keys for suffix in STYLE_SUFFIXES):
            return True
    return False


def _text_key(value: str) -> str:
    return "".join(char for char in unicodedata.normalize("NFKC", value).casefold() if char.isalnum())


def _font_text_segments_for_script(text: str, script: str) -> list[tuple[str, int, int]]:
    """Return script-specific normalized text and its offsets within the run key."""
    full_key = _text_key(text)
    if not full_key:
        return []
    if script == "all":
        return [(full_key, 0, len(full_key))]
    segments = []
    current = []
    start = None
    offset = 0
    for char in text:
        char_key = _text_key(char)
        if not char_key:
            continue
        if script in _font_scripts_for_text(char):
            if start is None:
                start = offset
            current.append(char_key)
        elif current:
            segments.append(("".join(current), start, offset))
            current, start = [], None
        offset += len(char_key)
    if current:
        segments.append(("".join(current), start, offset))
    return segments


def _run_is_rendered(text: str, page: dict) -> bool:
    if "page_text" not in page:
        # Older/adapted PDF evidence may report only font resources. Retain the
        # previous conservative behavior when text visibility cannot be read.
        return True
    key = _text_key(text)
    if not key:
        return False
    page_key = _text_key(page.get("page_text", ""))
    if len(key) >= 3:
        return key in page_key
    return any(_text_key(span) == key for span in page.get("span_text", []))


def _pdf_font_layout(page: dict) -> tuple[str, list[tuple[str, int, int]]] | None:
    """Return normalized page text and font span offsets, or None without spans."""
    if "font_spans" not in page:
        return None
    spans = []
    offset = 0
    for row in page.get("font_spans", []):
        span_key = _text_key(row.get("text", ""))
        if not span_key:
            continue
        spans.append((row.get("font", ""), offset, offset + len(span_key)))
        offset += len(span_key)
    page_key = "".join(_text_key(row.get("text", "")) for row in page.get("font_spans", []))
    return page_key, spans


def _pdf_text_occurrences(key: str, page_key: str, spans: list[tuple[str, int, int]]) -> list[tuple[int, int]]:
    if not key:
        return []
    starts = []
    if len(key) >= 3:
        cursor = 0
        while (found := page_key.find(key, cursor)) >= 0:
            starts.append(found)
            cursor = found + 1
    else:
        starts = [start for _font, start, end in spans if end - start == len(key) and page_key[start:end] == key]
    return [(start, start + len(key)) for start in starts]


def audit(pptx_path: Path, pdf_path: Path | None = None) -> dict:
    uses, per_slide, embedded, slide_count = _pptx_font_usage(pptx_path)
    rendered_by_slide = _pdf_fonts(pdf_path)
    ignored_unrendered_fonts = []
    rows = []
    for requested, usage in sorted(uses.items(), key=lambda item: item[0].casefold()):
        if pdf_path:
            visible_runs = [run for run in usage["runs"] if _run_is_rendered(run["text"], rendered_by_slide.get(run["slide"], {}))]
            if not visible_runs:
                ignored_unrendered_fonts.append({"requested": requested, "slides": sorted(usage["slides"]), "run_count": usage["run_count"]})
                continue
            visible_slides = sorted({run["slide"] for run in visible_runs})
        else:
            visible_runs = usage["runs"]
            visible_slides = sorted(usage["slides"])
        env = fontconfig_match(requested)
        embed_rows = [item for item in embedded if _names_match(requested, [item["typeface"]])]
        embedded_parts = [part for item in embed_rows for part in item["parts"] if part["bytes"] > 0]
        span_font_slides: dict[str, set[int]] = defaultdict(set)
        matched_run_fonts: dict[str, set[str]] = {}
        run_font_match_results = []
        unmatched_rendered_run_count = 0
        for run in visible_runs:
            page = rendered_by_slide.get(run["slide"], {})
            evidence_segments = _font_text_segments_for_script(run["text"], run.get("script", "all"))
            pdf_layout = _pdf_font_layout(page)
            if pdf_layout is None or not evidence_segments:
                # Without text-to-font span evidence, a page-level resource
                # cannot prove which face rendered this visible run.
                unmatched_rendered_run_count += 1
                run_font_match_results.append(False)
                continue
            page_key, span_ranges = pdf_layout
            run_occurrences = _pdf_text_occurrences(_text_key(run["text"]), page_key, span_ranges)
            if not run_occurrences:
                unmatched_rendered_run_count += 1
                run_font_match_results.append(False)
                continue
            run_fonts: set[str] = set()
            run_matches = True
            for run_start, run_end in run_occurrences:
                for _segment, relative_start, relative_end in evidence_segments:
                    segment_start, segment_end = run_start + relative_start, run_start + relative_end
                    if segment_start < run_start or segment_end > run_end:
                        run_matches = False
                        continue
                    segment_fonts = [font for font, span_start, span_end in span_ranges
                                     if font and span_start < segment_end and span_end > segment_start]
                    if not segment_fonts:
                        run_matches = False
                        continue
                    run_fonts.update(segment_fonts)
                    if not all(
                        _names_match(requested, [actual]) or
                        (env["exact_match"] and _metadata_alias_match(requested, [actual], env["metadata_names"]))
                        for actual in segment_fonts
                    ):
                        run_matches = False
            matched_run_fonts[run["text"]] = run_fonts
            run_font_match_results.append(run_matches)
            for actual in run_fonts:
                span_font_slides[actual].add(run["slide"])
        pdf_font_resources: dict[tuple[str, str, str], dict] = {}
        for slide in visible_slides:
            page_fonts = rendered_by_slide.get(slide, {})
            for name in page_fonts.get("span_fonts", set()):
                if name:
                    span_font_slides[name].add(slide)
            for font in page_fonts.get("descriptors", []):
                normalized = font["normalized_basefont"]
                if not normalized:
                    continue
                key = (normalized, font["extension"], font["type"])
                row = pdf_font_resources.setdefault(key, {
                    "normalized_basefont": normalized,
                    "extension": font["extension"],
                    "type": font["type"],
                    "embedded_in_pdf": False,
                    "embedded_resources": 0,
                    "largest_embedded_bytes": 0,
                    "slides": set(),
                })
                row["slides"].add(slide)
                if font["embedded_in_pdf"]:
                    row["embedded_in_pdf"] = True
                    row["embedded_resources"] += 1
                    row["largest_embedded_bytes"] = max(row["largest_embedded_bytes"], font["embedded_bytes"])

        span_fonts = sorted(span_font_slides)
        descriptor_fonts = sorted({key[0] for key in pdf_font_resources})
        pdf_names = sorted(set(span_fonts) | set(descriptor_fonts))
        # A PDF resource can be present without being used by the slide's text.
        # Require the requested face in a text span before declaring a render match.
        # A single source OOXML run may contain multiple scripts, so match
        # contiguous script-specific text segments separately. Every PDF span
        # overlapping each occurrence must use the corresponding face; a
        # matching face in another segment or repeated occurrence cannot mask fallback.
        span_face_match = bool(run_font_match_results) and all(run_font_match_results)
        embedded_pdf_fonts = [
            {
                **row,
                "slides": sorted(row["slides"]),
            }
            for row in pdf_font_resources.values()
            if row["embedded_in_pdf"]
        ]
        embedded_resource_names = [font["normalized_basefont"] for font in embedded_pdf_fonts]
        embedded_pdf_match = bool(embed_rows and span_face_match) and (
            _names_match(requested, embedded_resource_names)
            or (
                env["exact_match"]
                and _metadata_alias_match(requested, embedded_resource_names, env["metadata_names"])
            )
        )
        # A face match is sufficient when the host resolved the family from
        # installed font metadata. If relying on an embedded PPTX font, require
        # the rendered PDF to contain an extractable font stream with that face.
        pdf_match = bool(span_face_match and (env["exact_match"] or embedded_pdf_match))
        rows.append({
            "requested": requested,
            "run_count": len(visible_runs),
            "source_run_count": usage["run_count"],
            "slides": visible_slides,
            "font_sizes_hundredths_pt": sorted({int(run["font_size_hundredths_pt"]) for run in visible_runs if (run.get("font_size_hundredths_pt") or "").isdigit()}),
            "font_size_unknown_runs": sum(1 for run in visible_runs if not run.get("font_size_hundredths_pt")),
            "resolved_family": env["resolved_family"],
            "font_file": env["font_file"],
            "available": env["available"],
            "metadata_names": env["metadata_names"],
            "exact_match": env["exact_match"],
            "embedded_declared": bool(embed_rows),
            "embedded_parts": embedded_parts,
            "embedded_render_relationship": (
                "matching_embedded_pdf_font" if embedded_pdf_match
                else "family_name_not_confirmed_in_rendered_pdf" if embed_rows and pdf_path
                else "not_checked" if embed_rows
                else "not_embedded"
            ),
            "rendered_pdf_fonts": pdf_names,
            "unmatched_rendered_run_count": unmatched_rendered_run_count,
            "mismatched_rendered_run_count": sum(1 for matched in run_font_match_results if not matched),
            "embedded_pdf_fonts": embedded_pdf_fonts,
            "rendered_pdf_font_slides": {name: sorted(slides) for name, slides in sorted(span_font_slides.items())},
            "rendered_pdf_match": pdf_match if pdf_path else None,
            "environment_error": env["error"],
        })
    env_ok = all(item["available"] and item["exact_match"] for item in rows)
    pdf_ok = all(item["rendered_pdf_match"] for item in rows) if pdf_path else None
    # The PDF is authoritative for what the renderer actually used. An
    # embedded font may compensate for a missing system font only when the
    # requested face is also visible in that slide's PDF text spans.
    ok = bool(rows) and (pdf_ok if pdf_path else env_ok)
    return {
        "fonts": rows,
        "ignored_unrendered_fonts": ignored_unrendered_fonts,
        "embedded_fonts": embedded,
        "pdf_path": str(pdf_path) if pdf_path else None,
        "environment_ok": env_ok,
        "rendered_pdf_ok": pdf_ok,
        "ok": ok,
        "slide_count": slide_count,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("pptx", type=Path)
    parser.add_argument("--pdf", type=Path)
    args = parser.parse_args()
    if not args.pptx.is_file():
        parser.error(f"PPTX does not exist: {args.pptx}")
    if args.pdf is not None and not args.pdf.is_file():
        parser.error(f"PDF does not exist: {args.pdf}")
    try:
        result = audit(args.pptx, args.pdf)
    except Exception as exc:  # emit machine-readable failure for the caller
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False))
        return 1
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
