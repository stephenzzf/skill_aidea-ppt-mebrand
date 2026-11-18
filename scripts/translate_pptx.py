#!/usr/bin/env python3
"""Extract/apply text mappings in a PPTX without rebuilding presentation parts.

The translation itself is supplied by the caller. This module only locates text,
validates a complete mapping, and updates selected DrawingML text nodes in place.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import posixpath
import posixpath
import re
import sys
import tempfile
import zipfile
from collections import defaultdict
from pathlib import Path
from typing import Any

from lxml import etree

NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main"
NS_C = "http://schemas.openxmlformats.org/drawingml/2006/chart"
NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS_PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
NS_XL = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS_XL_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main"
NS = {"a": NS_A, "c": NS_C, "r": NS_R, "rel": NS_PKG_REL, "x": NS_XL, "p": NS_P}

URL_RE = re.compile(r"https?://[^\s<>\]\[(){}\"']+", re.IGNORECASE)
NUMBER_RE = re.compile(r"(?<![A-Za-z])(?:\$|€|£|¥)?\d+(?:,\d{3})*(?:\.\d+)?(?:万|亿|[KMBT])?(?:\s*(?:thousand|million|billion|trillion|%|pt|pts|point|points|点|分|token|tokens|倍|[x×]))?(?![A-Za-z])", re.IGNORECASE)
CODE_RE = re.compile(
    r"`[^`\n]+`"
    r"|(?<![A-Za-z0-9_])Base\s?URL(?![A-Za-z0-9_])"
    # CLI flags must be word-delimited in Unicode text too. A Chinese title
    # such as "短剧--AI翻译" uses the hyphens as punctuation; the flag remains
    # protected when separated as a real option, e.g. "run --max-tokens 8".
    r"|(?<!\w)--[A-Za-z][A-Za-z0-9]*(?:[-_][A-Za-z0-9]+)*(?!\w)"
    r"|(?<!\w)-[A-Za-z](?!\w)"
    r"|(?<![A-Za-z0-9_])[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+(?![A-Za-z0-9_])"
    # Dotted/hyphenated product and API identifiers must contain a digit.
    # Ordinary prose such as "long-horizon" and "standard-template" is translatable.
    r"|(?<![A-Za-z0-9_])(?=[A-Za-z0-9.-]*\d)[A-Za-z][A-Za-z0-9]*(?:[.-][A-Za-z0-9]+)+(?![A-Za-z0-9_])"
)
MODEL_RE = re.compile(
    r"(?<![A-Za-z0-9_])(?:Kimi[- ](?:K\d+(?:\.\d+)*(?:[- ]Pro)?(?:[- ]Highspeed)?)"
    r"|Kimi[- ](?:Work|Code)"
    r"|GPT[- ]?\d+(?:\.\d+)*(?:[A-Za-z0-9.-]*)"
    r"|Claude(?:[- ]\d+(?:\.\d+)*(?:[- ](?:Opus|Sonnet|Haiku))?|[- ](?:Opus|Sonnet|Haiku)[- ]\d+(?:\.\d+)*)"
    r"|Gemini[- ]\d+(?:\.\d+)*(?:[- ](?:Pro|Flash|Ultra|Nano))?)(?![A-Za-z0-9_])",
    re.IGNORECASE,
)
CURRENCY_CODE_RE = re.compile(
    r"(?<![A-Za-z0-9_])(?:USD|EUR|CNY|RMB|HKD|SGD|GBP|JPY|AUD|CAD)(?![A-Za-z0-9_])"
    r"|(?<![A-Za-z0-9_])US\s+dollars?(?![A-Za-z0-9_])"
    r"|(?:美元|美金|欧元|人民币|港元|港币|新加坡元|英镑|日元|澳元|加元)",
    re.IGNORECASE,
)
CURRENCY_CANONICAL = {
    "usd": "USD", "us dollar": "USD", "us dollars": "USD", "美元": "USD", "美金": "USD",
    "eur": "EUR", "euro": "EUR", "euros": "EUR", "欧元": "EUR",
    "cny": "CNY", "rmb": "CNY", "人民币": "CNY",
    "hkd": "HKD", "港元": "HKD", "港币": "HKD",
    "sgd": "SGD", "新加坡元": "SGD",
    "gbp": "GBP", "英镑": "GBP",
    "jpy": "JPY", "日元": "JPY",
    "aud": "AUD", "澳元": "AUD",
    "cad": "CAD", "加元": "CAD",
}
PARSER = etree.XMLParser(resolve_entities=False, no_network=True, remove_blank_text=False, huge_tree=False)


class TranslationError(ValueError):
    pass


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _load_json(path: str | Path) -> dict[str, Any]:
    try:
        value = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise TranslationError(f"Cannot read JSON {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise TranslationError(f"Expected a JSON object in {path}")
    return value


def _part_kind(name: str) -> str | None:
    if re.fullmatch(r"ppt/slides/slide\d+\.xml", name):
        return "slide"
    if re.fullmatch(r"ppt/slideMasters/slideMaster\d+\.xml", name):
        return "slide-master"
    if re.fullmatch(r"ppt/slideLayouts/slideLayout\d+\.xml", name):
        return "slide-layout"
    if re.fullmatch(r"ppt/notesSlides/notesSlide\d+\.xml", name):
        return "speaker-notes"
    if re.fullmatch(r"ppt/notesMasters/notesMaster\d+\.xml", name):
        return "notes-master"
    if re.fullmatch(r"ppt/charts/chart\d+\.xml", name):
        return "chart"
    return None


def _slide_number(name: str) -> int | None:
    # Notes-slide numbering is an unrelated package-part sequence. Callers
    # must resolve its relationship to ppt/slides/slideN.xml instead.
    if name.startswith("ppt/notesSlides/"):
        return None
    match = re.search(r"slide(\d+)\.xml$", name)
    return int(match.group(1)) if match else None


def _part_relationships(package: zipfile.ZipFile, part: str) -> list[dict[str, str]]:
    folder, basename = posixpath.split(part)
    rel_part = posixpath.join(folder, "_rels", basename + ".rels")
    if rel_part not in package.namelist():
        return []
    root = etree.fromstring(package.read(rel_part), parser=_safe_parser())
    rows = []
    for rel in root.xpath("./rel:Relationship", namespaces=NS):
        target = rel.get("Target", "")
        resolved = target.lstrip("/") if target.startswith("/") else posixpath.normpath(posixpath.join(folder, target))
        rows.append({"type": rel.get("Type", "").rsplit("/", 1)[-1], "target": resolved})
    return rows


def _notes_slide_numbers(package: zipfile.ZipFile) -> dict[str, int]:
    """Map notesSlide parts to their related slide parts, not matching indices."""
    slides = {name: _slide_number(name) for name in package.namelist()
              if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)}
    result = {}
    for name in package.namelist():
        if not re.fullmatch(r"ppt/notesSlides/notesSlide\d+\.xml", name):
            continue
        related = [row["target"] for row in _part_relationships(package, name) if row["type"] == "slide" and row["target"] in slides]
        if len(related) == 1:
            result[name] = int(slides[related[0]])
    return result


def protected_tokens(text: str) -> list[str]:
    found: list[tuple[int, str]] = []
    for pattern in (URL_RE, CODE_RE, MODEL_RE, NUMBER_RE):
        for match in pattern.finditer(text):
            token = match.group(0).rstrip(".,;:!?，。；：") if pattern is URL_RE else match.group(0)
            if token:
                found.append((match.start(), token))
    found.sort(key=lambda item: (item[0], -len(item[1])))
    result: list[str] = []
    end = -1
    for start, token in found:
        if start < end:
            continue
        result.append(token)
        end = start + len(token)
    return result


def _protected_identity_tokens(text: str) -> list[str]:
    found: list[tuple[int, int, str]] = []
    for pattern in (URL_RE, CODE_RE, MODEL_RE, CURRENCY_CODE_RE):
        for match in pattern.finditer(text):
            token = match.group(0).rstrip(".,;:!?，。；：") if pattern is URL_RE else match.group(0)
            if pattern is CURRENCY_CODE_RE:
                token = f"currency:{CURRENCY_CANONICAL.get(token.casefold(), token.upper())}"
            if token:
                found.append((match.start(), match.end(), token))
    found.sort(key=lambda item: (item[0], -(item[1] - item[0])))
    result: list[str] = []
    end = -1
    for start, stop, token in found:
        if start < end:
            continue
        result.append(token)
        end = stop
    return result


_NUMBER_COMPONENT_RE = re.compile(
    r"(?<![A-Za-z0-9])(?P<sign>[+-])?(?P<currency>[$€£¥])?(?P<number>\d+(?:,\d{3})*(?:\.\d+)?)(?P<scale>万|亿|[KMBT])?(?:\s*(?P<word>thousand|million|billion|trillion))?(?:\s*(?P<unit>%|pt|pts|point|points|点|分|token|tokens|倍|[x×]))?(?![A-Za-z])",
    re.IGNORECASE,
)
_MONTH = {"january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
          "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12}
_DATE_PATTERNS = (
    re.compile(r"(?P<year>\d{4})年\s*(?P<month>\d{1,2})月\s*(?P<day>\d{1,2})日?"),
    re.compile(r"(?P<year>\d{4})[-./](?P<month>\d{1,2})[-./](?P<day>\d{1,2})"),
    re.compile(r"(?<![A-Za-z])(?P<month>January|February|March|April|May|June|July|August|September|October|November|December)\s+(?P<day>\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(?P<year>\d{4}))?(?![A-Za-z0-9])", re.IGNORECASE),
    re.compile(r"(?P<month>\d{1,2})月\s*(?P<day>\d{1,2})日?"),
)
_SCALE = {"万": 10_000, "亿": 100_000_000, "k": 1_000, "m": 1_000_000,
          "b": 1_000_000_000, "t": 1_000_000_000_000,
          "thousand": 1_000, "million": 1_000_000, "billion": 1_000_000_000,
          "trillion": 1_000_000_000_000}


def _numeric_signature(text: str) -> list[tuple[str, str]]:
    """Compare numeric facts independent of date order and equivalent units."""
    signature: list[tuple[str, str]] = []
    masked = list(text)
    for pattern in _DATE_PATTERNS:
        # Scan the remaining text so shorter month/day patterns cannot also
        # match inside a full date already recognized above.
        remainder = "".join(masked)
        for match in pattern.finditer(remainder):
            raw_month = match.group("month")
            month = _MONTH.get(raw_month.lower()) if raw_month.lower() in _MONTH else int(raw_month)
            day = int(match.group("day"))
            raw_year = match.groupdict().get("year")
            year = int(raw_year) if raw_year else None
            if 1 <= month <= 12 and 1 <= day <= 31:
                date_value = f"{year:04d}-{month:02d}-{day:02d}" if year is not None else f"--{month:02d}-{day:02d}"
                signature.append((date_value, "date"))
                for idx in range(match.start(), match.end()):
                    masked[idx] = " "
    remainder = "".join(masked)
    for match in _NUMBER_COMPONENT_RE.finditer(remainder):
        number = match.group("number").replace(",", "")
        scale = (match.group("scale") or match.group("word") or "").lower()
        unit = (match.group("unit") or "").lower()
        if unit in {"pt", "pts", "point", "points", "点", "分"}:
            unit = "points"
        elif unit == "%":
            unit = "percent"
        elif unit in {"x", "×", "倍"}:
            unit = "multiple"
        currency = match.group("currency") or ""
        try:
            factor = -1 if match.group("sign") == "-" else 1
            normalized = str(factor * float(number) * _SCALE.get(scale, 1))
        except ValueError:
            continue
        if normalized.endswith(".0"):
            normalized = normalized[:-2]
        signature.append((normalized, unit + currency))
    return signature


def _safe_parser() -> etree.XMLParser:
    return etree.XMLParser(resolve_entities=False, no_network=True, remove_blank_text=False, huge_tree=False)


def _serialize_xml(root: etree._Element, original: bytes) -> bytes:
    declaration = original.lstrip().startswith(b"<?xml")
    standalone = None
    head = original.lstrip().split(b"?>", 1)[0] if declaration else b""
    if b"standalone='yes'" in head or b'standalone="yes"' in head:
        standalone = True
    elif b"standalone='no'" in head or b'standalone="no"' in head:
        standalone = False
    return etree.tostring(root, encoding="UTF-8", xml_declaration=declaration, standalone=standalone)


def _iter_text_paragraphs(root: etree._Element):
    for index, paragraph in enumerate(root.xpath(".//a:p", namespaces=NS)):
        nodes = paragraph.xpath(".//a:t", namespaces=NS)
        if not nodes:
            continue
        segments = [node.text or "" for node in nodes]
        yield index, paragraph, nodes, segments


def _unit_id(part: str, index: int) -> str:
    return f"{part}#p{index}"


def _collect_inventory(names: list[str], package: zipfile.ZipFile) -> dict[str, Any]:
    inventory: dict[str, Any] = {
        "slides": len([name for name in names if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)]),
        "media_parts": [name for name in names if name.startswith("ppt/media/") and not name.endswith("/")],
        "image_text_review_required": [name for name in names if name.startswith("ppt/media/") and not name.endswith("/")],
        "smartart_parts": [name for name in names if name.startswith("ppt/diagrams/") and not name.endswith("/")],
        "embedded_objects": [name for name in names if name.startswith("ppt/embeddings/") and not name.endswith("/")],
        "charts": [],
        "unsupported_visible_text_candidates": [],
    }
    for name in names:
        if name.startswith("ppt/charts/_rels/") and name.endswith(".rels"):
            try:
                root = etree.fromstring(package.read(name), parser=_safe_parser())
                external = [rel.get("Target") for rel in root.xpath("./rel:Relationship[@TargetMode='External']", namespaces=NS)]
                if external:
                    inventory["unsupported_visible_text_candidates"].append({"part": name, "kind": "external-chart-data", "targets": external})
            except etree.XMLSyntaxError:
                inventory["unsupported_visible_text_candidates"].append({"part": name, "kind": "unreadable-chart-relationships"})
        if name.startswith("ppt/slideLayouts/") and name.endswith(".xml"):
            try:
                root = etree.fromstring(package.read(name), parser=_safe_parser())
                if root.xpath(".//p:oleObj", namespaces=NS):
                    inventory["unsupported_visible_text_candidates"].append({"part": name, "kind": "ole-object"})
            except etree.XMLSyntaxError:
                pass
    for name in names:
        if name.endswith(".xml") and (name.startswith("ppt/slides/") or name.startswith("ppt/slideMasters/") or name.startswith("ppt/slideLayouts/")):
            try:
                root = etree.fromstring(package.read(name), parser=_safe_parser())
                if root.xpath(".//p:oleObj", namespaces=NS):
                    inventory["unsupported_visible_text_candidates"].append({"part": name, "kind": "ole-object"})
            except etree.XMLSyntaxError:
                inventory["unsupported_visible_text_candidates"].append({"part": name, "kind": "unreadable-presentation-xml"})
        if re.fullmatch(r"ppt/charts/chart\d+\.xml", name):
            try:
                root = etree.fromstring(package.read(name), parser=_safe_parser())
                rel_name = posixpath.join(posixpath.dirname(name), "_rels", posixpath.basename(name) + ".rels")
                target = None
                external_targets = []
                if rel_name in names:
                    rels = etree.fromstring(package.read(rel_name), parser=_safe_parser())
                    rel = rels.xpath("./rel:Relationship[@Type=$type]", namespaces=NS,
                                     type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/package")
                    if rel:
                        target = _resolve_target(name, rel[0].get("Target", ""))
                    external_targets = [item.get("Target") for item in rels.xpath("./rel:Relationship[@TargetMode='External']", namespaces=NS)]
                inventory["charts"].append({
                    "part": name,
                    "has_cached_strings": bool(root.xpath(".//c:strCache|.//c:multiLvlStrCache", namespaces=NS)),
                    "workbook_part": target,
                    "workbook_part_present": bool(target and target in names),
                    "external_relationship_targets": external_targets,
                    "has_external_data_binding": bool(root.xpath(".//c:externalData", namespaces=NS)),
                })
                if external_targets:
                    inventory["unsupported_visible_text_candidates"].append({"part": name, "kind": "external-chart-data", "targets": external_targets})
            except etree.XMLSyntaxError:
                inventory["charts"].append({"part": name, "error": "invalid XML"})
                inventory["unsupported_visible_text_candidates"].append({"part": name, "kind": "unreadable-chart-xml"})
    # SmartArt text can live in data/drawing parts rather than the rels. It is
    # reported explicitly; safe editing of those diagram data parts is out of scope.
    if inventory["smartart_parts"]:
        inventory["unsupported_visible_text_candidates"].append({"kind": "smartart", "parts": inventory["smartart_parts"]})
    inventory["ole_parts"] = [name for name in names if name.startswith("ppt/embeddings/") and not name.endswith("/") and not name.lower().endswith(".xlsx")]
    if inventory["ole_parts"]:
        inventory["unsupported_visible_text_candidates"].append({"kind": "ole-or-embedded-object", "parts": inventory["ole_parts"]})
    return inventory


def _unsupported_inventory_errors(inventory: dict[str, Any] | None) -> list[str]:
    """Fail closed when visible text may exist outside the supported text units."""
    errors: list[str] = []
    if not isinstance(inventory, dict):
        return errors
    candidates = inventory.get("unsupported_visible_text_candidates", [])
    if not isinstance(candidates, list):
        return ["unsupported visible-text inventory is invalid; translation is blocked"]
    for candidate in candidates:
        if not isinstance(candidate, dict):
            errors.append("unsupported visible-text candidate is invalid; translation is blocked")
            continue
        kind = str(candidate.get("kind") or "unknown")
        part = candidate.get("part")
        if not part:
            parts = candidate.get("parts")
            part = ", ".join(parts) if isinstance(parts, list) else "unknown package part"
        errors.append(f"unsupported visible text ({kind}) blocks translation: {part}")
    return errors


def _resolve_target(source_part: str, target: str) -> str:
    if target.startswith("/"):
        return target.lstrip("/")
    return posixpath.normpath(posixpath.join(posixpath.dirname(source_part), target))


def _rels_name(part: str) -> str:
    return posixpath.join(posixpath.dirname(part), "_rels", posixpath.basename(part) + ".rels")


def _chart_workbook_map(chart_part: str, zip_file: zipfile.ZipFile) -> tuple[str | None, dict[str, dict[str, Any]]]:
    rel_path = _rels_name(chart_part)
    workbook_part = None
    if rel_path in zip_file.namelist():
        rels = etree.fromstring(zip_file.read(rel_path), parser=_safe_parser())
        for relation in rels.xpath("./rel:Relationship", namespaces=NS):
            if relation.get("Type", "").endswith("/package"):
                workbook_part = _resolve_target(chart_part, relation.get("Target", ""))
                break
    if not workbook_part or workbook_part not in zip_file.namelist():
        return workbook_part, {}
    try:
        workbook = zipfile.ZipFile(__import__("io").BytesIO(zip_file.read(workbook_part)))
        workbook_parts = workbook.namelist()
        workbook_root = etree.fromstring(workbook.read("xl/workbook.xml"), parser=_safe_parser())
        workbook_rels = etree.fromstring(workbook.read("xl/_rels/workbook.xml.rels"), parser=_safe_parser())
        rel_targets = {rel.get("Id"): _resolve_target("xl/workbook.xml", rel.get("Target", ""))
                       for rel in workbook_rels.xpath("./rel:Relationship", namespaces=NS)}
        sheets: dict[str, dict[str, Any]] = {}
        for sheet in workbook_root.xpath("./x:sheets/x:sheet", namespaces=NS):
            title = sheet.get("name", "")
            target = rel_targets.get(sheet.get(f"{{{NS_XL_REL}}}id"), "")
            if target and target in workbook_parts:
                sheets[title] = {"path": target, "root": etree.fromstring(workbook.read(target), parser=_safe_parser())}
        strings: list[str] = []
        if "xl/sharedStrings.xml" in workbook_parts:
            ss = etree.fromstring(workbook.read("xl/sharedStrings.xml"), parser=_safe_parser())
            strings = ["".join(si.xpath(".//x:t/text()", namespaces=NS)) for si in ss.xpath("./x:si", namespaces=NS)]
        for value in sheets.values():
            for cell in value["root"].xpath(".//x:c", namespaces=NS):
                if cell.get("t") == "s":
                    v = cell.find(f"{{{NS_XL}}}v")
                    if v is not None and (v.text or "").isdigit() and int(v.text) < len(strings):
                        cell.set("data-translation-shared-text", strings[int(v.text)])
        return workbook_part, {"_sheets": sheets, "_zip": workbook, "_workbook_parts": workbook_parts}
    except (KeyError, OSError, etree.XMLSyntaxError, zipfile.BadZipFile):
        return workbook_part, {}


def _parse_chart_formula(formula: str) -> tuple[str | None, list[str]]:
    if "!" not in formula or "[" in formula:
        return None, []
    sheet, address = formula.rsplit("!", 1)
    sheet = sheet.strip("'")
    address = address.replace("$", "")
    cells: list[str] = []
    match = re.fullmatch(r"([A-Z]+\d+)(?::([A-Z]+\d+))?", address, re.I)
    if not match:
        return sheet, []

    def split_ref(ref: str):
        m = re.fullmatch(r"([A-Z]+)(\d+)", ref, re.I)
        if not m:
            return 0, 0
        col = 0
        for ch in m.group(1).upper():
            col = col * 26 + ord(ch) - 64
        return int(m.group(2)), col

    start_row, start_col = split_ref(match.group(1))
    end_row, end_col = split_ref(match.group(2) or match.group(1))
    if not start_row or not start_col or not end_row or not end_col or (end_row - start_row) * (end_col - start_col) > 10000:
        return sheet, []
    for row in range(start_row, end_row + 1):
        for col in range(start_col, end_col + 1):
            n, letters = col, ""
            while n:
                n, remainder = divmod(n - 1, 26)
                letters = chr(65 + remainder) + letters
            cells.append(f"{letters}{row}")
    return sheet, cells


def _iter_chart_cache_units(name: str, root: etree._Element):
    index = 0
    for cache in root.xpath(".//c:strCache|.//c:multiLvlStrCache", namespaces=NS):
        formula_nodes = cache.xpath("../c:f", namespaces=NS)
        formula = (formula_nodes[0].text or "") if formula_nodes else ""
        pt = cache.xpath(".//c:pt", namespaces=NS)
        values = [node.find(f"{{{NS_C}}}v") for node in pt]
        is_multi = cache.tag == f"{{{NS_C}}}multiLvlStrCache"
        if is_multi:
            groups = cache.xpath("./c:lvl", namespaces=NS)
            ordered = [(lvl, lvl.xpath("./c:pt/c:v", namespaces=NS)) for lvl in groups]
            refs_by_index: dict[int, str] = {}
            _, refs = _parse_chart_formula(formula)
            for pos, cell in enumerate(refs):
                refs_by_index[pos] = cell
            for group_idx, (_, nodes) in enumerate(ordered):
                for point_idx, node in enumerate(nodes):
                    source = node.text or ""
                    unit = {
                        "id": f"{name}#cv{index}", "part": name, "path": name,
                        "slide": None, "kind": "chart-string-cache", "source_text": source,
                        "segments": [source], "protected_tokens": protected_tokens(source),
                        "locator": {"type": "chart-v", "index": index, "formula": formula,
                                    "point_index": point_idx, "level_index": group_idx,
                                    "workbook_cell": refs_by_index.get(point_idx)},
                    }
                    index += 1
                    yield unit
        else:
            _, refs = _parse_chart_formula(formula)
            for point_pos, value in enumerate(values):
                if value is None:
                    continue
                source = value.text or ""
                unit = {
                    "id": f"{name}#cv{index}", "part": name, "path": name,
                    "slide": None, "kind": "chart-string-cache", "source_text": source,
                    "segments": [source], "protected_tokens": protected_tokens(source),
                    "locator": {"type": "chart-v", "index": index, "formula": formula,
                                "point_index": point_pos, "workbook_cell": refs[point_pos] if point_pos < len(refs) else None},
                }
                index += 1
                yield unit


def _build_workbook_units(chart_units: list[dict[str, Any]], package: zipfile.ZipFile) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    by_part: dict[str, list[tuple[str, int, str]]] = defaultdict(list)
    workbooks: dict[str, dict[str, Any]] = {}
    for unit in chart_units:
        locator = unit.get("locator", {})
        cell_address = locator.get("workbook_cell")
        formula = locator.get("formula", "")
        if not cell_address:
            continue
        chart_path = unit["part"]
        if chart_path not in workbooks:
            target, data = _chart_workbook_map(chart_path, package)
            if target and data:
                workbooks[chart_path] = {"part": target, **data}
        wb = workbooks.get(chart_path)
        if not wb:
            continue
        sheet_name, _ = _parse_chart_formula(formula)
        sheet = wb.get("_sheets", {}).get(sheet_name or "")
        if not sheet:
            continue
        cells = sheet["root"].xpath(".//x:c[@r=$ref]", namespaces=NS, ref=cell_address)
        if len(cells) != 1:
            continue
        locator["workbook_reference_resolved"] = True
        cell = cells[0]
        source = cell.get("data-translation-shared-text")
        if source is None:
            source = "".join(cell.xpath("./x:is//x:t/text()", namespaces=NS))
        if not source:
            continue
        by_part[wb["part"]].append((sheet["path"], 0, cell_address))

    units: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for chart_path, wb in workbooks.items():
        for unit in chart_units:
            if unit["part"] != chart_path:
                continue
            locator = unit["locator"]
            cell_address = locator.get("workbook_cell")
            if not cell_address:
                continue
            sheet_name, _ = _parse_chart_formula(locator.get("formula", ""))
            sheet = wb.get("_sheets", {}).get(sheet_name or "")
            if not sheet:
                continue
            cells = sheet["root"].xpath(".//x:c[@r=$ref]", namespaces=NS, ref=cell_address)
            if not cells:
                continue
            cell = cells[0]
            source = cell.get("data-translation-shared-text")
            storage = "shared"
            if source is None:
                source = "".join(cell.xpath("./x:is//x:t/text()", namespaces=NS))
                storage = "inline"
            if not source:
                continue
            key = (wb["part"], sheet["path"], cell_address)
            if key in seen:
                continue
            seen.add(key)
            unit_id = f"{wb['part']}!{sheet['path']}!{cell_address}"
            units.append({
                "id": unit_id, "part": f"{wb['part']}!{sheet['path']}", "path": f"{wb['part']}!{sheet['path']}",
                "slide": None, "kind": "chart-workbook-cell", "source_text": source,
                "segments": [source], "protected_tokens": protected_tokens(source),
                "locator": {"type": "xlsx-cell", "workbook_part": wb["part"], "sheet_path": sheet["path"],
                            "cell": cell_address, "storage": storage},
            })
    # Cross-link cache units to workbook-cell units for consistency validation.
    lookup = {(u["locator"]["workbook_part"], u["locator"]["sheet_path"], u["locator"]["cell"]): u["id"] for u in units}
    for chart_unit in chart_units:
        chart_path = chart_unit["part"]
        wb = workbooks.get(chart_path)
        loc = chart_unit["locator"]
        if not wb or not loc.get("workbook_cell"):
            continue
        sheet_name, _ = _parse_chart_formula(loc.get("formula", ""))
        sheet = wb.get("_sheets", {}).get(sheet_name or "")
        if sheet:
            key = (wb["part"], sheet["path"], loc["workbook_cell"])
            if key in lookup:
                loc["workbook_unit_id"] = lookup[key]
    return units, workbooks


def extract_pptx(pptx_path: str | Path) -> dict[str, Any]:
    source_path = Path(pptx_path)
    if not source_path.is_file():
        raise TranslationError(f"PPTX does not exist: {source_path}")
    raw = source_path.read_bytes()
    if not zipfile.is_zipfile(source_path):
        raise TranslationError("Input is not a valid ZIP/PPTX package")
    units: list[dict[str, Any]] = []
    with zipfile.ZipFile(source_path) as package:
        names = package.namelist()
        inventory = _collect_inventory(names, package)
        notes_slide_numbers = _notes_slide_numbers(package)
        chart_units: list[dict[str, Any]] = []
        chart_inventory = {item["part"]: item for item in inventory.get("charts", [])}
        for name in names:
            kind = _part_kind(name)
            if not kind:
                continue
            try:
                original = package.read(name)
                root = etree.fromstring(original, parser=_safe_parser())
            except etree.XMLSyntaxError as exc:
                raise TranslationError(f"Invalid XML in {name}: {exc}") from exc
            if kind == "chart":
                chart_units.extend(_iter_chart_cache_units(name, root))
                chart_info = chart_inventory.get(name, {})
                for unit in chart_units:
                    if unit["part"] != name:
                        continue
                    if chart_info.get("external_relationship_targets"):
                        unit["locator"]["external_data_targets"] = chart_info["external_relationship_targets"]
                    elif chart_info.get("workbook_part") and not chart_info.get("workbook_part_present"):
                        unit["locator"]["missing_workbook_part"] = chart_info["workbook_part"]
            if kind == "speaker-notes" and name not in notes_slide_numbers and any(
                text.strip() for text in root.xpath(".//a:t/text()", namespaces=NS)
            ):
                inventory["unsupported_visible_text_candidates"].append({
                    "part": name, "kind": "unresolved-speaker-notes-slide-relationship"
                })
            for para_index, paragraph, _nodes, segments in _iter_text_paragraphs(root):
                source_text = "".join(segments)
                if not source_text.strip():
                    continue
                units.append({
                    "id": _unit_id(name, para_index), "part": name, "path": name,
                    "slide": notes_slide_numbers.get(name) if kind == "speaker-notes" else _slide_number(name) if kind == "slide" else None,
                    "kind": kind, "source_text": source_text, "segments": segments,
                    "protected_tokens": protected_tokens(source_text),
                    "fields": [{"id": field.get("id"), "type": field.get("type")}
                               for field in paragraph.xpath(".//a:fld", namespaces=NS)],
                    "locator": {"type": "paragraph", "index": para_index},
                })
        workbook_units, _ = _build_workbook_units(chart_units, package)
        units.extend(chart_units)
        units.extend(workbook_units)
        for unit in chart_units:
            locator = unit.get("locator", {})
            if unit.get("source_text", "").strip() and not locator.get("workbook_reference_resolved"):
                inventory["unsupported_visible_text_candidates"].append({
                    "part": unit["part"], "kind": "unresolved-chart-string-cache",
                    "unit_id": unit["id"], "formula": locator.get("formula", ""),
                })
        inventory["unsupported_visible_text_candidates"].extend(
            {"part": c["part"], "kind": "chart-workbook-unresolved"}
            for c in inventory["charts"] if c.get("workbook_part") and not c.get("has_cached_strings")
        )
    return {
        "schema_version": 1,
        "source": {"path": str(source_path.resolve()), "sha256": sha256(raw)},
        "source_sha256": sha256(raw),
        "units": units,
        "inventory": inventory,
        "notes": [
            "Translation is external to this tool. Translate source_text with its full sentence context and return one output per segments entry.",
            "A preserve unit must return the original segments unchanged and include a reason.",
            "Image text requires visual review. SmartArt, OLE, external charts and unresolved chart strings block v1 translation and QA.",
        ],
    }


def _check_mapping(extraction: dict[str, Any], mapping: dict[str, Any]) -> tuple[dict[str, dict[str, Any]], list[str]]:
    errors: list[str] = []
    errors.extend(_unsupported_inventory_errors(extraction.get("inventory")))
    if mapping.get("schema_version") != 1:
        errors.append("mapping schema_version must be 1")
    if mapping.get("source_sha256") != extraction["source_sha256"]:
        errors.append("mapping source_sha256 does not match the source PPTX")
    expected = {unit["id"]: unit for unit in extraction["units"]}
    received_units = mapping.get("units")
    if not isinstance(received_units, list):
        return {}, errors + ["mapping units must be an array"]
    received: dict[str, dict[str, Any]] = {}
    for entry in received_units:
        if not isinstance(entry, dict) or not isinstance(entry.get("id"), str):
            errors.append("every mapping unit must be an object with an id")
            continue
        unit_id = entry["id"]
        if unit_id in received:
            errors.append(f"duplicate mapping id: {unit_id}")
            continue
        received[unit_id] = entry
    missing = sorted(set(expected) - set(received))
    extra = sorted(set(received) - set(expected))
    if missing:
        errors.append(f"mapping is missing {len(missing)} unit(s), e.g. {missing[:5]}")
    if extra:
        errors.append(f"mapping contains {len(extra)} unknown unit(s), e.g. {extra[:5]}")

    for unit_id in sorted(set(expected) & set(received)):
        source = expected[unit_id]
        entry = received[unit_id]
        if entry.get("source_text") != source["source_text"]:
            errors.append(f"source_text changed for {unit_id}")
        segments = entry.get("segments")
        if not isinstance(segments, list) or len(segments) != len(source["segments"]):
            errors.append(f"segment count mismatch for {unit_id}: expected {len(source['segments'])}")
            continue
        if any(not isinstance(segment, str) for segment in segments):
            errors.append(f"all segments must be strings for {unit_id}")
            continue
        status = entry.get("status")
        if status not in ("translated", "preserve"):
            errors.append(f"status must be translated or preserve for {unit_id}")
            continue
        if status == "preserve":
            if not isinstance(entry.get("reason"), str) or not entry["reason"].strip():
                errors.append(f"preserve requires a reason for {unit_id}")
            if segments != source["segments"]:
                errors.append(f"preserve unit changed segments for {unit_id}")
        else:
            locator = source.get("locator", {})
            if locator.get("external_data_targets"):
                errors.append(f"external chart data cannot be synchronized safely in this release: {unit_id}")
            if locator.get("missing_workbook_part"):
                errors.append(f"linked chart workbook is unavailable: {unit_id}")
            if source.get("fields"):
                errors.append(f"field-backed text cannot be translated safely in this release: {unit_id}")
            for pos, (before, after) in enumerate(zip(source["segments"], segments)):
                if before.strip() and not after.strip():
                    errors.append(f"empty translation at {unit_id} segment {pos}")
            translated_text = "".join(segments)
            if _protected_identity_tokens(source["source_text"]) != _protected_identity_tokens(translated_text):
                errors.append(f"protected URL/code/model tokens changed for {unit_id}")
            if _numeric_signature(source["source_text"]) != _numeric_signature(translated_text):
                errors.append(f"numeric fact or unit changed for {unit_id}")
        if source["kind"] == "chart-string-cache" and source.get("locator", {}).get("workbook_unit_id"):
            counterpart = received.get(source["locator"]["workbook_unit_id"])
            if counterpart and counterpart.get("segments") != segments:
                errors.append(f"chart cache and embedded workbook translation differ for {unit_id}")
    return received, errors


def _apply_xml_units(package_bytes: dict[str, bytes], extraction: dict[str, Any], mapping_units: dict[str, dict[str, Any]]) -> dict[str, bytes]:
    by_part: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for unit in extraction["units"]:
        if unit["kind"] == "chart-workbook-cell":
            continue
        by_part[unit["part"]].append(unit)
    changed: dict[str, bytes] = {}
    for part, units in by_part.items():
        original = package_bytes[part]
        root = etree.fromstring(original, parser=_safe_parser())
        paragraphs = root.xpath(".//a:p", namespaces=NS)
        cache_values = root.xpath(".//c:strCache//c:pt/c:v|.//c:multiLvlStrCache//c:pt/c:v", namespaces=NS)
        modified = False
        for unit in units:
            entry = mapping_units[unit["id"]]
            if entry["status"] == "preserve":
                continue
            locator = unit.get("locator", {})
            if locator.get("type") == "paragraph":
                idx = locator["index"]
                if idx >= len(paragraphs):
                    raise TranslationError(f"PPTX changed after extraction; paragraph locator missing: {unit['id']}")
                nodes = paragraphs[idx].xpath(".//a:t", namespaces=NS)
            else:
                idx = locator.get("index", -1)
                if idx < 0 or idx >= len(cache_values):
                    raise TranslationError(f"PPTX changed after extraction; chart cache locator missing: {unit['id']}")
                nodes = [cache_values[idx]]
            segments = entry["segments"]
            if len(nodes) != len(segments):
                raise TranslationError(f"PPTX text structure changed after extraction: {unit['id']}")
            for node, value in zip(nodes, segments):
                node.text = value
            modified = True
        if modified:
            changed[part] = _serialize_xml(root, original)
    return changed


def _apply_workbook_units(zip_file: zipfile.ZipFile, extraction: dict[str, Any], mapping_units: dict[str, dict[str, Any]]) -> dict[str, bytes]:
    needed: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    for unit in extraction["units"]:
        if unit["kind"] != "chart-workbook-cell":
            continue
        entry = mapping_units[unit["id"]]
        if entry["status"] == "preserve":
            continue
        locator = unit["locator"]
        needed[locator["workbook_part"]][unit["id"]] = {"unit": unit, "entry": entry}
    result: dict[str, bytes] = {}
    for workbook_part, workbook_units in needed.items():
        blob = zip_file.read(workbook_part)
        with zipfile.ZipFile(__import__("io").BytesIO(blob)) as book:
            names = book.namelist()
            contents = {name: book.read(name) for name in names}
        roots: dict[str, etree._Element] = {}
        changed: set[str] = set()
        for item in workbook_units.values():
            loc = item["unit"]["locator"]
            sheet_path = loc["sheet_path"]
            if sheet_path not in roots:
                if sheet_path not in contents:
                    raise TranslationError(f"Embedded workbook sheet missing: {sheet_path}")
                roots[sheet_path] = etree.fromstring(contents[sheet_path], parser=_safe_parser())
            root = roots[sheet_path]
            cells = root.xpath(".//x:c[@r=$ref]", namespaces=NS, ref=loc["cell"])
            if len(cells) != 1:
                raise TranslationError(f"Expected one workbook cell {loc['cell']} in {sheet_path}")
            cell = cells[0]
            segments = item["entry"]["segments"]
            if len(segments) != 1:
                raise TranslationError(f"Workbook cell mapping must have one segment: {item['unit']['id']}")
            translated = segments[0]
            if loc["storage"] == "inline":
                texts = cell.xpath("./x:is//x:t", namespaces=NS)
                if len(texts) != 1:
                    raise TranslationError(f"Inline string structure is ambiguous at {item['unit']['id']}")
                texts[0].text = translated
            else:
                # Convert only the referenced cell to inlineStr. This keeps the
                # shared string table byte-for-byte unchanged and cannot mutate
                # another cell that happens to share the same string index.
                for node in list(cell):
                    if node.tag in (f"{{{NS_XL}}}v", f"{{{NS_XL}}}is"):
                        cell.remove(node)
                cell.set("t", "inlineStr")
                inline = etree.SubElement(cell, f"{{{NS_XL}}}is")
                text_node = etree.SubElement(inline, f"{{{NS_XL}}}t")
                if translated[:1].isspace() or translated[-1:].isspace():
                    text_node.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
                text_node.text = translated
            changed.add(sheet_path)
        for path in changed:
            contents[path] = _serialize_xml(roots[path], contents[path])
        out = __import__("io").BytesIO()
        with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as book:
            for name in names:
                book.writestr(name, contents[name])
        result[workbook_part] = out.getvalue()
    return result


def _same_path(left: Path, right: Path) -> bool:
    if left.resolve(strict=False) == right.resolve(strict=False):
        return True
    try:
        return os.path.samefile(left, right)
    except OSError:
        return False


def _validate_output_paths(source: Path, mapping: Path, output: Path, report: Path | None) -> None:
    if _same_path(output, source):
        raise TranslationError("output path must not alias the source PPTX")
    if _same_path(output, mapping):
        raise TranslationError("output path must not alias the mapping file")
    if output.exists():
        raise TranslationError(f"Refusing to overwrite existing output: {output}")
    if report is None:
        return
    if _same_path(report, source):
        raise TranslationError("report path must not alias the source PPTX")
    if _same_path(report, mapping):
        raise TranslationError("report path must not alias the mapping file")
    if _same_path(report, output):
        raise TranslationError("candidate and report paths must not be the same path")
    if report.exists():
        raise TranslationError(f"Refusing to overwrite existing report: {report}")


def apply_mapping(pptx_path: str | Path, mapping_path: str | Path, out_path: str | Path, report_path: str | Path | None = None) -> dict[str, Any]:
    source_path = Path(pptx_path)
    mapping_file = Path(mapping_path)
    output_path = Path(out_path)
    report_output_path = Path(report_path) if report_path is not None else None
    if not source_path.is_file():
        raise TranslationError(f"PPTX does not exist: {source_path}")
    _validate_output_paths(source_path, mapping_file, output_path, report_output_path)
    extraction = extract_pptx(source_path)
    mapping = _load_json(mapping_file)
    mapping_units, errors = _check_mapping(extraction, mapping)
    if errors:
        raise TranslationError("Invalid translation mapping:\n- " + "\n- ".join(errors[:50]))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if report_output_path:
        report_output_path.parent.mkdir(parents=True, exist_ok=True)

    temp_output: str | None = None
    temp_report: str | None = None
    output_published = False
    report_published = False
    try:
        with zipfile.ZipFile(source_path) as source_zip:
            package_bytes = {name: source_zip.read(name) for name in source_zip.namelist()}
            changed = _apply_xml_units(package_bytes, extraction, mapping_units)
            changed.update(_apply_workbook_units(source_zip, extraction, mapping_units))
            fd, temp_output = tempfile.mkstemp(prefix=f".{output_path.name}.", suffix=".tmp", dir=output_path.parent)
            os.close(fd)
            with zipfile.ZipFile(temp_output, "w", compression=zipfile.ZIP_DEFLATED) as output_zip:
                for info in source_zip.infolist():
                    output_zip.writestr(info, changed.get(info.filename, package_bytes[info.filename]))
            # Validate the staged package before either final file becomes visible.
            with zipfile.ZipFile(temp_output) as candidate_zip:
                bad = candidate_zip.testzip()
                if bad:
                    raise TranslationError(f"Output package CRC failure in {bad}")

        report = {
            "schema_version": 1,
            "source_sha256": extraction["source_sha256"],
            "mapping_sha256": sha256(mapping_file.read_bytes()),
            "output_sha256": sha256(Path(temp_output).read_bytes()),
            "source_path": str(source_path.resolve()), "output_path": str(output_path.resolve()),
            "translated_units": sum(1 for entry in mapping_units.values() if entry["status"] == "translated"),
            "preserved_units": sum(1 for entry in mapping_units.values() if entry["status"] == "preserve"),
            "changed_parts": sorted(changed),
            "inventory": extraction["inventory"],
            "status": "applied",
        }
        if report_output_path:
            fd, temp_report = tempfile.mkstemp(prefix=f".{report_output_path.name}.", suffix=".tmp", dir=report_output_path.parent)
            with os.fdopen(fd, "w", encoding="utf-8") as report_file:
                report_file.write(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
                report_file.flush()
                os.fsync(report_file.fileno())

        # Hard links publish without overwriting a path created concurrently.
        os.link(temp_output, output_path)
        output_published = True
        if report_output_path and temp_report:
            os.link(temp_report, report_output_path)
            report_published = True
        return report
    except BaseException as exc:
        cleanup_failures = []
        if report_published and report_output_path and temp_report:
            try:
                if os.path.samefile(temp_report, report_output_path):
                    report_output_path.unlink()
            except OSError as cleanup_exc:
                cleanup_failures.append(str(cleanup_exc))
        if output_published:
            try:
                if temp_output and os.path.samefile(temp_output, output_path):
                    output_path.unlink()
            except OSError as cleanup_exc:
                cleanup_failures.append(str(cleanup_exc))
        if cleanup_failures:
            raise TranslationError(f"Output publication failed and cleanup was incomplete: {cleanup_failures}") from exc
        raise
    finally:
        for temp_path in (temp_output, temp_report):
            if temp_path:
                try:
                    os.unlink(temp_path)
                except OSError:
                    pass


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    extract_parser = sub.add_parser("extract", help="Extract source units and an inventory")
    extract_parser.add_argument("--pptx", required=True)
    extract_parser.add_argument("--out", required=True)
    apply_parser = sub.add_parser("apply", help="Validate mapping and write translated PPTX")
    apply_parser.add_argument("--pptx", required=True)
    apply_parser.add_argument("--mapping", required=True)
    apply_parser.add_argument("--out", required=True)
    apply_parser.add_argument("--report")
    select_parser = sub.add_parser("select", help="Select original pages without rebuilding slide objects")
    select_parser.add_argument("--pptx", required=True)
    select_parser.add_argument("--slides", required=True, help="Ascending original page ranges, e.g. 1-20,22")
    select_parser.add_argument("--out", required=True)
    select_parser.add_argument("--report")
    args = parser.parse_args(argv)
    try:
        if args.command == "select":
            from pptx_subset import SubsetError, select_slides
            try:
                result = select_slides(args.pptx, args.slides, args.out, args.report)
            except SubsetError as exc:
                raise TranslationError(str(exc)) from exc
            print(json.dumps(result, ensure_ascii=False, indent=2))
        elif args.command == "extract":
            result = extract_pptx(args.pptx)
            target = Path(args.out)
            if target.exists():
                raise TranslationError(f"Refusing to overwrite existing output: {target}")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(json.dumps({"status": "extracted", "units": len(result["units"]), "sha256": result["source_sha256"], "inventory": result["inventory"]}, ensure_ascii=False, indent=2))
        else:
            result = apply_mapping(args.pptx, args.mapping, args.out, args.report)
            print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except (TranslationError, OSError, zipfile.BadZipFile) as exc:
        print(str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
