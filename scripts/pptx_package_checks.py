#!/usr/bin/env python3
"""Focused OPC and PptxGenJS package checks for PowerPoint compatibility.

This is not a complete ECMA-376 schema validator. It reports malformed package
references and the PptxGenJS chart/workbook defects that LibreOffice can tolerate.
"""
from __future__ import annotations

import argparse
import json
import posixpath
import re
import sys
import zipfile
from typing import Any
from urllib.parse import unquote
from xml.etree import ElementTree as ET

CONTENT_TYPES_NS = "http://schemas.openxmlformats.org/package/2006/content-types"
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
CHART_NS = "http://schemas.openxmlformats.org/drawingml/2006/chart"
PRESENTATION_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
MAIN_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
PRESENTATION_CHILD_ORDER = (
    "sldMasterIdLst", "notesMasterIdLst", "handoutMasterIdLst", "sldIdLst",
    "sldSz", "notesSz", "embeddedFontLst", "custShowLst", "photoAlbum",
    "custDataLst", "kinsoku", "defaultTextStyle", "modifyVerifier", "extLst",
)
TEXT_ANCHOR_VALUES = {"t", "ctr", "b", "just", "dist"}
NS = {
    "ct": CONTENT_TYPES_NS,
    "rel": REL_NS,
    "c": CHART_NS,
    "p": PRESENTATION_NS,
    "a": MAIN_NS,
}

_CELL_REF = re.compile(r"^\$?([A-Za-z]{1,3})\$?([1-9][0-9]*)$")
_RANGE_REF = re.compile(r"^(\$?[A-Za-z]{1,3}\$?[1-9][0-9]*)(?::(\$?[A-Za-z]{1,3}\$?[1-9][0-9]*))?$")
_CHART_GROUPS = {
    "barChart", "bar3DChart", "lineChart", "line3DChart", "areaChart",
    "area3DChart", "scatterChart", "bubbleChart", "radarChart",
    "surfaceChart", "surface3DChart",
}
_AXIS_TYPES = {"catAx", "dateAx", "valAx", "serAx", "val3DAx"}
_PARAGRAPH_SPACING_ORDER = {"lnSpc": 0, "spcBef": 1, "spcAft": 2}


def _err(code: str, part: str, message: str, **extra: Any) -> dict[str, Any]:
    return {"code": code, "part": part, "message": message, **extra}


def _xml(zf: zipfile.ZipFile, part: str, errors: list[dict[str, Any]]) -> ET.Element | None:
    try:
        return ET.fromstring(zf.read(part))
    except KeyError:
        errors.append(_err("missing-part", part, "Referenced package part is missing."))
    except (ET.ParseError, UnicodeDecodeError) as exc:
        errors.append(_err("invalid-xml", part, f"XML cannot be parsed: {exc}"))
    return None


def _canonical_part_name(name: str) -> str | None:
    """Convert a package part URI/path to its ZIP member name."""
    decoded = unquote(name).replace("\\", "/")
    if decoded.startswith("/"):
        decoded = decoded[1:]
    normalized = posixpath.normpath(decoded)
    if normalized in {"", ".", ".."} or normalized.startswith("../"):
        return None
    return normalized


def _owner_for_rels(rels_part: str) -> str | None:
    if rels_part == "_rels/.rels":
        return None
    marker = "/_rels/"
    if marker not in rels_part or not rels_part.endswith(".rels"):
        return None
    folder, basename = rels_part.split(marker, 1)
    return posixpath.join(folder, basename[:-5])


def _resolve_target(owner: str | None, target: str) -> str | None:
    decoded = unquote(target).replace("\\", "/")
    if decoded.startswith("/"):
        return _canonical_part_name(decoded)
    base = posixpath.dirname(owner) if owner else ""
    return _canonical_part_name(posixpath.join(base, decoded))


