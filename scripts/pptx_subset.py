#!/usr/bin/env python3
"""Create source-preserving slide subsets from OOXML PowerPoint packages."""

from __future__ import annotations

import copy
import hashlib
import json
import os
import posixpath
import re
import shutil
import tempfile
import zipfile
from collections import deque
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlsplit

from lxml import etree

NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main"
NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
NS_CT = "http://schemas.openxmlformats.org/package/2006/content-types"
R_ID = f"{{{NS_R}}}id"
ROOT_RELS = "_rels/.rels"
CONTENT_TYPES = "[Content_Types].xml"
EXTENDED_PROPERTIES_REL = "/extended-properties"
THUMBNAIL_REL = "/thumbnail"
APP_STAT_PROPERTIES = {
    "Pages", "Words", "Paragraphs", "Characters", "CharactersWithSpaces", "Lines",
    "MMClips", "HeadingPairs", "TitlesOfParts",
}
APP_PROPERTY_ORDER = (
    "Application", "PresentationFormat", "Template", "Company", "Manager", "Pages",
    "Words", "Characters", "DocSecurity", "Lines", "Paragraphs", "Slides", "Notes",
    "TotalTime", "HiddenSlides", "MMClips", "ScaleCrop", "HeadingPairs", "TitlesOfParts",
    "LinksUpToDate", "CharactersWithSpaces", "SharedDoc", "HyperlinkBase", "HLinks",
    "HyperlinksChanged", "DigSig", "AppVersion",
)


class SubsetError(ValueError):
    """A stable, CLI-recognizable error raised while building a subset."""

    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(f"{code}: {message}")


def _safe_parser() -> etree.XMLParser:
    return etree.XMLParser(resolve_entities=False, no_network=True, remove_blank_text=False, huge_tree=False)


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _serialize_xml(root: etree._Element, original: bytes) -> bytes:
    declaration = original.lstrip().startswith(b"<?xml")
    head = original.lstrip().split(b"?>", 1)[0] if declaration else b""
    standalone = None
    if b"standalone='yes'" in head or b'standalone="yes"' in head:
        standalone = True
    elif b"standalone='no'" in head or b'standalone="no"' in head:
        standalone = False
    return etree.tostring(root, encoding="UTF-8", xml_declaration=declaration, standalone=standalone)


def _parse_xml(data: bytes, part: str) -> etree._Element:
    try:
        root = etree.fromstring(data, parser=_safe_parser())
    except etree.XMLSyntaxError as exc:
        raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", f"Invalid XML in {part}: {exc}") from exc
    if root.getroottree().docinfo.doctype:
        raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", f"DTD declarations are not accepted in {part}")
    return root


def _hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while True:
            block = stream.read(1024 * 1024)
            if not block:
                break
            digest.update(block)
    return digest.hexdigest()


def _parse_selection(slides_string: str, slide_count: int) -> list[int]:
    if not isinstance(slides_string, str) or not slides_string.strip():
        raise SubsetError("PPTX_SUBSET_INVALID_SELECTION", "slides must be a non-empty list such as 1-20,22")

    selected: list[int] = []
    selected_set: set[int] = set()
    for raw_piece in slides_string.split(","):
        piece = raw_piece.strip()
        match = re.fullmatch(r"(\d+)\s*(?:-\s*(\d+))?", piece)
        if not match:
            raise SubsetError("PPTX_SUBSET_INVALID_SELECTION", f"Invalid page selector: {piece!r}")
        start = int(match.group(1))
        end = int(match.group(2) or match.group(1))
        if start < 1 or end < 1:
            raise SubsetError("PPTX_SUBSET_INVALID_SELECTION", "page numbers start at 1; zero is invalid")
        if start > end:
            raise SubsetError("PPTX_SUBSET_INVALID_SELECTION", f"descending range is invalid: {piece!r}")
        if end > slide_count:
            raise SubsetError(
                "PPTX_SUBSET_INVALID_SELECTION",
                f"page {end} is outside the source presentation ({slide_count} slides)",
            )
        if selected and start <= selected[-1]:
            if start in selected_set or any(page in selected_set for page in range(start, end + 1)):
                raise SubsetError("PPTX_SUBSET_INVALID_SELECTION", f"duplicate page in selector: {piece!r}")
            raise SubsetError("PPTX_SUBSET_INVALID_SELECTION", "pages must be listed in original presentation order")
        expanded = range(start, end + 1)
        selected.extend(expanded)
        selected_set.update(expanded)
    return selected


