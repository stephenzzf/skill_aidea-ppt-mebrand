#!/usr/bin/env python3
"""Read-only validation for a translated PPTX and its source/mapping evidence."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import posixpath
import re
import sys
import zipfile
from collections import defaultdict
from pathlib import Path
from typing import Any

from lxml import etree

import translate_pptx as engine
import translation_adaptations as adaptations


def _c14n(root: etree._Element) -> bytes:
    return etree.tostring(root, method="c14n", exclusive=False, with_comments=True)


def _parse(data: bytes):
    return etree.fromstring(data, parser=etree.XMLParser(resolve_entities=False, no_network=True))


def _related_parts(package: zipfile.ZipFile, part: str, relationship_type: str) -> list[str]:
    folder, basename = posixpath.split(part)
    rel_part = posixpath.join(folder, "_rels", basename + ".rels")
    if rel_part not in package.namelist():
        return []
    root = _parse(package.read(rel_part))
    targets = []
    for rel in root.xpath("./rel:Relationship", namespaces=engine.NS):
        if rel.get("Type", "").rsplit("/", 1)[-1] != relationship_type:
            continue
        target = rel.get("Target", "")
        targets.append(target.lstrip("/") if target.startswith("/") else posixpath.normpath(posixpath.join(folder, target)))
    return targets


def _paragraph_shape(root, paragraph_index: int):
    paragraphs = root.xpath(".//a:p", namespaces=engine.NS)
    if paragraph_index >= len(paragraphs):
        return None, None
    paragraph = paragraphs[paragraph_index]
    owner = paragraph
    while owner is not None:
        if owner.tag in {
            f"{{{engine.NS_P}}}sp",
            f"{{{engine.NS_P}}}graphicFrame",
        }:
            break
        owner = owner.getparent()
    return paragraph, owner


def _placeholder_key(shape) -> tuple[str, str] | None:
    if shape is None:
        return None
    placeholders = shape.xpath("./p:nvSpPr/p:nvPr/p:ph", namespaces=engine.NS)
    if not placeholders:
        return None
    ph = placeholders[0]
    return (ph.get("type", "obj"), ph.get("idx", "0"))


def _visible_layout_unit_ids(package: zipfile.ZipFile, extraction: dict[str, Any]) -> set[str]:
    """Exclude only relationship-unreferenced layouts and editing prompts.

    A layout placeholder with customPrompt is authoring guidance, not slide
    content. Static text on a referenced layout/master remains in the visible
    set and must be translated if it contains Chinese.
    """
    names = set(package.namelist())
    slide_parts = sorted(name for name in names if re.fullmatch(r"ppt/slides/slide\d+\.xml", name))
    slide_layouts: dict[str, list[str]] = {}
    layout_masters: dict[str, list[str]] = {}
    used_layouts: set[str] = set()
    used_masters: set[str] = set()
    slide_roots = {}
    for slide in slide_parts:
        try:
            slide_roots[slide] = _parse(package.read(slide))
        except etree.XMLSyntaxError:
            continue
        layouts = [part for part in _related_parts(package, slide, "slideLayout") if part in names]
        slide_layouts[slide] = layouts
        used_layouts.update(layouts)
    for layout in used_layouts:
        masters = [part for part in _related_parts(package, layout, "slideMaster") if part in names]
        layout_masters[layout] = masters
        used_masters.update(masters)

    visible = set()
    for unit in extraction["units"]:
        kind, part = unit["kind"], unit["part"]
        if kind == "notes-master":
            continue
        if kind not in {"slide-layout", "slide-master"}:
            visible.add(unit["id"])
            continue
        if kind == "slide-layout" and part not in used_layouts:
            continue
        if kind == "slide-master" and part not in used_masters:
            continue
        root = _parse(package.read(part))
        _, owner = _paragraph_shape(root, unit["locator"]["index"])
        if owner is None:
            continue
        # Graphic-frame text (most commonly native table cells) has no p:sp
        # placeholder to override. If its layout/master is referenced, it is
        # static visible content and must stay in translation coverage.
        if owner.tag == f"{{{engine.NS_P}}}graphicFrame":
            visible.add(unit["id"])
            continue
        placeholder = _placeholder_key(owner)
        if placeholder is None:
            visible.add(unit["id"])
            continue
        ph = owner.xpath("./p:nvSpPr/p:nvPr/p:ph", namespaces=engine.NS)[0]
        if ph.get("hasCustomPrompt") == "1":
            continue
        # A child slide/layout placeholder supplies the text shown at runtime;
        # the template's example text is not visible when a child overrides it.
        consumers = []
        if kind == "slide-layout":
            consumers = [slide_roots[s] for s, layouts in slide_layouts.items() if part in layouts and s in slide_roots]
        else:
            layouts = [layout for layout, masters in layout_masters.items() if part in masters]
            consumers = [slide_roots[s] for s, used in slide_layouts.items() if any(layout in used for layout in layouts) and s in slide_roots]
        overridden = False
        for child_root in consumers:
            matches = child_root.xpath(".//p:sp[p:nvSpPr/p:nvPr/p:ph]", namespaces=engine.NS)
            for child_shape in matches:
                if _placeholder_key(child_shape) == placeholder and "".join(child_shape.xpath(".//a:t/text()", namespaces=engine.NS)).strip():
                    overridden = True
                    break
            if overridden:
                break
        if not overridden:
            visible.add(unit["id"])
    return visible


def _normalize_presentation_parts(source_zip: zipfile.ZipFile, candidate_zip: zipfile.ZipFile,
                                  extraction: dict[str, Any], mapping_units: dict[str, dict[str, Any]],
                                  errors: list[str]) -> None:
    source_names = set(source_zip.namelist())
    candidate_names = set(candidate_zip.namelist())
    if source_names != candidate_names:
        errors.append(f"PPTX package member list changed: +{sorted(candidate_names-source_names)[:4]} -{sorted(source_names-candidate_names)[:4]}")
        return
    units_by_part: dict[str, list[dict[str, Any]]] = defaultdict(list)
    embedded_workbook_parts = {u["locator"]["workbook_part"] for u in extraction["units"] if u["kind"] == "chart-workbook-cell"}
    for unit in extraction["units"]:
        if unit["kind"] == "chart-workbook-cell":
            continue
        units_by_part[unit["part"]].append(unit)
    for name in sorted(source_names):
        if name in embedded_workbook_parts:
            continue
        original = source_zip.read(name)
        candidate = candidate_zip.read(name)
        units = units_by_part.get(name, [])
        translated_units = [u for u in units if mapping_units[u["id"]]["status"] == "translated"]
        if not translated_units:
            if original != candidate:
                errors.append(f"unmapped package payload changed: {name}")
            continue
        try:
            before = _parse(original)
            after = _parse(candidate)
        except etree.XMLSyntaxError:
            errors.append(f"translated part is not valid XML: {name}")
            continue
        before_paragraphs = before.xpath(".//a:p", namespaces=engine.NS)
        after_paragraphs = after.xpath(".//a:p", namespaces=engine.NS)
        before_chart_values = before.xpath(".//c:strCache//c:pt/c:v|.//c:multiLvlStrCache//c:pt/c:v", namespaces=engine.NS)
        after_chart_values = after.xpath(".//c:strCache//c:pt/c:v|.//c:multiLvlStrCache//c:pt/c:v", namespaces=engine.NS)
        structural_errors = []
        for unit in units:
            entry = mapping_units[unit["id"]]
            locator = unit.get("locator", {})
            if locator.get("type") == "paragraph":
                idx = locator["index"]
                if idx >= len(before_paragraphs) or idx >= len(after_paragraphs):
                    structural_errors.append(f"paragraph locator missing: {unit['id']}")
                    continue
                old_nodes = before_paragraphs[idx].xpath(".//a:t", namespaces=engine.NS)
                new_nodes = after_paragraphs[idx].xpath(".//a:t", namespaces=engine.NS)
            elif locator.get("type") == "chart-v":
                idx = locator["index"]
                if idx >= len(before_chart_values) or idx >= len(after_chart_values):
                    structural_errors.append(f"chart cache locator missing: {unit['id']}")
                    continue
                old_nodes, new_nodes = [before_chart_values[idx]], [after_chart_values[idx]]
            else:
                continue
            expected_old = unit["segments"]
            actual_new = [node.text or "" for node in new_nodes]
            expected_new = entry["segments"]
            if [node.text or "" for node in old_nodes] != expected_old:
                structural_errors.append(f"source no longer matches extraction evidence: {unit['id']}")
            if actual_new != expected_new:
                structural_errors.append(f"candidate text does not match mapping: {unit['id']}")
            if len(old_nodes) != len(new_nodes):
                structural_errors.append(f"text run count changed: {unit['id']}")
            else:
                for old_node, new_node, original_text in zip(old_nodes, new_nodes, expected_old):
                    new_node.text = original_text
        if structural_errors:
            errors.extend(structural_errors)
            continue
        if _c14n(before) != _c14n(after):
            errors.append(f"non-text OOXML structure, geometry or formatting changed: {name}")


def _read_workbook_text(package_bytes: bytes, sheet_path: str, address: str) -> str | None:
    with zipfile.ZipFile(__import__("io").BytesIO(package_bytes)) as book:
        if sheet_path not in book.namelist():
            return None
        sheet = _parse(book.read(sheet_path))
        cells = sheet.xpath(".//x:c[@r=$ref]", namespaces=engine.NS, ref=address)
        if len(cells) != 1:
            return None
        cell = cells[0]
        if cell.get("t") == "s":
            v = cell.find(f"{{{engine.NS_XL}}}v")
            if v is None or not (v.text or "").isdigit() or "xl/sharedStrings.xml" not in book.namelist():
                return None
            strings = _parse(book.read("xl/sharedStrings.xml"))
            index = int(v.text)
            entries = strings.xpath("./x:si", namespaces=engine.NS)
            if index >= len(entries):
                return None
            return "".join(entries[index].xpath(".//x:t/text()", namespaces=engine.NS))
        return "".join(cell.xpath("./x:is//x:t/text()", namespaces=engine.NS))


def _check_workbook_contract(source_zip: zipfile.ZipFile, candidate_zip: zipfile.ZipFile,
                             extraction: dict[str, Any], mapping_units: dict[str, dict[str, Any]],
                             errors: list[str]) -> None:
    workbook_units = [u for u in extraction["units"] if u["kind"] == "chart-workbook-cell"]
    workbook_parts = sorted({u["locator"]["workbook_part"] for u in workbook_units})
    for wb_part in workbook_parts:
        if wb_part not in source_zip.namelist() or wb_part not in candidate_zip.namelist():
            errors.append(f"embedded chart workbook missing: {wb_part}")
            continue
        old_blob = source_zip.read(wb_part)
        new_blob = candidate_zip.read(wb_part)
        if old_blob == new_blob:
            for unit in workbook_units:
                if unit["locator"]["workbook_part"] == wb_part and mapping_units[unit["id"]]["status"] == "translated" and "".join(mapping_units[unit["id"]]["segments"]) != unit["source_text"]:
                    errors.append(f"translated chart label was not written to embedded workbook: {unit['id']}")
            continue
        with zipfile.ZipFile(__import__("io").BytesIO(old_blob)) as old_book, zipfile.ZipFile(__import__("io").BytesIO(new_blob)) as new_book:
            if set(old_book.namelist()) != set(new_book.namelist()):
                errors.append(f"embedded workbook package members changed: {wb_part}")
                continue
            target_keys = {(u["locator"]["sheet_path"], u["locator"]["cell"]): u for u in workbook_units if u["locator"]["workbook_part"] == wb_part}
            for part in old_book.namelist():
                if not part.endswith(".xml") or not (part.startswith("xl/worksheets/") or part == "xl/workbook.xml" or part == "xl/_rels/workbook.xml.rels"):
                    if old_book.read(part) != new_book.read(part):
                        errors.append(f"non-text workbook part changed: {wb_part}!{part}")
                elif part.startswith("xl/worksheets/"):
                    old_root, new_root = _parse(old_book.read(part)), _parse(new_book.read(part))
                    old_cells = {cell.get("r"): cell for cell in old_root.xpath(".//x:c", namespaces=engine.NS)}
                    new_cells = {cell.get("r"): cell for cell in new_root.xpath(".//x:c", namespaces=engine.NS)}
                    if set(old_cells) != set(new_cells):
                        errors.append(f"workbook cell structure changed: {wb_part}!{part}")
                        continue
                    for (sheet_path, address), unit in target_keys.items():
                        if sheet_path != part:
                            continue
                        old_cell, new_cell = old_cells.get(address), new_cells.get(address)
                        actual = _read_workbook_text(new_blob, part, address)
                        expected = "".join(mapping_units[unit["id"]]["segments"])
                        if actual != expected:
                            errors.append(f"embedded workbook string does not match translation: {unit['id']}")
                        if old_cell is None or new_cell is None:
                            errors.append(f"embedded workbook cell missing: {unit['id']}")
                            continue
                        new_cell.getparent().replace(new_cell, copy.deepcopy(old_cell))
                    if _c14n(old_root) != _c14n(new_root):
                        errors.append(f"workbook cell data, formulas, formatting or geometry changed: {wb_part}!{part}")
                else:
                    if _c14n(_parse(old_book.read(part))) != _c14n(_parse(new_book.read(part))):
                        errors.append(f"workbook definition/relationship changed: {wb_part}!{part}")


def verify_translation(source_pptx: str | Path, pptx: str | Path, mapping_path: str | Path,
                       report_path: str | Path | None = None,
                       adaptations_path: str | Path | None = None) -> dict[str, Any]:
    errors: list[str] = []
    source_path, candidate_path = Path(source_pptx), Path(pptx)
    if not source_path.is_file() or not candidate_path.is_file():
        return {"status": "fail", "errors": ["source or candidate PPTX is missing"], "checks": {}}
    try:
        extraction = engine.extract_pptx(source_path)
        mapping = engine._load_json(mapping_path)
        mapping_units, map_errors = engine._check_mapping(extraction, mapping)
        errors.extend(map_errors)
        source_hash = hashlib.sha256(source_path.read_bytes()).hexdigest()
        candidate_hash = hashlib.sha256(candidate_path.read_bytes()).hexdigest()
        if source_hash != extraction["source_sha256"]:
            errors.append("source hash changed during QA")
        report = engine._load_json(report_path) if report_path else None
        adaptation_report = None
        if adaptations_path:
            adaptation_report = adaptations.validate_adaptations(source_path, candidate_path, mapping_path, adaptations_path)
            if adaptation_report["status"] != "pass":
                errors.extend(f"translation adaptation: {item}" for item in adaptation_report["errors"])
        if report:
            if report.get("source_sha256") != source_hash:
                errors.append("apply report source hash does not match source")
            expected_output_hash = adaptation_report.get("apply_baseline_sha256") if adaptation_report else candidate_hash
            if report.get("output_sha256") != expected_output_hash:
                errors.append("apply report output hash does not match translation baseline")
            if report.get("mapping_sha256") != hashlib.sha256(Path(mapping_path).read_bytes()).hexdigest():
                errors.append("apply report mapping hash does not match mapping")
        with zipfile.ZipFile(source_path) as source_zip, zipfile.ZipFile(candidate_path) as candidate_zip:
            if not adaptations_path:
                _normalize_presentation_parts(source_zip, candidate_zip, extraction, mapping_units, errors)
            _check_workbook_contract(source_zip, candidate_zip, extraction, mapping_units, errors)
            current_inventory = engine._collect_inventory(candidate_zip.namelist(), candidate_zip)
            visible_unit_ids = _visible_layout_unit_ids(source_zip, extraction)
        source_inventory = extraction["inventory"]
        for key in ("slides", "media_parts", "smartart_parts", "embedded_objects"):
            if current_inventory.get(key) != source_inventory.get(key):
                errors.append(f"asset/content inventory changed: {key}")
        unsupported_candidates = (
            source_inventory.get("unsupported_visible_text_candidates", [])
            + current_inventory.get("unsupported_visible_text_candidates", [])
        )
        unsupported_errors = (
            engine._unsupported_inventory_errors(source_inventory)
            + engine._unsupported_inventory_errors(current_inventory)
        )
        for error in unsupported_errors:
            if error not in errors:
                errors.append(error)
        translated_han = []
        for unit in extraction["units"]:
            if unit["id"] not in visible_unit_ids:
                continue
            entry = mapping_units.get(unit["id"])
            if entry and entry.get("status") == "translated" and re.search(r"[\u3400-\u9fff]", "".join(entry.get("segments", []))):
                translated_han.append(unit["id"])
            elif entry and entry.get("status") == "preserve" and re.search(r"[\u3400-\u9fff]", unit["source_text"]):
                translated_han.append(unit["id"])
        if translated_han:
            errors.append(f"Chinese remains in translatable/preserved text units: {len(translated_han)}; examples: {translated_han[:8]}")
        checks = {
            "source_hash": "pass" if source_hash == extraction["source_sha256"] else "fail",
            "mapping_completeness": "pass" if not map_errors else "fail",
            "package_members_and_part_payloads": "pass" if not any("package member" in e or "unmapped package payload" in e for e in errors) else "fail",
            "ooxml_structure_geometry_formatting": "pass" if not any("OOXML structure" in e or "XML" in e or "locator" in e for e in errors) else "fail",
            "embedded_workbook": "pass" if not any("workbook" in e for e in errors) else "fail",
            "translated_text_coverage": "pass" if not translated_han and not unsupported_candidates else "fail",
            "unsupported_visible_content": "pass" if not unsupported_candidates else "fail",
            "report_hash_binding": "pass" if not report or not any("report" in e for e in errors) else "fail",
            "authorized_post_translation_adaptations": "pass" if not adaptations_path or adaptation_report["status"] == "pass" else "fail",
        }
        return {
            "schema_version": 1, "status": "pass" if not errors else "fail", "errors": errors,
            "source_sha256": source_hash, "candidate_sha256": candidate_hash,
            "unit_count": len(extraction["units"]), "translated_units": sum(1 for x in mapping_units.values() if x.get("status") == "translated"),
            "preserved_units": sum(1 for x in mapping_units.values() if x.get("status") == "preserve"),
            "inventory": current_inventory, "checks": checks,
            "adaptations": ({"path": str(adaptations_path), **adaptation_report} if adaptations_path else None),
        }
    except (engine.TranslationError, OSError, zipfile.BadZipFile, etree.XMLSyntaxError) as exc:
        errors.append(str(exc))
        return {"schema_version": 1, "status": "fail", "errors": errors, "checks": {}}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-pptx", required=True)
    parser.add_argument("--pptx", required=True)
    parser.add_argument("--mapping", required=True)
    parser.add_argument("--report")
    parser.add_argument("--translation-adaptations")
    parser.add_argument("--out")
    args = parser.parse_args(argv)
    result = verify_translation(args.source_pptx, args.pptx, args.mapping, args.report, args.translation_adaptations)
    rendered = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.out:
        Path(args.out).write_text(rendered, encoding="utf-8")
    print(rendered, end="")
    return 0 if result["status"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