def _check_content_types(zf: zipfile.ZipFile, names: set[str], errors: list[dict[str, Any]]) -> None:
    part = "[Content_Types].xml"
    root = _xml(zf, part, errors)
    if root is None:
        return
    seen: set[str] = set()
    for override in root.findall(f"{{{CONTENT_TYPES_NS}}}Override"):
        raw = override.get("PartName", "")
        target = _canonical_part_name(raw)
        if target is None:
            errors.append(_err("invalid-override-part-name", part, f"Override has an invalid PartName: {raw!r}."))
            continue
        if target in seen:
            errors.append(_err("duplicate-content-type-override", part, f"PartName {raw!r} has more than one Override."))
        seen.add(target)
        if target not in names:
            errors.append(_err("missing-content-type-part", part, f"Override references missing package part {raw!r}.", target=target))


def _check_relationships(zf: zipfile.ZipFile, names: set[str], errors: list[dict[str, Any]]) -> None:
    master_theme_refs: dict[str, dict[str, set[str]]] = {"notes": {}, "slides": {}}
    for rels_part in sorted(name for name in names if name.endswith(".rels")):
        root = _xml(zf, rels_part, errors)
        if root is None:
            continue
        owner = _owner_for_rels(rels_part)
        seen_ids: set[str] = set()
        for rel in root.findall(f"{{{REL_NS}}}Relationship"):
            rel_id = rel.get("Id", "")
            if not rel_id:
                errors.append(_err("relationship-id-missing", rels_part, "A Relationship is missing its Id."))
            elif rel_id in seen_ids:
                errors.append(_err("duplicate-relationship-id", rels_part, f"Relationship Id {rel_id!r} is duplicated."))
            seen_ids.add(rel_id)
            if rel.get("TargetMode", "Internal").lower() == "external":
                continue
            target_text = rel.get("Target", "")
            target = _resolve_target(owner, target_text)
            if target is None:
                errors.append(_err("invalid-relationship-target", rels_part, f"Internal target {target_text!r} escapes or names an invalid package path."))
            elif target not in names:
                errors.append(_err("missing-relationship-target", rels_part, f"Internal target {target_text!r} resolves to missing part {target!r}.", target=target))
            elif owner and rel.get("Type", "").endswith("/theme"):
                if owner.startswith("ppt/notesMasters/"):
                    master_theme_refs["notes"].setdefault(target, set()).add(owner)
                elif owner.startswith("ppt/slideMasters/"):
                    master_theme_refs["slides"].setdefault(target, set()).add(owner)

    for theme_part in sorted(master_theme_refs["notes"].keys() & master_theme_refs["slides"].keys()):
        for notes_master in sorted(master_theme_refs["notes"][theme_part]):
            for slide_master in sorted(master_theme_refs["slides"][theme_part]):
                errors.append(_err(
                    "shared-notes-theme",
                    notes_master,
                    f"Notes master {notes_master!r} and slide master {slide_master!r} both target theme part {theme_part!r}. This is a known Mac PowerPoint compatibility risk; the check is not a general ECMA-376 schema prohibition.",
                    target=theme_part,
                    related_part=slide_master,
                ))


def _check_presentation_child_order(zf: zipfile.ZipFile, names: set[str], errors: list[dict[str, Any]]) -> None:
    part = "ppt/presentation.xml"
    if part not in names:
        return
    root = _xml(zf, part, errors)
    if root is None or root.tag != f"{{{PRESENTATION_NS}}}presentation":
        return

    order = {name: index for index, name in enumerate(PRESENTATION_CHILD_ORDER)}
    known_children = [
        node.tag.rsplit("}", 1)[-1]
        for node in list(root)
        if node.tag.startswith(f"{{{PRESENTATION_NS}}}")
        and node.tag.rsplit("}", 1)[-1] in order
    ]
    inversions = [
        (earlier, later)
        for earlier, later in zip(known_children, known_children[1:])
        if order[later] < order[earlier]
    ]
    if inversions:
        pairs = ", ".join(f"{earlier} before {later}" for earlier, later in inversions)
        errors.append(_err(
            "presentation-child-order",
            part,
            f"Known CT_Presentation children are out of sequence ({pairs}); expected relative order: {', '.join(PRESENTATION_CHILD_ORDER)}.",
            actual_order=known_children,
        ))