def _rels_name(part: str) -> str:
    return posixpath.join(posixpath.dirname(part), "_rels", posixpath.basename(part) + ".rels")


def _resolve_target(source_part: str | None, target: str, *, must_exist: bool, names: set[str]) -> str:
    try:
        parsed = urlsplit(target)
        decoded_path = unquote(parsed.path, encoding="utf-8", errors="strict")
    except (UnicodeDecodeError, ValueError) as exc:
        raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", f"Invalid relationship target {target!r}") from exc
    if parsed.scheme or parsed.netloc or parsed.query or not decoded_path or "\\" in decoded_path:
        raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", f"Invalid internal relationship target {target!r}")

    if decoded_path.startswith("/"):
        joined = decoded_path.lstrip("/")
    else:
        base = posixpath.dirname(source_part or "")
        joined = posixpath.join(base, decoded_path)
    resolved = posixpath.normpath(joined)
    if resolved in ("", ".", "..") or resolved.startswith("../") or resolved.startswith("/"):
        raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", f"Relationship escapes the package root: {target!r}")
    if must_exist and resolved not in names:
        raise SubsetError(
            "PPTX_SUBSET_STALE_RELATIONSHIP",
            f"Relationship from {source_part or 'package root'} targets missing part {resolved!r}",
        )
    return resolved


def _read_relationships(
    package: zipfile.ZipFile,
    rels_part: str,
    source_part: str | None,
    names: set[str],
    overrides: dict[str, bytes] | None = None,
) -> tuple[etree._Element, list[dict[str, Any]]]:
    if rels_part not in names:
        raise SubsetError("PPTX_SUBSET_STALE_RELATIONSHIP", f"Missing relationships part {rels_part!r}")
    raw = (overrides or {}).get(rels_part)
    if raw is None:
        try:
            raw = package.read(rels_part)
        except (KeyError, zipfile.BadZipFile, RuntimeError) as exc:
            raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", f"Cannot read {rels_part}: {exc}") from exc
    root = _parse_xml(raw, rels_part)
    if root.tag != f"{{{NS_REL}}}Relationships":
        raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", f"Unexpected relationship root in {rels_part}")

    rows: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for node in root.findall(f"{{{NS_REL}}}Relationship"):
        rel_id = node.get("Id", "")
        rel_type = node.get("Type", "")
        target = node.get("Target", "")
        mode = node.get("TargetMode") or "Internal"
        if not rel_id or not rel_type or not target:
            raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", f"Incomplete relationship in {rels_part}")
        if rel_id in seen_ids:
            raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", f"Duplicate relationship id {rel_id!r} in {rels_part}")
        if mode not in {"Internal", "External"}:
            raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", f"Unknown TargetMode {mode!r} in {rels_part}")
        seen_ids.add(rel_id)
        resolved = None
        if mode == "Internal":
            resolved = _resolve_target(source_part, target, must_exist=True, names=names)
        rows.append({"id": rel_id, "type": rel_type, "target": target, "mode": mode, "resolved": resolved, "node": node})
    return root, rows


def _content_type_part_names(root: etree._Element) -> dict[str, str]:
    if root.tag != f"{{{NS_CT}}}Types":
        raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", "[Content_Types].xml has an unexpected root element")
    overrides: dict[str, str] = {}
    for node in root.findall(f"{{{NS_CT}}}Override"):
        part_name = node.get("PartName", "")
        content_type = node.get("ContentType", "")
        if not part_name.startswith("/") or not content_type:
            raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", "Invalid Override in [Content_Types].xml")
        try:
            normalized = unquote(part_name[1:], encoding="utf-8", errors="strict")
        except UnicodeDecodeError as exc:
            raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", f"Invalid PartName {part_name!r}") from exc
        normalized = posixpath.normpath(normalized)
        if normalized in ("", ".", "..") or normalized.startswith("../") or normalized.startswith("/"):
            raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", f"Invalid PartName {part_name!r}")
        overrides[normalized] = content_type
    return overrides


def _presentation_slides(
    package: zipfile.ZipFile,
    root_relationships: list[dict[str, Any]],
    names: set[str],
) -> tuple[str, str, bytes, bytes, etree._Element, etree._Element, list[dict[str, str]]]:
    office_docs = [row for row in root_relationships if row["type"].endswith("/officeDocument") and row["mode"] == "Internal"]
    if len(office_docs) != 1:
        raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", "Package root must identify exactly one officeDocument part")
    presentation_part = office_docs[0]["resolved"]
    presentation_rels_part = _rels_name(presentation_part)
    try:
        presentation_bytes = package.read(presentation_part)
    except (KeyError, zipfile.BadZipFile, RuntimeError) as exc:
        raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", f"Cannot read presentation part: {exc}") from exc
    presentation_root = _parse_xml(presentation_bytes, presentation_part)
    if presentation_root.tag != f"{{{NS_P}}}presentation":
        raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", f"Unexpected root element in {presentation_part}")

    presentation_rels_root, rel_rows = _read_relationships(
        package, presentation_rels_part, presentation_part, names
    )
    rel_by_id = {row["id"]: row for row in rel_rows}
    slide_list = presentation_root.find(f"{{{NS_P}}}sldIdLst")
    if slide_list is None:
        raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", "Presentation has no p:sldIdLst")

    slides: list[dict[str, str]] = []
    seen_parts: set[str] = set()
    seen_ids: set[str] = set()
    for ordinal, node in enumerate(slide_list.findall(f"{{{NS_P}}}sldId"), 1):
        rel_id = node.get(R_ID, "")
        slide_id = node.get("id", "")
        relation = rel_by_id.get(rel_id)
        if not rel_id or not slide_id or relation is None or relation["mode"] != "Internal" or not relation["type"].endswith("/slide"):
            raise SubsetError(
                "PPTX_SUBSET_STALE_RELATIONSHIP",
                f"Slide {ordinal} has a missing or invalid presentation relationship {rel_id!r}",
            )
        if relation["resolved"] in seen_parts or slide_id in seen_ids:
            raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", "Presentation slide ids and parts must be unique")
        seen_parts.add(relation["resolved"])
        seen_ids.add(slide_id)
        slides.append({"page": str(ordinal), "slide_id": slide_id, "relationship_id": rel_id, "part": relation["resolved"]})
    if not slides:
        raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", "Presentation contains no slides")
    try:
        presentation_rels_bytes = package.read(presentation_rels_part)
    except (KeyError, zipfile.BadZipFile, RuntimeError) as exc:
        raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", f"Cannot read {presentation_rels_part}: {exc}") from exc
    return (
        presentation_part,
        presentation_rels_part,
        presentation_bytes,
        presentation_rels_bytes,
        presentation_root,
        presentation_rels_root,
        slides,
    )