def _check_text_anchor_values(zf: zipfile.ZipFile, names: set[str], errors: list[dict[str, Any]]) -> None:
    eligible_parts = sorted(name for name in names if name.startswith("ppt/") and name.endswith(".xml"))
    for part in eligible_parts:
        root = _xml(zf, part, errors)
        if root is None:
            continue
        slide_match = re.fullmatch(r"ppt/slides/slide(\d+)\.xml", part)
        slide_info = {"slide": int(slide_match.group(1))} if slide_match else {}
        for node in root.iter():
            if node.tag not in {f"{{{MAIN_NS}}}tcPr", f"{{{MAIN_NS}}}bodyPr"}:
                continue
            value = node.get("anchor")
            if value is not None and value not in TEXT_ANCHOR_VALUES:
                element = node.tag.rsplit("}", 1)[-1]
                errors.append(_err(
                    "invalid-text-anchor",
                    part,
                    f"a:{element} anchor value {value!r} is invalid; expected one of {', '.join(sorted(TEXT_ANCHOR_VALUES))}.",
                    element=f"a:{element}",
                    value=value,
                    **slide_info,
                ))


def _object_context(node: ET.Element, parents: dict[ET.Element, ET.Element], part: str) -> dict[str, Any]:
    """Return nearby native shape identity for an actionable finding."""
    context: dict[str, Any] = {}
    slide_match = re.fullmatch(r"ppt/slides/slide(\d+)\.xml", part)
    if slide_match:
        context["slide"] = int(slide_match.group(1))
    current: ET.Element | None = node
    while current is not None:
        if current.tag == f"{{{PRESENTATION_NS}}}sp":
            nonvisual = current.find(f"{{{PRESENTATION_NS}}}nvSpPr/{{{PRESENTATION_NS}}}cNvPr")
            if nonvisual is not None:
                if nonvisual.get("id") is not None:
                    context["shape_id"] = nonvisual.get("id")
                if nonvisual.get("name") is not None:
                    context["shape_name"] = nonvisual.get("name")
            break
        current = parents.get(current)
    return context


def _check_text_body_paragraphs_and_spacing(zf: zipfile.ZipFile, names: set[str], errors: list[dict[str, Any]]) -> None:
    """Catch two PowerPoint schema failures that survived ordinary previews.

    Only text shapes that actually contain p:txBody are checked for a direct
    a:p child. Shapes without a text body are valid. Paragraph spacing nodes
    are compared by their relative order while all other pPr children retain
    their original positions and are ignored by this focused rule.
    """
    eligible_parts = sorted(name for name in names if name.startswith("ppt/") and name.endswith(".xml"))
    p_sp = f"{{{PRESENTATION_NS}}}sp"
    p_tx_body = f"{{{PRESENTATION_NS}}}txBody"
    a_p = f"{{{MAIN_NS}}}p"
    a_p_pr = f"{{{MAIN_NS}}}pPr"
    spacing_tags = {f"{{{MAIN_NS}}}{name}" for name in _PARAGRAPH_SPACING_ORDER}

    for part in eligible_parts:
        root = _xml(zf, part, errors)
        if root is None:
            continue
        parents = {child: parent for parent in root.iter() for child in list(parent)}
        for shape in root.iter(p_sp):
            tx_body = shape.find(p_tx_body)
            if tx_body is None:
                continue
            if not any(child.tag == a_p for child in list(tx_body)):
                errors.append(_err(
                    "text-body-paragraph-missing",
                    part,
                    "p:txBody has no direct a:p paragraph; a text body must contain at least one paragraph.",
                    element="p:txBody",
                    **_object_context(shape, parents, part),
                ))

        for p_pr in root.iter(a_p_pr):
            spacing = [child.tag for child in list(p_pr) if child.tag in spacing_tags]
            ranks = [_PARAGRAPH_SPACING_ORDER[tag.rsplit("}", 1)[-1]] for tag in spacing]
            if any(before > after for before, after in zip(ranks, ranks[1:])):
                actual_order = [tag.rsplit("}", 1)[-1] for tag in spacing]
                errors.append(_err(
                    "paragraph-spacing-order",
                    part,
                    "a:pPr spacing children must follow the relative order a:lnSpc, a:spcBef, a:spcAft.",
                    element="a:pPr",
                    actual_order=actual_order,
                    expected_order=["lnSpc", "spcBef", "spcAft"],
                    **_object_context(p_pr, parents, part),
                ))