def _filter_sections_and_custom_shows(presentation_root: etree._Element, selected_slide_ids: set[str], selected_rids: set[str]) -> None:
    for section_list in list(presentation_root.iter()):
        if etree.QName(section_list).localname != "sectionLst":
            continue
        for section in list(section_list):
            if etree.QName(section).localname != "section":
                continue
            section_slide_lists = [node for node in section.iter() if node is not section and etree.QName(node).localname == "sldIdLst"]
            if not section_slide_lists:
                continue
            for slide_list in section_slide_lists:
                for slide_id in list(slide_list):
                    if etree.QName(slide_id).localname == "sldId" and slide_id.get("id") not in selected_slide_ids:
                        slide_list.remove(slide_id)
            if not any(
                etree.QName(node).localname == "sldId" and node.get("id") in selected_slide_ids
                for slide_list in section_slide_lists
                for node in slide_list
            ):
                section_list.remove(section)
        if not any(etree.QName(child).localname == "section" for child in section_list):
            parent = section_list.getparent()
            if parent is not None:
                parent.remove(section_list)

    for custom_show_list in list(presentation_root.iter(f"{{{NS_P}}}custShowLst")):
        for custom_show in list(custom_show_list.findall(f"{{{NS_P}}}custShow")):
            show_slides = custom_show.find(f"{{{NS_P}}}sldLst")
            if show_slides is None:
                custom_show_list.remove(custom_show)
                continue
            for slide_ref in list(show_slides.findall(f"{{{NS_P}}}sld")):
                if slide_ref.get(R_ID) not in selected_rids:
                    show_slides.remove(slide_ref)
            if not show_slides.findall(f"{{{NS_P}}}sld"):
                custom_show_list.remove(custom_show)
        if not custom_show_list.findall(f"{{{NS_P}}}custShow"):
            parent = custom_show_list.getparent()
            if parent is not None:
                parent.remove(custom_show_list)


def _reachable_parts(
    package: zipfile.ZipFile,
    names: set[str],
    overrides: dict[str, bytes],
    presentation_part: str,
    all_slide_parts: set[str],
    selected_slide_parts: set[str],
) -> set[str]:
    if ROOT_RELS not in names:
        raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", "Package is missing _rels/.rels")
    reachable: set[str] = {CONTENT_TYPES}
    queue: deque[tuple[str | None, str]] = deque([(None, ROOT_RELS)])
    seen_rels: set[str] = set()
    while queue:
        owner, rels_part = queue.popleft()
        if rels_part in seen_rels:
            continue
        seen_rels.add(rels_part)
        if rels_part not in names:
            if owner is None:
                raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", "Package is missing _rels/.rels")
            continue
        reachable.add(rels_part)
        _, rows = _read_relationships(package, rels_part, owner, names, overrides)
        for row in rows:
            if row["mode"] == "External":
                continue
            target = row["resolved"]
            if target in all_slide_parts and target not in selected_slide_parts:
                raise SubsetError(
                    "PPTX_SUBSET_CROSS_SLIDE_LINK",
                    f"Relationship from {owner or 'package root'} pulls in unselected slide {target}",
                )
            reachable.add(target)
            target_rels = _rels_name(target)
            if target_rels in names:
                queue.append((target, target_rels))
    return reachable


def _update_extended_properties(
    package: zipfile.ZipFile,
    app_part: str,
    reachable: set[str],
    content_types: dict[str, str],
    slide_count: int,
    hidden_slide_count: int,
) -> tuple[bytes, dict[str, Any]]:
    try:
        original = package.read(app_part)
    except (KeyError, zipfile.BadZipFile, RuntimeError) as exc:
        raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", f"Cannot read extended properties {app_part}: {exc}") from exc
    root = _parse_xml(original, app_part)
    if etree.QName(root).localname != "Properties":
        raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", f"Unexpected extended-properties root in {app_part}")

    notes_count = sum(
        1 for part in reachable
        if part.casefold().startswith("ppt/notesslides/")
        and part.casefold().endswith(".xml")
        and (
            content_types.get(part, "").casefold().endswith("presentationml.notesslide+xml")
            or re.fullmatch(r"ppt/notesslides/notesslide[^/]+\.xml", part, re.IGNORECASE)
        )
    )
    values = {"Slides": slide_count, "Notes": notes_count, "HiddenSlides": hidden_slide_count}
    removed_properties: list[str] = []
    found_values: dict[str, list[etree._Element]] = {name: [] for name in values}
    for child in list(root):
        name = etree.QName(child).localname
        if name in APP_STAT_PROPERTIES:
            root.remove(child)
            removed_properties.append(name)
        elif name in found_values:
            found_values[name].append(child)

    rank = {name: index for index, name in enumerate(APP_PROPERTY_ORDER)}
    for name, value in values.items():
        nodes = found_values[name]
        if not nodes:
            namespace = etree.QName(root).namespace
            tag = f"{{{namespace}}}{name}" if namespace else name
            node = etree.Element(tag)
            node.text = str(value)
            insert_at = len(root)
            for index, sibling in enumerate(root):
                if rank.get(etree.QName(sibling).localname, len(rank)) > rank[name]:
                    insert_at = index
                    break
            root.insert(insert_at, node)
        else:
            for node in nodes:
                node.text = str(value)

    metadata = {
        "part": app_part,
        "updated_properties": values,
        "removed_properties": sorted(set(removed_properties)),
    }
    return _serialize_xml(root, original), metadata


def _same_path(left: Path, right: Path) -> bool:
    try:
        if left.resolve(strict=False) == right.resolve(strict=False):
            return True
        if os.path.lexists(left) and os.path.lexists(right):
            return os.path.samefile(left, right)
    except OSError:
        return False
    return False


def _validate_paths(source: Path, output: Path, report: Path | None) -> None:
    if _same_path(source, output):
        raise SubsetError("PPTX_SUBSET_OUTPUT_PATH_INVALID", "output path must not alias the source PPTX")
    if report is not None and _same_path(source, report):
        raise SubsetError("PPTX_SUBSET_OUTPUT_PATH_INVALID", "report path must not alias the source PPTX")
    if report is not None and _same_path(output, report):
        raise SubsetError("PPTX_SUBSET_OUTPUT_PATH_INVALID", "output and report paths must be different")
    if os.path.lexists(output):
        raise SubsetError("PPTX_SUBSET_OUTPUT_EXISTS", f"Refusing to overwrite existing output: {output}")
    if report is not None and os.path.lexists(report):
        raise SubsetError("PPTX_SUBSET_OUTPUT_EXISTS", f"Refusing to overwrite existing report: {report}")


def _make_temp_path(path: Path) -> str:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        fd, temp_path = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
        os.close(fd)
        return temp_path
    except OSError as exc:
        raise SubsetError("PPTX_SUBSET_OUTPUT_WRITE_FAILED", f"Cannot prepare output path {path}: {exc}") from exc