def _check_nonvisual_ids(zf: zipfile.ZipFile, names: set[str], errors: list[dict[str, Any]]) -> None:
    for part in sorted(name for name in names if name.endswith(".xml") and not name.startswith("docProps/")):
        root = _xml(zf, part, errors)
        if root is None:
            continue
        seen: dict[str, int] = {}
        for node in root.iter():
            if node.tag.rsplit("}", 1)[-1] != "cNvPr":
                continue
            object_id = node.get("id")
            if not object_id:
                errors.append(_err("nonvisual-id-missing", part, "A cNvPr node is missing its id."))
                continue
            if object_id in seen:
                errors.append(_err("duplicate-nonvisual-id", part, f"cNvPr id {object_id!r} is repeated in this XML part."))
            seen[object_id] = seen.get(object_id, 0) + 1


def _check_chart_axes(zf: zipfile.ZipFile, names: set[str], errors: list[dict[str, Any]]) -> None:
    for part in sorted(name for name in names if re.fullmatch(r"ppt/charts/chart[^/]+\.xml", name)):
        root = _xml(zf, part, errors)
        if root is None:
            continue
        for plot_area in root.findall(".//c:plotArea", NS):
            children = list(plot_area)
            axis_ids: dict[str, str] = {}
            for node in children:
                axis_type = node.tag.rsplit("}", 1)[-1]
                if axis_type not in _AXIS_TYPES:
                    continue
                axis_id = node.find("c:axId", NS)
                if axis_id is None or not axis_id.get("val"):
                    errors.append(_err("chart-axis-id-missing", part, f"Chart axis {axis_type} is missing its id."))
                    continue
                value = axis_id.get("val", "")
                if value in axis_ids:
                    errors.append(_err("duplicate-chart-axis-id", part, f"Axis id {value!r} is used by multiple axis definitions."))
                axis_ids[value] = axis_type

            for group in children:
                group_type = group.tag.rsplit("}", 1)[-1]
                if group_type not in _CHART_GROUPS:
                    continue
                # Validate only references the package actually emits. This
                # preserves 3D/secondary-axis combinations and does not impose
                # an axis count on charts such as pie/doughnut.
                for axis in group.findall("c:axId", NS):
                    axis_ref = axis.get("val", "")
                    if axis_ref not in axis_ids:
                        errors.append(_err("chart-axis-reference-missing", part, f"Chart group {group_type} references undefined axis id {axis_ref!r}."))

            for axis in children:
                axis_type = axis.tag.rsplit("}", 1)[-1]
                if axis_type not in _AXIS_TYPES:
                    continue
                cross = axis.find("c:crossAx", NS)
                if cross is not None and cross.get("val") and cross.get("val") not in axis_ids:
                    errors.append(_err("chart-cross-axis-reference-missing", part, f"Axis {axis_type} references undefined cross-axis id {cross.get('val')!r}."))


def _valid_cell_ref(value: str) -> bool:
    match = _CELL_REF.fullmatch(value)
    if not match:
        return False
    column = 0
    for char in match.group(1).upper():
        column = column * 26 + ord(char) - ord("A") + 1
    return column <= 16384 and int(match.group(2)) <= 1048576


def _valid_range_ref(value: str) -> bool:
    match = _RANGE_REF.fullmatch(value)
    if not match or not _valid_cell_ref(match.group(1)):
        return False
    return not match.group(2) or _valid_cell_ref(match.group(2))