def _write_report_temp(path: str, report: dict[str, Any]) -> None:
    try:
        with open(path, "w", encoding="utf-8") as stream:
            stream.write(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
            stream.flush()
            os.fsync(stream.fileno())
    except OSError as exc:
        raise SubsetError("PPTX_SUBSET_OUTPUT_WRITE_FAILED", f"Cannot write subset report: {exc}") from exc


def select_slides(
    pptx: str | Path,
    slides_string: str,
    out: str | Path,
    report: str | Path | None = None,
) -> dict[str, Any]:
    """Write a slide subset while leaving selected slide-related part bytes intact.

    Page numbers are 1-based positions in the source presentation. The selector
    accepts ascending comma-separated numbers/ranges, for example ``1-20,22``.
    The destination and optional report are created without replacing existing
    files. Invalid or unsafe packages raise :class:`SubsetError`.
    """

    source_path = Path(pptx).expanduser()
    output_path = Path(out).expanduser()
    report_path = Path(report).expanduser() if report is not None else None
    if not source_path.is_file():
        raise SubsetError("PPTX_SUBSET_SOURCE_INVALID", f"PPTX does not exist or is not a file: {source_path}")
    # Check the caller's exact path before resolving it so dangling symlinks
    # also count as pre-existing destinations and are never followed/overwritten.
    _validate_paths(source_path, output_path, report_path)
    try:
        source_path = source_path.resolve(strict=True)
        output_path = output_path.resolve(strict=False)
        report_path = report_path.resolve(strict=False) if report_path is not None else None
    except OSError as exc:
        raise SubsetError("PPTX_SUBSET_OUTPUT_PATH_INVALID", f"Cannot resolve input/output paths: {exc}") from exc
    _validate_paths(source_path, output_path, report_path)

    source_hash = _hash_file(source_path)
    source_stat = source_path.stat()
    try:
        source_zip = zipfile.ZipFile(source_path, "r")
    except (OSError, zipfile.BadZipFile, zipfile.LargeZipFile) as exc:
        raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", f"Cannot open source PPTX as a ZIP package: {exc}") from exc

    with source_zip:
        infos = source_zip.infolist()
        names_in_order = [info.filename for info in infos]
        if len(names_in_order) != len(set(names_in_order)):
            raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", "ZIP package contains duplicate entry names")
        file_names = {name for name in names_in_order if not name.endswith("/")}
        if CONTENT_TYPES not in file_names or ROOT_RELS not in file_names:
            raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", "PPTX is missing [Content_Types].xml or _rels/.rels")

        try:
            content_types_bytes = source_zip.read(CONTENT_TYPES)
        except (KeyError, zipfile.BadZipFile, RuntimeError) as exc:
            raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", f"Cannot read [Content_Types].xml: {exc}") from exc
        content_types_root = _parse_xml(content_types_bytes, CONTENT_TYPES)
        content_type_overrides = _content_type_part_names(content_types_root)

        root_rel_root, root_rel_rows = _read_relationships(source_zip, ROOT_RELS, None, file_names)
        try:
            root_rels_bytes = source_zip.read(ROOT_RELS)
        except (KeyError, zipfile.BadZipFile, RuntimeError) as exc:
            raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", f"Cannot read {ROOT_RELS}: {exc}") from exc
        (
            presentation_part,
            presentation_rels_part,
            presentation_bytes,
            presentation_rels_bytes,
            presentation_root,
            presentation_rels_root,
            slides,
        ) = _presentation_slides(source_zip, root_rel_rows, file_names)
        selected_pages = _parse_selection(slides_string, len(slides))
        selected_slides = [slides[page - 1] for page in selected_pages]
        selected_slide_parts = {slide["part"] for slide in selected_slides}
        selected_rids = {slide["relationship_id"] for slide in selected_slides}
        selected_slide_ids = {slide["slide_id"] for slide in selected_slides}

        # Keep all slide parts known to Content Types so that a relationship to
        # an orphan or omitted page cannot silently pull that page back in.
        all_slide_parts = {
            part for part, content_type in content_type_overrides.items()
            if content_type.endswith("presentationml.slide+xml")
        } | {slide["part"] for slide in slides}

        slide_list = presentation_root.find(f"{{{NS_P}}}sldIdLst")
        assert slide_list is not None
        hidden_slide_count = sum(
            node.get("show", "1").casefold() in {"0", "false"}
            for node in slide_list.findall(f"{{{NS_P}}}sldId")
            if node.get(R_ID) in selected_rids
        )
        keep_nodes = {
            slide["relationship_id"] for slide in selected_slides
        }
        for node in list(slide_list.findall(f"{{{NS_P}}}sldId")):
            if node.get(R_ID) not in keep_nodes:
                slide_list.remove(node)
        _filter_sections_and_custom_shows(presentation_root, selected_slide_ids, selected_rids)

        for relation in list(presentation_rels_root.findall(f"{{{NS_REL}}}Relationship")):
            if relation.get("Type", "").endswith("/slide") and relation.get("Id") not in selected_rids:
                presentation_rels_root.remove(relation)

        presentation_modified = _serialize_xml(presentation_root, presentation_bytes)
        presentation_rels_modified = _serialize_xml(presentation_rels_root, presentation_rels_bytes)
        changed_xml = {
            presentation_part: presentation_modified,
            presentation_rels_part: presentation_rels_modified,
        }
        removed_thumbnail_relationships: list[dict[str, str]] = []
        if selected_pages[0] != 1:
            for relation in list(root_rel_root.findall(f"{{{NS_REL}}}Relationship")):
                if relation.get("Type", "").endswith(THUMBNAIL_REL):
                    removed_thumbnail_relationships.append({
                        "relationship_id": relation.get("Id", ""),
                        "target": relation.get("Target", ""),
                    })
                    root_rel_root.remove(relation)
            if removed_thumbnail_relationships:
                changed_xml[ROOT_RELS] = _serialize_xml(root_rel_root, root_rels_bytes)

        for slide in selected_slides:
            if slide["part"] not in file_names:
                raise SubsetError("PPTX_SUBSET_STALE_RELATIONSHIP", f"Selected slide part is missing: {slide['part']}")

        reachable = _reachable_parts(
            source_zip,
            file_names,
            changed_xml,
            presentation_part,
            all_slide_parts,
            selected_slide_parts,
        )
        if any(part not in file_names for part in reachable):
            missing = sorted(part for part in reachable if part not in file_names)
            raise SubsetError("PPTX_SUBSET_STALE_RELATIONSHIP", f"Reachable parts are missing: {missing[:10]}")

        app_relationships = [
            row for row in root_rel_rows
            if row["mode"] == "Internal" and row["type"].endswith(EXTENDED_PROPERTIES_REL)
        ]
        if len(app_relationships) > 1:
            raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", "Package has more than one extended-properties part")
        metadata_updates = None
        if app_relationships:
            app_part = app_relationships[0]["resolved"]
            changed_xml[app_part], metadata_updates = _update_extended_properties(
                source_zip,
                app_part,
                reachable,
                content_type_overrides,
                len(selected_slides),
                hidden_slide_count,
            )

        for override in list(content_types_root.findall(f"{{{NS_CT}}}Override")):
            part_name = unquote(override.get("PartName", "")[1:], encoding="utf-8", errors="strict")
            if posixpath.normpath(part_name) not in reachable:
                content_types_root.remove(override)
        content_types_modified = _serialize_xml(content_types_root, content_types_bytes)
        changed_xml[CONTENT_TYPES] = content_types_modified

        selected_slide_xml: dict[str, bytes] = {}
        for slide in selected_slides:
            try:
                selected_slide_xml[slide["part"]] = source_zip.read(slide["part"])
            except (KeyError, zipfile.BadZipFile, RuntimeError) as exc:
                raise SubsetError("PPTX_SUBSET_INVALID_PACKAGE", f"Cannot read selected slide {slide['part']}: {exc}") from exc

        retained_names = {
            info.filename for info in infos
            if (not info.is_dir() and info.filename in reachable)
            or (info.is_dir() and any(part.startswith(info.filename) for part in reachable))
        }
        removed_parts = sorted(name for name in file_names if name not in reachable)
        original_archive_comment = source_zip.comment

        output_temp = _make_temp_path(output_path)
        try:
            report_temp = _make_temp_path(report_path) if report_path is not None else None
        except BaseException:
            try:
                os.unlink(output_temp)
            except OSError:
                pass
            raise
        output_published = False
        report_published = False
        try:
            try:
                with zipfile.ZipFile(output_temp, "w") as output_zip:
                    output_zip.comment = original_archive_comment
                    for info in infos:
                        if info.filename not in retained_names:
                            continue
                        info_copy = copy.copy(info)
                        if info.filename in changed_xml:
                            output_zip.writestr(info_copy, changed_xml[info.filename])
                        else:
                            with source_zip.open(info, "r") as reader, output_zip.open(info_copy, "w") as writer:
                                shutil.copyfileobj(reader, writer, length=1024 * 1024)
            except (OSError, zipfile.BadZipFile, RuntimeError, ValueError) as exc:
                raise SubsetError("PPTX_SUBSET_OUTPUT_WRITE_FAILED", f"Cannot write subset package: {exc}") from exc

            try:
                with zipfile.ZipFile(output_temp, "r") as staged_zip:
                    bad_entry = staged_zip.testzip()
                    if bad_entry:
                        raise SubsetError("PPTX_SUBSET_OUTPUT_INVALID", f"CRC verification failed for {bad_entry}")
                    for slide in selected_slides:
                        actual = staged_zip.read(slide["part"])
                        if actual != selected_slide_xml[slide["part"]]:
                            raise SubsetError("PPTX_SUBSET_OUTPUT_INVALID", f"Selected slide XML changed: {slide['part']}")
            except (zipfile.BadZipFile, KeyError, RuntimeError) as exc:
                raise SubsetError("PPTX_SUBSET_OUTPUT_INVALID", f"Staged PPTX is unreadable: {exc}") from exc

            current_stat = source_path.stat()
            if (current_stat.st_size, current_stat.st_mtime_ns) != (source_stat.st_size, source_stat.st_mtime_ns) or _hash_file(source_path) != source_hash:
                raise SubsetError("PPTX_SUBSET_SOURCE_CHANGED", "Source PPTX changed while the subset was being created")

            subset_hash = _hash_file(Path(output_temp))
            page_mapping = []
            selected_xml_report = []
            with zipfile.ZipFile(output_temp, "r") as staged_zip:
                for output_page, slide in enumerate(selected_slides, 1):
                    xml_bytes = staged_zip.read(slide["part"])
                    page_mapping.append({
                        "source_page": int(slide["page"]),
                        "output_page": output_page,
                        "source_slide_id": slide["slide_id"],
                        "relationship_id": slide["relationship_id"],
                        "slide_part": slide["part"],
                    })
                    selected_xml_report.append({
                        "slide_part": slide["part"],
                        "source_sha256": _sha256(selected_slide_xml[slide["part"]]),
                        "subset_sha256": _sha256(xml_bytes),
                        "byte_equal": xml_bytes == selected_slide_xml[slide["part"]],
                    })

            result: dict[str, Any] = {
                "schema_version": 1,
                "status": "created",
                "source_sha256": source_hash,
                "subset_sha256": subset_hash,
                "source_path": str(source_path),
                "subset_path": str(output_path),
                "requested_pages": selected_pages,
                "page_mapping": page_mapping,
                "selected_slide_xml": selected_xml_report,
                "selected_slide_xml_byte_equal": all(item["byte_equal"] for item in selected_xml_report),
                "modified_parts": sorted(changed_xml),
                "metadata_updates": metadata_updates,
                "thumbnail_relationships_removed": removed_thumbnail_relationships,
                "source_part_count": len(file_names),
                "retained_part_count": len(reachable),
                "deleted_part_count": len(removed_parts),
                "deleted_parts": removed_parts,
            }
            if report_temp is not None:
                _write_report_temp(report_temp, result)

            try:
                os.link(output_temp, output_path)
                output_published = True
            except FileExistsError as exc:
                raise SubsetError("PPTX_SUBSET_OUTPUT_EXISTS", f"Refusing to overwrite existing output: {output_path}") from exc
            except OSError as exc:
                raise SubsetError("PPTX_SUBSET_OUTPUT_WRITE_FAILED", f"Cannot publish subset output: {exc}") from exc

            if report_path is not None and report_temp is not None:
                try:
                    os.link(report_temp, report_path)
                    report_published = True
                except FileExistsError as exc:
                    raise SubsetError("PPTX_SUBSET_OUTPUT_EXISTS", f"Refusing to overwrite existing report: {report_path}") from exc
                except OSError as exc:
                    raise SubsetError("PPTX_SUBSET_OUTPUT_WRITE_FAILED", f"Cannot publish subset report: {exc}") from exc
            return result
        except BaseException:
            if report_published and report_path is not None and report_temp is not None:
                try:
                    if os.path.samefile(report_temp, report_path):
                        report_path.unlink()
                except OSError:
                    pass
            if output_published:
                try:
                    if os.path.samefile(output_temp, output_path):
                        output_path.unlink()
                except OSError:
                    pass
            raise
        finally:
            for temp_path in (output_temp, report_temp):
                if temp_path is not None:
                    try:
                        os.unlink(temp_path)
                    except OSError:
                        pass