def _check_embedded_workbooks(zf: zipfile.ZipFile, names: set[str], errors: list[dict[str, Any]]) -> None:
    for workbook_part in sorted(name for name in names if name.startswith("ppt/embeddings/") and name.lower().endswith(".xlsx")):
        try:
            workbook_bytes = zf.read(workbook_part)
            from io import BytesIO

            with zipfile.ZipFile(BytesIO(workbook_bytes)) as workbook:
                for table_part in sorted(name for name in workbook.namelist() if re.fullmatch(r"xl/tables/table[^/]+\.xml", name)):
                    try:
                        table_root = ET.fromstring(workbook.read(table_part))
                    except (ET.ParseError, UnicodeDecodeError) as exc:
                        errors.append(_err("embedded-table-invalid-xml", f"{workbook_part}!{table_part}", f"Table XML cannot be parsed: {exc}"))
                        continue
                    for attr in ("ref",):
                        value = table_root.get(attr)
                        if value and not _valid_range_ref(value):
                            errors.append(_err("embedded-table-range-invalid", f"{workbook_part}!{table_part}", f"Table {attr} is not a valid single-cell or rectangular A1 range: {value!r}."))
                    for node in table_root.iter():
                        if node.tag.rsplit("}", 1)[-1] == "autoFilter":
                            value = node.get("ref")
                            if value and not _valid_range_ref(value):
                                errors.append(_err("embedded-autofilter-range-invalid", f"{workbook_part}!{table_part}", f"autoFilter ref is not a valid single-cell or rectangular A1 range: {value!r}."))
                for sheet_part in sorted(name for name in workbook.namelist() if re.fullmatch(r"xl/worksheets/[^/]+\.xml", name)):
                    try:
                        sheet_root = ET.fromstring(workbook.read(sheet_part))
                    except (ET.ParseError, UnicodeDecodeError) as exc:
                        errors.append(_err("embedded-sheet-invalid-xml", f"{workbook_part}!{sheet_part}", f"Worksheet XML cannot be parsed: {exc}"))
                        continue
                    for node in sheet_root.iter():
                        if node.tag.rsplit("}", 1)[-1] == "autoFilter":
                            value = node.get("ref")
                            if value and not _valid_range_ref(value):
                                errors.append(_err("embedded-autofilter-range-invalid", f"{workbook_part}!{sheet_part}", f"autoFilter ref is not a valid single-cell or rectangular A1 range: {value!r}."))
        except (zipfile.BadZipFile, OSError, KeyError) as exc:
            errors.append(_err("embedded-workbook-invalid", workbook_part, f"Embedded workbook cannot be read as an XLSX package: {exc}"))


def check_package(zf: zipfile.ZipFile) -> list[dict[str, Any]]:
    """Return compatibility findings for a PPTX ZipFile, without mutating it."""
    names = set(zf.namelist())
    errors: list[dict[str, Any]] = []
    _check_content_types(zf, names, errors)
    _check_relationships(zf, names, errors)
    _check_presentation_child_order(zf, names, errors)
    _check_text_anchor_values(zf, names, errors)
    _check_text_body_paragraphs_and_spacing(zf, names, errors)
    _check_nonvisual_ids(zf, names, errors)
    _check_chart_axes(zf, names, errors)
    _check_embedded_workbooks(zf, names, errors)
    return errors


def check_file(path: str) -> list[dict[str, Any]]:
    with zipfile.ZipFile(path) as zf:
        return check_package(zf)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pptx", help="PPTX package to inspect (read-only).")
    parser.add_argument("--json-report", help="Optional output JSON report path.")
    args = parser.parse_args()
    try:
        errors = check_file(args.pptx)
    except (OSError, zipfile.BadZipFile) as exc:
        errors = [_err("invalid-package", args.pptx, f"PPTX is not a readable ZIP package: {exc}")]
    report = {"schema_version": 1, "tool": "pptx_package_checks", "input": args.pptx,
              "ok": not errors, "errors": errors, "scope": "focused OPC and chart/workbook checks; not a complete ECMA-376 schema validation"}
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.json_report:
        try:
            with open(args.json_report, "w", encoding="utf-8") as stream:
                stream.write(rendered + "\n")
        except OSError as exc:
            print(f"ERROR: cannot write JSON report: {exc}", file=sys.stderr)
            return 2
    print(rendered)
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
