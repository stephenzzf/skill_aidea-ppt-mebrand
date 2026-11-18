#!/usr/bin/env python3
"""Build and validate narrowly authorized translation layout/localization changes.

This module does not translate or approve content. It binds a post-apply deck to
the deterministic translation baseline and permits only registered layout
attributes plus explicitly registered native text/overlay shapes.
"""

from __future__ import annotations

import hashlib
import copy
import json
import posixpath
import re
import zipfile
from pathlib import Path
from typing import Any

from lxml import etree

import translate_pptx as engine

NS = engine.NS
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
LAYOUT_ATTRIBUTES = {
    ("a:off", "x"), ("a:off", "y"), ("a:ext", "cx"), ("a:ext", "cy"),
    ("a:bodyPr", "anchor"), ("a:bodyPr", "vert"), ("a:bodyPr", "wrap"),
    ("a:bodyPr", "horzOverflow"), ("a:bodyPr", "vertOverflow"),
    ("a:bodyPr", "lIns"), ("a:bodyPr", "rIns"), ("a:bodyPr", "tIns"), ("a:bodyPr", "bIns"),
    ("a:pPr", "marL"), ("a:pPr", "indent"), ("a:pPr", "algn"),
    ("a:pPr", "latinLnBrk"), ("a:pPr", "eaLnBrk"),
    ("a:rPr", "sz"), ("a:defRPr", "sz"), ("a:endParaRPr", "sz"),
    ("a:rPr", "spc"), ("a:defRPr", "spc"), ("a:endParaRPr", "spc"),
    ("a:spcPct", "val"), ("a:spcPts", "val"),
    ("a:latin", "typeface"), ("a:ea", "typeface"), ("a:cs", "typeface"),
}
REMOVABLE_ATTRIBUTES = {("a:bodyPr", "horzOverflow"), ("a:bodyPr", "vertOverflow")}
REMOVABLE_NODES = {"a:spAutoFit", "a:normAutofit", "a:noAutofit"}
TRANSLATION_DISCLOSURES = {
    "Translated labels over source screenshots",
    "Editable English reconstruction of the source diagram",
    "Source UI screenshot — embedded labels are too small to verify",
}
CHINESE_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")


class AdaptationError(ValueError):
    pass


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def image_journal_to_localization_plan(image_journal: dict[str, Any]) -> dict[str, Any]:
    """Convert an image-localization journal into the strict adaptation schema.

    Shape IDs and source text are read from the journal on each invocation; no
    IDs or translations are inferred from prior outputs. The adapter accepts
    the current ``slides -> new_shapes`` journal shape and reads source text
    from either the shape record or its nested ``note`` object.
    """
    slides = image_journal.get("slides") if isinstance(image_journal, dict) else None
    if not isinstance(slides, (dict, list)):
        raise AdaptationError("image journal must contain slides with new_shapes")

    disclosure_by_normalized = {value.rstrip("."): value for value in TRANSLATION_DISCLOSURES}
    if isinstance(slides, dict):
        slide_items = list(slides.items())
    else:
        slide_items = [(row.get("slide"), row) for row in slides if isinstance(row, dict)]

    localizations = []
    for slide_key, slide_row in sorted(slide_items, key=lambda item: int(item[0])):
        if not isinstance(slide_row, dict):
            raise AdaptationError(f"image journal slide {slide_key} must be an object")
        try:
            slide_number = int(slide_key)
        except (TypeError, ValueError) as exc:
            raise AdaptationError(f"invalid image journal slide number: {slide_key!r}") from exc
        shapes = slide_row.get("new_shapes")
        if not isinstance(shapes, list):
            raise AdaptationError(f"image journal slide {slide_number} must contain new_shapes")

        objects = []
        source_media_parts = []
        for shape in shapes:
            if not isinstance(shape, dict):
                raise AdaptationError(f"image journal slide {slide_number} contains a malformed shape")
            note = shape.get("note") if isinstance(shape.get("note"), dict) else {}
            shape_id = shape.get("shape_id", shape.get("id"))
            if not isinstance(shape_id, int) or isinstance(shape_id, bool):
                raise AdaptationError(f"image journal slide {slide_number} contains a shape without an integer ID")
            text_value = shape.get("text", note.get("text", shape.get("translation", "")))
            if not isinstance(text_value, str):
                raise AdaptationError(f"image journal shape {shape_id} text must be a string")
            source_value = note.get("source_text", shape.get("source_text", ""))
            if not isinstance(source_value, str):
                raise AdaptationError(f"image journal shape {shape_id} source_text must be a string")

            raw_role = (note.get("role") or shape.get("overlay_role") or shape.get("role") or shape.get("kind") or "")
            normalized_role = str(raw_role).strip().lower().replace("_", "-").replace(" ", "-")
            disclosure = text_value.strip().removesuffix(".")
            if disclosure in disclosure_by_normalized:
                role = "annotation"
            elif normalized_role in {"mask", "caption-mask", "localization-mask"}:
                role = "mask"
            elif normalized_role in {"shape", "connector", "decoration", "reconstruction-shape"}:
                role = "decoration"
            elif normalized_role in {"annotation", "translation-disclosure"}:
                role = "annotation"
            elif normalized_role in {"editable-text", "localized-text", "editable-caption", "translation", "localized-caption", "text"}:
                role = "localized-text"
            else:
                raise AdaptationError(f"unsupported image journal role/kind {raw_role!r} for shape {shape_id}")

            row: dict[str, Any] = {"id": shape_id, "role": role, "text": text_value}
            if role == "localized-text":
                if not source_value.strip():
                    raise AdaptationError(f"localized image journal shape {shape_id} has no exact source_text")
                row["source_text"] = source_value
            elif role == "annotation":
                row["annotation_type"] = "translation-disclosure"
                if source_value:
                    raise AdaptationError(f"translation disclosure shape {shape_id} cannot claim source_text")
            else:
                # Source labels belong to the adjacent editable-text object;
                # a mask or decorative primitive cannot claim to translate them.
                row["text"] = text_value
            reason = note.get("reason") or shape.get("reason") or slide_row.get("reason")
            if role in {"decoration", "annotation"}:
                if not reason:
                    method = note.get("method") or shape.get("method")
                    evidence = note.get("evidence") or shape.get("evidence_part")
                    detail = ", ".join(str(item) for item in (method, evidence) if item)
                    reason = f"Recorded {detail} in the image-localization journal." if detail else "Recorded native reconstruction or disclosure object in the image-localization journal."
                row["reason"] = str(reason)
            if role == "annotation":
                row["annotation_type"] = "translation-disclosure"
            objects.append(row)

            media_values = []
            for key in ("source_media_parts", "source_picture", "evidence_part"):
                value = note.get(key, shape.get(key))
                if isinstance(value, str):
                    media_values.extend(item.strip() for item in value.split(";") if item.strip())
                elif isinstance(value, list):
                    for item in value:
                        if isinstance(item, str):
                            media_values.extend(part.strip() for part in item.split(";") if part.strip())
            for part in media_values:
                if part.startswith("ppt/media/") and part not in source_media_parts:
                    source_media_parts.append(part)

        if objects:
            plan_media = slide_row.get("source_media_parts")
            if isinstance(plan_media, list):
                for part in plan_media:
                    if isinstance(part, str):
                        for media_part in (value.strip() for value in part.split(";") if value.strip()):
                            if media_part.startswith("ppt/media/") and media_part not in source_media_parts:
                                source_media_parts.append(media_part)
            reason = slide_row.get("reason") or f"Authorized image-text localization and editable reconstruction on slide {slide_number}."
            localizations.append({"part": f"ppt/slides/slide{slide_number}.xml", "reason": str(reason),
                                 "source_media_parts": source_media_parts, "objects": objects})

    media_visibility_changes = image_journal.get("media_visibility_changes", [])
    if not isinstance(media_visibility_changes, list):
        raise AdaptationError("image journal media_visibility_changes must be a list")
    return {"schema_version": 1, "localizations": localizations,
            "media_visibility_changes": media_visibility_changes}


def _parse(blob: bytes):
    return etree.fromstring(blob, parser=etree.XMLParser(resolve_entities=False, no_network=True))


def _c14n(root) -> bytes:
    return etree.tostring(root, method="c14n", exclusive=False, with_comments=True)


def _mapping_units(source: Path, mapping_path: Path):
    extraction = engine.extract_pptx(source)
    mapping = engine._load_json(mapping_path)
    units, errors = engine._check_mapping(extraction, mapping)
    if errors:
        raise AdaptationError("Invalid translation mapping: " + "; ".join(errors[:10]))
    return extraction, mapping, units


def _baseline_bytes(source: Path, extraction: dict[str, Any], units: dict[str, dict[str, Any]]) -> bytes:
    import io

    out = io.BytesIO()
    with zipfile.ZipFile(source) as src:
        package = {name: src.read(name) for name in src.namelist()}
        changed = engine._apply_xml_units(package, extraction, units)
        changed.update(engine._apply_workbook_units(src, extraction, units))
        with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as target:
            for info in src.infolist():
                target.writestr(info, changed.get(info.filename, package[info.filename]))
    return out.getvalue()


def _shape_nodes(root) -> dict[int, etree._Element]:
    result = {}
    for node in root.xpath(".//p:spTree/*[self::p:sp or self::p:pic or self::p:graphicFrame or self::p:grpSp or self::p:cxnSp]", namespaces=NS):
        ids = node.xpath("./p:nvSpPr/p:cNvPr/@id|./p:nvPicPr/p:cNvPr/@id|./p:nvGraphicFramePr/p:cNvPr/@id|./p:nvGrpSpPr/p:cNvPr/@id|./p:nvCxnSpPr/p:cNvPr/@id", namespaces=NS)
        if ids:
            try:
                object_id = int(ids[0])
            except ValueError as exc:
                raise AdaptationError(f"non-numeric OOXML shape ID: {ids[0]}") from exc
            result[object_id] = node
    return result


def _selector(node: etree._Element, shape: etree._Element) -> str:
    steps = []
    current = node
    while current is not shape:
        parent = current.getparent()
        if parent is None:
            raise AdaptationError("Cannot construct stable OOXML selector")
        qname = etree.QName(current)
        prefix = "a" if qname.namespace == engine.NS_A else "p" if qname.namespace == engine.NS_P else None
        if prefix is None:
            raise AdaptationError("Layout change selector contains an unsupported namespace")
        same = [child for child in parent if child.tag == current.tag]
        steps.append(f"{prefix}:{qname.localname}[{same.index(current)}]")
        current = parent
    return "/".join(reversed(steps))


def _selector_node(shape: etree._Element, selector: str) -> etree._Element:
    # Selectors are emitted by _selector and use only DrawingML/PresentationML
    # child paths. Indexing each child prevents a second run/style from aliasing.
    current = shape
    for component in selector.split("/"):
        match = re.fullmatch(r"([ap]):([A-Za-z0-9]+)\[(\d+)\]", component)
        if not match:
            raise AdaptationError(f"Invalid layout selector: {selector}")
        prefix, local, index = match.group(1), match.group(2), int(match.group(3))
        namespace = engine.NS_A if prefix == "a" else engine.NS_P
        candidates = [child for child in current if child.tag == f"{{{namespace}}}{local}"]
        if index >= len(candidates):
            raise AdaptationError(f"Layout selector no longer resolves: {selector}")
        current = candidates[index]
    return current


def _allowed_attribute(node: etree._Element, attribute: str) -> bool:
    qname = etree.QName(node)
    prefix = "a" if qname.namespace == engine.NS_A else "p" if qname.namespace == engine.NS_P else None
    return prefix is not None and (f"{prefix}:{qname.localname}", attribute) in LAYOUT_ATTRIBUTES


def _qname(node: etree._Element) -> str:
    name = etree.QName(node)
    prefix = "a" if name.namespace == engine.NS_A else "p" if name.namespace == engine.NS_P else None
    if prefix is None:
        raise AdaptationError("OOXML layout node uses an unsupported namespace")
    return f"{prefix}:{name.localname}"


def _no_text_or_relationships(node: etree._Element) -> bool:
    return not node.xpath(".//a:t|.//*[@r:id or @r:embed or @r:link]", namespaces=NS)


def _allowed_node_mutation(parent: etree._Element, node: etree._Element, operation: str) -> bool:
    """Small structural allowlist for typography/spacing/geometry-only nodes."""
    parent_name, name = _qname(parent), _qname(node)
    if not _no_text_or_relationships(node):
        return False
    if operation == "remove":
        return parent_name == "a:bodyPr" and name in REMOVABLE_NODES and not list(node)
    if operation != "add":
        return False
    attrs = set(node.attrib)
    children = [_qname(child) for child in node]
    if parent_name == "p:spPr" and name == "a:xfrm":
        if attrs or children != ["a:off", "a:ext"]:
            return False
        off, ext = list(node)
        return set(off.attrib) == {"x", "y"} and set(ext.attrib) == {"cx", "cy"} and not list(off) and not list(ext)
    if parent_name == "a:p" and name == "a:pPr":
        allowed_attrs = {"marL", "indent", "algn", "latinLnBrk", "eaLnBrk"}
        if not attrs <= allowed_attrs or not set(children) <= {"a:lnSpc", "a:spcAft", "a:spcBef"}:
            return False
        return all(_allowed_node_mutation(node, child, "add") for child in node)
    if parent_name == "a:bodyPr" and name == "a:noAutofit":
        return not attrs and not children
    if parent_name == "a:pPr" and name in {"a:lnSpc", "a:spcAft", "a:spcBef"}:
        return not attrs and len(children) == 1 and children[0] in {"a:spcPts", "a:spcPct"} and _allowed_node_mutation(node, list(node)[0], "add")
    if parent_name in {"a:lnSpc", "a:spcAft", "a:spcBef"} and name in {"a:spcPts", "a:spcPct"}:
        return set(node.attrib) == {"val"} and not children
    if parent_name == "a:r" and name == "a:rPr":
        if not attrs <= {"sz", "spc"} or not set(children) <= {"a:latin", "a:ea", "a:cs"}:
            return False
        return all(_allowed_node_mutation(node, child, "add") for child in node)
    if parent_name in {"a:rPr", "a:defRPr", "a:endParaRPr"} and name in {"a:latin", "a:ea", "a:cs"}:
        return set(node.attrib) == {"typeface"} and not children
    return False


def _lcs_pairs(before: list[etree._Element], after: list[etree._Element]) -> list[tuple[int, int]]:
    """Align unchanged-order children by expanded element name."""
    rows, cols = len(before), len(after)
    dp = [[0] * (cols + 1) for _ in range(rows + 1)]
    for i in range(rows - 1, -1, -1):
        for j in range(cols - 1, -1, -1):
            if before[i].tag == after[j].tag:
                dp[i][j] = 1 + dp[i + 1][j + 1]
            else:
                dp[i][j] = max(dp[i + 1][j], dp[i][j + 1])
    pairs = []
    i = j = 0
    while i < rows and j < cols:
        if before[i].tag == after[j].tag and dp[i][j] == 1 + dp[i + 1][j + 1]:
            pairs.append((i, j)); i += 1; j += 1
        elif dp[i + 1][j] >= dp[i][j + 1]:
            i += 1
        else:
            j += 1
    return pairs


def _node_selector(node: etree._Element, shape: etree._Element) -> tuple[str, int]:
    parent = node.getparent()
    if parent is None:
        raise AdaptationError("Cannot bind a detached layout node")
    parent_selector = _selector(parent, shape)
    return parent_selector, list(parent).index(node)


def _shape_text(shape: etree._Element) -> str:
    return "".join(shape.xpath(".//a:t/text()", namespaces=NS))


def _shape_bbox(shape: etree._Element) -> dict[str, int] | None:
    xfrm = shape.find("./p:spPr/a:xfrm", NS)
    if xfrm is None:
        xfrm = shape.find("./p:grpSpPr/a:xfrm", NS)
    if xfrm is None:
        return None
    off, ext = xfrm.find("./a:off", NS), xfrm.find("./a:ext", NS)
    if off is None or ext is None:
        return None
    try:
        return {"x": int(off.get("x")), "y": int(off.get("y")), "cx": int(ext.get("cx")), "cy": int(ext.get("cy"))}
    except (TypeError, ValueError):
        return None


def _shape_hash(shape: etree._Element) -> str:
    return sha256(_c14n(shape))


def _slide_image_parts(package: zipfile.ZipFile, part: str) -> set[str]:
    folder, basename = posixpath.split(part)
    rel_part = posixpath.join(folder, "_rels", basename + ".rels")
    if rel_part not in package.namelist():
        return set()
    root = _parse(package.read(rel_part))
    relation_targets = {}
    for rel in root.xpath("./rel:Relationship", namespaces=NS):
        if rel.get("Type", "").endswith("/image"):
            target = rel.get("Target", "")
            relation_targets[rel.get("Id", "")] = target.lstrip("/") if target.startswith("/") else posixpath.normpath(posixpath.join(folder, target))
    slide_root = _parse(package.read(part))
    used_ids = set(slide_root.xpath(".//a:blip/@r:embed|.//a:blip/@r:link", namespaces=NS))
    return {relation_targets[item] for item in used_ids if item in relation_targets}


def _picture_media_parts(package: zipfile.ZipFile, part: str, shape_id: int) -> list[str]:
    """Return only internal image parts referenced by one p:pic shape."""
    names = set(package.namelist())
    root = _parse(package.read(part))
    picture = _shape_nodes(root).get(shape_id)
    if picture is None or etree.QName(picture).namespace != engine.NS_P or etree.QName(picture).localname != "pic":
        return []
    image_relationship_ids = set(picture.xpath(".//a:blip/@r:embed|.//a:blip/@r:link", namespaces=NS))
    folder, basename = posixpath.split(part)
    rel_part = posixpath.join(folder, "_rels", basename + ".rels")
    if rel_part not in names:
        return []
    rel_root = _parse(package.read(rel_part))
    targets = set()
    for relation in rel_root.xpath("./rel:Relationship", namespaces=NS):
        rel_id = relation.get("Id", "")
        if rel_id not in image_relationship_ids or not relation.get("Type", "").endswith("/image"):
            continue
        if relation.get("TargetMode") == "External":
            continue
        target = relation.get("Target", "")
        resolved = target.lstrip("/") if target.startswith("/") else posixpath.normpath(posixpath.join(folder, target))
        if resolved in names:
            targets.add(resolved)
    return sorted(targets)


def _localized_shape_error(shape: etree._Element, row: dict[str, Any]) -> str | None:
    if etree.QName(shape).localname != "sp":
        return "localized object must be a native editable p:sp"
    if shape.xpath(".//a:blip|.//p:pic", namespaces=NS):
        return "localized native text object contains image content"
    if _shape_text(shape) != row.get("text", ""):
        return "localized object text does not match journal"
    bbox = _shape_bbox(shape)
    if bbox is None or bbox != row.get("bbox_emu"):
        return "localized object bounds do not match journal"
    if row.get("sha256") != _shape_hash(shape):
        return "localized object hash does not match journal"
    if row.get("role") == "localized-text":
        source_text = row.get("source_text")
        if not isinstance(source_text, str) or not source_text.strip():
            return "localized text requires the exact source text in the journal"
        if not row.get("text", "").strip():
            return "localized English text is empty"
        if CHINESE_RE.search(row["text"]):
            return "localized English text still contains Chinese characters"
        if engine._protected_identity_tokens(source_text) != engine._protected_identity_tokens(row["text"]):
            return "localized text changed a protected model, code, URL or currency token"
        if engine._numeric_signature(source_text) != engine._numeric_signature(row["text"]):
            return "localized text changed numeric facts or units"
    elif row.get("role") in {"mask", "decoration"}:
        if row.get("text") != "" or shape.xpath(".//a:t", namespaces=NS):
            return f"{row['role']} objects must contain no text"
        if row.get("source_text", "") not in {None, ""}:
            return f"{row['role']} objects cannot claim source text"
        if row.get("role") == "decoration" and (not isinstance(row.get("reason"), str) or not row["reason"].strip()):
            return "decoration objects require a reason"
    elif row.get("role") == "annotation":
        disclosure = row.get("text", "").strip().removesuffix(".")
        if row.get("annotation_type") != "translation-disclosure" or disclosure not in TRANSLATION_DISCLOSURES:
            return "annotation must use an approved fixed translation-disclosure sentence"
        if row.get("source_text", "") not in {None, ""}:
            return "translation disclosure cannot claim to translate source text"
        if not isinstance(row.get("reason"), str) or not row["reason"].strip():
            return "translation disclosure requires a reason"
    else:
        return "localized object role must be mask, decoration, localized-text or annotation"
    return None


def _reconstruct_and_normalize(source: Path, mapping_path: Path, candidate: Path,
                               journal: dict[str, Any], errors: list[str]) -> str:
    extraction, mapping, units = _mapping_units(source, mapping_path)
    source_hash = sha256(source.read_bytes())
    mapping_hash = sha256(mapping_path.read_bytes())
    candidate_hash = sha256(candidate.read_bytes())
    expected = {
        "schema_version": 1,
        "mode": "translation-post-layout",
        "source_sha256": source_hash,
        "mapping_sha256": mapping_hash,
        "apply_baseline_sha256": sha256(_baseline_bytes(source, extraction, units)),
        "candidate_sha256": candidate_hash,
    }
    for key, value in expected.items():
        if journal.get(key) != value:
            errors.append(f"translation adaptation journal {key} is stale or invalid")

    with zipfile.ZipFile(source) as source_zip, zipfile.ZipFile(candidate) as candidate_zip:
        source_names, candidate_names = set(source_zip.namelist()), set(candidate_zip.namelist())
        if source_names != candidate_names:
            errors.append("PPTX package member list changed during translation adaptation")
            return expected["apply_baseline_sha256"]
        baseline_blob = _baseline_bytes(source, extraction, units)
        import io
        with zipfile.ZipFile(io.BytesIO(baseline_blob)) as baseline_zip:
            baseline_names = set(baseline_zip.namelist())
            if baseline_names != candidate_names:
                errors.append("candidate package members differ from deterministic translation baseline")
                return expected["apply_baseline_sha256"]
            layout_rows = journal.get("layout_changes", [])
            layout_node_rows = journal.get("layout_nodes", [])
            localization_rows = journal.get("localizations", [])
            visibility_rows = journal.get("media_visibility_changes", [])
            if not all(isinstance(rows, list) for rows in (layout_rows, layout_node_rows, localization_rows, visibility_rows)):
                errors.append("translation adaptation journal change lists must be arrays")
                return expected["apply_baseline_sha256"]

            layouts_by_part: dict[str, list[dict[str, Any]]] = {}
            layout_nodes_by_part: dict[str, list[dict[str, Any]]] = {}
            localizations_by_part: dict[str, list[dict[str, Any]]] = {}
            visibility_by_part: dict[str, list[dict[str, Any]]] = {}
            seen_visibility: set[tuple[str, int]] = set()
            for row in layout_rows:
                if (not isinstance(row, dict) or row.get("part") not in candidate_names or not isinstance(row.get("shape_id"), int)
                        or not isinstance(row.get("selector"), str) or not isinstance(row.get("attribute"), str)):
                    errors.append("invalid layout change record")
                    continue
                layouts_by_part.setdefault(row["part"], []).append(row)
            for row in layout_node_rows:
                if (not isinstance(row, dict) or row.get("part") not in candidate_names or not isinstance(row.get("shape_id"), int)
                        or row.get("operation") not in {"add", "remove"} or not isinstance(row.get("parent_selector"), str)
                        or not isinstance(row.get("position"), int) or not isinstance(row.get("element"), str)
                        or not isinstance(row.get("sha256"), str) or not SHA256_RE.fullmatch(row.get("sha256", ""))):
                    errors.append("invalid layout node change record")
                    continue
                layout_nodes_by_part.setdefault(row["part"], []).append(row)
            for group, target in ((localization_rows, localizations_by_part), (visibility_rows, visibility_by_part)):
                for slide_row in group:
                    if not isinstance(slide_row, dict) or slide_row.get("part") not in candidate_names:
                        errors.append("invalid localization/media visibility part record")
                        continue
                    if target is localizations_by_part:
                        match = re.fullmatch(r"ppt/slides/slide(\d+)\.xml", slide_row["part"])
                        if not match or slide_row.get("slide") != int(match.group(1)) or not isinstance(slide_row.get("reason"), str) or not slide_row["reason"].strip():
                            errors.append(f"localization must identify its actual slide and reason: {slide_row['part']}")
                        media_parts = slide_row.get("source_media_parts")
                        if (not isinstance(media_parts, list) or not media_parts
                                or any(not isinstance(item, str) or not item.strip() for item in media_parts)):
                            errors.append(f"image-text localization must identify the source media parts: {slide_row['part']}")
                        elif len(media_parts) != len(set(media_parts)):
                            errors.append(f"localization source media parts must be unique: {slide_row['part']}")
                        else:
                            used_images = _slide_image_parts(candidate_zip, slide_row["part"])
                            if any(item not in used_images or item not in source_names for item in media_parts):
                                errors.append(f"localization source media is not related to its slide: {slide_row['part']}")
                    objects = slide_row.get("objects", []) if target is localizations_by_part else [slide_row]
                    for item in objects:
                        if not isinstance(item, dict) or not isinstance(item.get("id", item.get("shape_id")), int):
                            errors.append("invalid localized object or media visibility record")
                            continue
                        if target is visibility_by_part:
                            object_id = item.get("shape_id", item.get("id"))
                            visibility_key = (slide_row["part"], object_id)
                            if visibility_key in seen_visibility:
                                errors.append(f"duplicate media visibility registration: {slide_row['part']}#{object_id}")
                            seen_visibility.add(visibility_key)
                        target.setdefault(slide_row["part"], []).append(item)

            normalized_parts: dict[str, bytes] = {}
            for name in sorted(candidate_names):
                base_bytes, final_bytes = baseline_zip.read(name), candidate_zip.read(name)
                if name.startswith("ppt/media/"):
                    if source_zip.read(name) != final_bytes:
                        errors.append(f"original media payload changed: {name}")
                    if base_bytes != final_bytes:
                        errors.append(f"media differs from deterministic baseline: {name}")
                    continue
                if name.endswith(".rels") and base_bytes != final_bytes:
                    errors.append(f"package relationship changed during translation adaptation: {name}")
                    continue
                if not name.startswith("ppt/slides/slide") or not name.endswith(".xml"):
                    if base_bytes != final_bytes:
                        errors.append(f"unregistered package payload changed: {name}")
                    continue
                try:
                    base_root, final_root = _parse(base_bytes), _parse(final_bytes)
                except etree.XMLSyntaxError:
                    errors.append(f"slide XML is invalid after translation adaptation: {name}")
                    continue
                base_shapes, final_shapes = _shape_nodes(base_root), _shape_nodes(final_root)
                localization_rows_for_part = localizations_by_part.get(name, [])
                declared_ids = set()
                for row in localization_rows_for_part:
                    object_id = row.get("id")
                    if object_id in declared_ids:
                        errors.append(f"duplicate localized shape ID in journal: {name}#{object_id}")
                    declared_ids.add(object_id)
                    if object_id not in final_shapes or object_id in base_shapes:
                        errors.append(f"localized shape missing or was not newly appended: {name}#{object_id}")
                        continue
                    if object_id < 90000:
                        errors.append(f"localized shape ID must be at least 90000: {name}#{object_id}")
                    shape_error = _localized_shape_error(final_shapes[object_id], row)
                    if shape_error:
                        errors.append(f"{name}#{object_id}: {shape_error}")
                new_ids = set(final_shapes) - set(base_shapes)
                if new_ids != declared_ids:
                    errors.append(f"unregistered or missing localized shapes on {name}: {sorted(new_ids ^ declared_ids)}")

                # Mask/localized objects must be appended after original objects.
                sp_tree = final_root.find(".//p:spTree", NS)
                if sp_tree is None:
                    errors.append(f"slide has no shape tree: {name}")
                else:
                    direct_children = list(sp_tree)
                    # IDs are checked independently; requiring all registered IDs
                    # to occur after the last original shape enforces append-only.
                    child_positions = {}
                    for index, child in enumerate(direct_children):
                        ids = child.xpath("./p:nvSpPr/p:cNvPr/@id|./p:nvPicPr/p:cNvPr/@id|./p:nvGraphicFramePr/p:cNvPr/@id|./p:nvGrpSpPr/p:cNvPr/@id|./p:nvCxnSpPr/p:cNvPr/@id", namespaces=NS)
                        if ids:
                            child_positions[int(ids[0])] = index
                    original_positions = [child_positions[i] for i in base_shapes if i in child_positions]
                    added_positions = [child_positions[i] for i in declared_ids if i in child_positions]
                    if original_positions and added_positions and min(added_positions) <= max(original_positions):
                        errors.append(f"localized shapes must be appended after existing slide objects: {name}")

                # Remove declared appended shapes; restore only explicitly
                # journaled existing-object attributes; whole-slide C14N then
                # proves text, IDs, hierarchy, links, media refs and other XML
                # remained identical to deterministic apply output.
                for object_id in declared_ids:
                    node = final_shapes.get(object_id)
                    if node is not None and node.getparent() is not None:
                        node.getparent().remove(node)
                for row in layouts_by_part.get(name, []):
                    object_id, selector, attr = row.get("shape_id"), row.get("selector"), row.get("attribute")
                    if object_id not in base_shapes or object_id not in final_shapes or not isinstance(selector, str) or not isinstance(attr, str):
                        errors.append(f"layout change target does not resolve: {name}#{object_id}")
                        continue
                    try:
                        base_node = _selector_node(base_shapes[object_id], selector)
                        final_node = _selector_node(final_shapes[object_id], selector)
                    except AdaptationError as exc:
                        errors.append(str(exc))
                        continue
                    if not _allowed_attribute(final_node, attr):
                        errors.append(f"layout attribute is outside the approved allowlist: {name}#{object_id} {selector}@{attr}")
                        continue
                    expected_before, expected_after = row.get("before"), row.get("after")
                    if (_qname(final_node), attr) in REMOVABLE_ATTRIBUTES and expected_after is not None:
                        errors.append(f"bodyPr overflow controls may only be removed: {name}#{object_id} {selector}@{attr}")
                        continue
                    if base_node.get(attr) != expected_before or final_node.get(attr) != expected_after or expected_before == expected_after:
                        errors.append(f"layout change values do not match baseline/final: {name}#{object_id} {selector}@{attr}")
                        continue
                    if expected_before is None:
                        final_node.attrib.pop(attr, None)
                    else:
                        final_node.set(attr, expected_before)
                node_rows_for_part = layout_nodes_by_part.get(name, [])
                add_rows = [row for row in node_rows_for_part if row.get("operation") == "add"]
                remove_rows = [row for row in node_rows_for_part if row.get("operation") == "remove"]
                for row in sorted(add_rows, key=lambda item: (item.get("shape_id", -1), item.get("parent_selector", ""), -item.get("position", -1))):
                    object_id, position, selector = row.get("shape_id"), row.get("position"), row.get("parent_selector")
                    shape = final_shapes.get(object_id)
                    if shape is None or not isinstance(position, int) or not isinstance(selector, str):
                        errors.append(f"layout node addition target is invalid: {name}#{object_id}")
                        continue
                    try:
                        parent_node = _selector_node(shape, selector)
                    except AdaptationError as exc:
                        errors.append(str(exc)); continue
                    children = list(parent_node)
                    if position < 0 or position >= len(children):
                        errors.append(f"layout node addition position is missing: {name}#{object_id}")
                        continue
                    node = children[position]
                    if _qname(node) != row.get("element") or sha256(_c14n(node)) != row.get("sha256") or not _allowed_node_mutation(parent_node, node, "add"):
                        errors.append(f"layout node addition does not match the approved node hash/contract: {name}#{object_id}")
                        continue
                    parent_node.remove(node)
                for row in sorted(remove_rows, key=lambda item: (item.get("shape_id", -1), item.get("parent_selector", ""), item.get("position", -1))):
                    object_id, position, selector = row.get("shape_id"), row.get("position"), row.get("parent_selector")
                    base_shape, final_shape = base_shapes.get(object_id), final_shapes.get(object_id)
                    if base_shape is None or final_shape is None or not isinstance(position, int) or not isinstance(selector, str):
                        errors.append(f"layout node removal target is invalid: {name}#{object_id}")
                        continue
                    try:
                        base_parent = _selector_node(base_shape, selector)
                        final_parent = _selector_node(final_shape, selector)
                    except AdaptationError as exc:
                        errors.append(str(exc)); continue
                    base_children = list(base_parent)
                    if position < 0 or position >= len(base_children):
                        errors.append(f"removed layout node cannot be found in baseline: {name}#{object_id}")
                        continue
                    removed = base_children[position]
                    if _qname(removed) != row.get("element") or sha256(_c14n(removed)) != row.get("sha256") or not _allowed_node_mutation(base_parent, removed, "remove"):
                        errors.append(f"removed layout node does not match the approved baseline node: {name}#{object_id}")
                        continue
                    final_parent.insert(min(position, len(final_parent)), copy.deepcopy(removed))
                for row in visibility_by_part.get(name, []):
                    object_id = row.get("shape_id", row.get("id"))
                    if (row.get("property") != "hidden" or not isinstance(row.get("region_reason"), str)
                            or not row["region_reason"].strip()):
                        errors.append(f"media visibility change requires property=hidden and a reason: {name}#{object_id}")
                        continue
                    base_node, final_node = base_shapes.get(object_id), final_shapes.get(object_id)
                    if base_node is None or final_node is None:
                        errors.append(f"media visibility shape does not resolve: {name}#{object_id}")
                        continue
                    if (etree.QName(base_node).localname != "pic" or etree.QName(final_node).localname != "pic"
                            or base_node.find("./p:nvPicPr/p:cNvPr", NS) is None
                            or final_node.find("./p:nvPicPr/p:cNvPr", NS) is None):
                        errors.append(f"media visibility is allowed only for a native picture shape: {name}#{object_id}")
                        continue
                    base_nv = base_node.find("./p:nvPicPr/p:cNvPr", NS)
                    final_nv = final_node.find("./p:nvPicPr/p:cNvPr", NS)
                    if (base_nv.get("hidden") != row.get("before") or final_nv.get("hidden") != row.get("after")
                            or row.get("after") not in {"1", "true"} or row.get("before") not in {None, "0", "false"}):
                        errors.append(f"media hidden change values are invalid: {name}#{object_id}")
                        continue
                    media_parts = row.get("source_media_parts")
                    if (not isinstance(media_parts, list) or not media_parts
                            or any(not isinstance(item, str) for item in media_parts)
                            or len(media_parts) != len(set(media_parts))
                            or sorted(media_parts) != _picture_media_parts(baseline_zip, name, object_id)):
                        errors.append(f"media visibility must name the exact related source image parts: {name}#{object_id}")
                        continue
                    final_nv.set("hidden", row.get("before")) if row.get("before") is not None else final_nv.attrib.pop("hidden", None)
                if _c14n(base_root) != _c14n(final_root):
                    errors.append(f"unregistered slide text/geometry/media/relationship change: {name}")
                normalized_parts[name] = final_bytes
    return expected["apply_baseline_sha256"]


def validate_adaptations(source_pptx: str | Path, candidate_pptx: str | Path,
                         mapping_path: str | Path, journal_path: str | Path) -> dict[str, Any]:
    source, candidate, mapping, journal_file = map(Path, (source_pptx, candidate_pptx, mapping_path, journal_path))
    errors: list[str] = []
    try:
        journal = json.loads(journal_file.read_text(encoding="utf-8"))
        if not isinstance(journal, dict):
            raise AdaptationError("adaptation journal must be a JSON object")
        _reconstruct_and_normalize(source, mapping, candidate, journal, errors)
    except (OSError, ValueError, TypeError, KeyError, AttributeError, zipfile.BadZipFile,
            engine.TranslationError, AdaptationError, etree.XMLSyntaxError) as exc:
        errors.append(str(exc))
    try:
        journal = json.loads(journal_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        journal = {}
    return {"schema_version": 1, "status": "pass" if not errors else "fail", "errors": errors,
            "journal_sha256": sha256(journal_file.read_bytes()) if journal_file.is_file() else None,
            "apply_baseline_sha256": journal.get("apply_baseline_sha256")}


def _diff_allowed_changes(part: str, base_root, final_root,
                          visibility_plan: list[dict[str, Any]] | None = None,
                          base_package: zipfile.ZipFile | None = None,
                          ) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    before_shapes, after_shapes = _shape_nodes(base_root), _shape_nodes(final_root)
    if set(before_shapes) - set(after_shapes):
        raise AdaptationError(f"existing shape removed during adaptation: {part}")
    rows: list[dict[str, Any]] = []
    node_rows: list[dict[str, Any]] = []
    visibility_rows: list[dict[str, Any]] = []
    visibility_plan = visibility_plan or []
    for object_id, base_shape in before_shapes.items():
        final_shape = after_shapes[object_id]
        def visit(base_node: etree._Element, final_node: etree._Element) -> None:
            if base_node.tag != final_node.tag or base_node.text != final_node.text or base_node.tail != final_node.tail:
                raise AdaptationError(f"existing text or OOXML hierarchy changed during adaptation: {part}#{object_id}")
            for key in set(base_node.attrib) | set(final_node.attrib):
                before, after = base_node.get(key), final_node.get(key)
                if before == after:
                    continue
                attr = etree.QName(key).localname if key.startswith("{") else key
                is_visibility_change = _qname(final_node) == "p:cNvPr" and attr == "hidden"
                if not is_visibility_change and not _allowed_attribute(final_node, attr):
                    raise AdaptationError(f"unapproved attribute change: {part}#{object_id} {_qname(final_node)}@{attr}")
                if (_qname(final_node), attr) in REMOVABLE_ATTRIBUTES and after is not None:
                    raise AdaptationError(f"bodyPr overflow controls may only be removed: {part}#{object_id} {_qname(final_node)}@{attr}")
                if before is None and after is None:
                    raise AdaptationError(f"empty attribute mutation in {part}#{object_id}")
                if after is None and (_qname(final_node), attr) not in REMOVABLE_ATTRIBUTES:
                    raise AdaptationError(f"attribute removal is outside the explicit allowlist: {part}#{object_id} {_qname(final_node)}@{attr}")
                if _qname(final_node) == "p:cNvPr" and attr == "hidden":
                    matching = [entry for entry in visibility_plan if entry.get("shape_id") == object_id and entry.get("before") == before and entry.get("after") == after]
                    if len(matching) != 1 or not isinstance(matching[0].get("region_reason"), str) or not matching[0]["region_reason"].strip():
                        raise AdaptationError(f"picture visibility changes require a specific journal plan and region reason: {part}#{object_id}")
                    if (etree.QName(base_shape).localname != "pic" or etree.QName(final_shape).localname != "pic"
                            or before not in {None, "0", "false"} or after not in {"1", "true"}):
                        raise AdaptationError(f"only an explicit picture hide is allowed: {part}#{object_id}")
                    if base_package is None:
                        raise AdaptationError(f"picture visibility requires source package media evidence: {part}#{object_id}")
                    declared_media = matching[0].get("source_media_parts")
                    actual_media = _picture_media_parts(base_package, part, object_id)
                    if (not isinstance(declared_media, list) or not declared_media
                            or any(not isinstance(item, str) for item in declared_media)
                            or len(declared_media) != len(set(declared_media))
                            or sorted(declared_media) != actual_media):
                        raise AdaptationError(f"picture visibility requires the exact related source image parts: {part}#{object_id}")
                    visibility_rows.append({"part": part, "shape_id": object_id, "property": "hidden",
                                            "before": before, "after": after, "region_reason": matching[0]["region_reason"],
                                            "source_media_parts": actual_media})
                else:
                    rows.append({"part": part, "shape_id": object_id, "property": f"{_qname(final_node)}.{attr}",
                                 "selector": _selector(final_node, final_shape), "attribute": attr,
                                 "before": before, "after": after})
            before_children, after_children = list(base_node), list(final_node)
            pairs = _lcs_pairs(before_children, after_children)
            before_matched, after_matched = {i for i, _ in pairs}, {j for _, j in pairs}
            for index, child in enumerate(before_children):
                if index in before_matched:
                    continue
                if not _allowed_node_mutation(base_node, child, "remove"):
                    raise AdaptationError(f"unapproved formatting node removal: {part}#{object_id} {_qname(child)}")
                parent_selector, position = _node_selector(child, base_shape)
                node_rows.append({"part": part, "shape_id": object_id, "operation": "remove",
                                  "parent_selector": parent_selector, "position": position,
                                  "element": _qname(child), "sha256": sha256(_c14n(child))})
            for index, child in enumerate(after_children):
                if index in after_matched:
                    continue
                if not _allowed_node_mutation(final_node, child, "add"):
                    raise AdaptationError(f"unapproved formatting node addition: {part}#{object_id} {_qname(child)}")
                parent_selector, position = _node_selector(child, final_shape)
                node_rows.append({"part": part, "shape_id": object_id, "operation": "add",
                                  "parent_selector": parent_selector, "position": position,
                                  "element": _qname(child), "sha256": sha256(_c14n(child))})
            for before_index, after_index in pairs:
                visit(before_children[before_index], after_children[after_index])

        visit(base_shape, final_shape)
    return rows, node_rows, visibility_rows


def build_adaptation_journal(source_pptx: str | Path, mapping_path: str | Path,
                             apply_baseline_pptx: str | Path, candidate_pptx: str | Path,
                             localization_plan: dict[str, Any] | str | Path | None = None) -> dict[str, Any]:
    """Create journal evidence by diffing a deterministic baseline and final deck.

    localization_plan records exact source-to-English pairs and media context;
    no approval field is accepted or inferred by this function.
    """
    source, mapping, baseline, candidate = map(Path, (source_pptx, mapping_path, apply_baseline_pptx, candidate_pptx))
    extraction, _mapping, mapping_units = _mapping_units(source, mapping)
    expected = _baseline_bytes(source, extraction, mapping_units)
    if baseline.read_bytes() != expected:
        raise AdaptationError("supplied apply baseline does not equal deterministic source+mapping translation")
    if localization_plan is None:
        plan: dict[str, Any] = {"localizations": []}
    elif isinstance(localization_plan, (str, Path)):
        value = json.loads(Path(localization_plan).read_text(encoding="utf-8"))
        plan = value if isinstance(value, dict) else {}
    else:
        plan = localization_plan
    if (not isinstance(plan, dict) or not isinstance(plan.get("localizations", []), list)
            or not isinstance(plan.get("media_visibility_changes", []), list)):
        raise AdaptationError("localization plan must contain a localizations array")

    import io
    layout_rows: list[dict[str, Any]] = []
    layout_node_rows: list[dict[str, Any]] = []
    generated_visibility_rows: list[dict[str, Any]] = []
    generated_localizations: list[dict[str, Any]] = []
    with zipfile.ZipFile(io.BytesIO(expected)) as base_zip, zipfile.ZipFile(candidate) as final_zip:
        if set(base_zip.namelist()) != set(final_zip.namelist()):
            raise AdaptationError("candidate changed PPTX package members")
        plan_by_key = {}
        for slide_row in plan.get("localizations", []):
            if not isinstance(slide_row, dict) or not isinstance(slide_row.get("part"), str):
                raise AdaptationError("localization plan entries require a slide part")
            if slide_row["part"] in plan_by_key:
                raise AdaptationError(f"duplicate localization plan slide: {slide_row['part']}")
            plan_by_key[slide_row["part"]] = slide_row
        for name in base_zip.namelist():
            before, after = base_zip.read(name), final_zip.read(name)
            if before == after:
                continue
            if not (name.startswith("ppt/slides/slide") and name.endswith(".xml")):
                if name.startswith("ppt/media/"):
                    raise AdaptationError(f"original media must remain unchanged: {name}")
                raise AdaptationError(f"candidate has an unapproved package change: {name}")
            base_root, final_root = _parse(before), _parse(after)
            base_shapes, final_shapes = _shape_nodes(base_root), _shape_nodes(final_root)
            new_ids = set(final_shapes) - set(base_shapes)
            if any(value < 90000 for value in new_ids):
                raise AdaptationError(f"new localization shape IDs must be >=90000: {name}")
            visibility_plan = [item for item in plan.get("media_visibility_changes", []) if isinstance(item, dict) and item.get("part") == name]
            attribute_changes, node_changes, visibility_changes = _diff_allowed_changes(name, base_root, final_root,
                                                                                       visibility_plan, base_zip)
            layout_rows.extend(attribute_changes)
            layout_node_rows.extend(node_changes)
            generated_visibility_rows.extend(visibility_changes)
            plan_row = plan_by_key.get(name, {})
            plan_objects = {obj.get("id"): obj for obj in plan_row.get("objects", []) if isinstance(obj, dict)}
            if new_ids != set(plan_objects):
                raise AdaptationError(f"localization plan IDs do not match newly added shapes: {name}")
            objects = []
            for object_id in sorted(new_ids):
                shape = final_shapes[object_id]
                declared = plan_objects[object_id]
                bbox = _shape_bbox(shape)
                if bbox is None:
                    raise AdaptationError(f"new localized shape has no measurable bounds: {name}#{object_id}")
                obj = {"id": object_id, "role": declared.get("role"), "source_text": declared.get("source_text", ""),
                       "text": _shape_text(shape), "bbox_emu": bbox, "sha256": _shape_hash(shape),
                       "reason": declared.get("reason", plan_row.get("reason", ""))}
                if "annotation_type" in declared:
                    obj["annotation_type"] = declared["annotation_type"]
                err = _localized_shape_error(shape, obj)
                if err:
                    raise AdaptationError(f"{name}#{object_id}: {err}")
                objects.append(obj)
            if new_ids:
                media_parts = plan_row.get("source_media_parts", [])
                if (not isinstance(media_parts, list) or not media_parts or len(media_parts) != len(set(media_parts))
                        or any(part not in base_zip.namelist() or not part.startswith("ppt/media/") for part in media_parts)):
                    raise AdaptationError(f"localization source_media_parts is invalid: {name}")
                if not plan_row.get("reason"):
                    raise AdaptationError(f"localization plan requires a reason: {name}")
                generated_localizations.append({"part": name, "slide": int(re.search(r"slide(\d+)", name).group(1)),
                                                "source_media_parts": media_parts, "reason": plan_row["reason"], "objects": objects})
    journal = {"schema_version": 1, "mode": "translation-post-layout",
               "source_sha256": sha256(source.read_bytes()), "mapping_sha256": sha256(mapping.read_bytes()),
               "apply_baseline_sha256": sha256(expected), "candidate_sha256": sha256(candidate.read_bytes()),
               "layout_changes": layout_rows, "layout_nodes": layout_node_rows,
               "localizations": generated_localizations, "media_visibility_changes": generated_visibility_rows}
    import tempfile
    with tempfile.TemporaryDirectory(prefix="me2026-adapt-journal-") as temp_dir:
        journal_path = Path(temp_dir) / "journal.json"
        journal_path.write_text(json.dumps(journal, ensure_ascii=False), encoding="utf-8")
        result = validate_adaptations(source, candidate, mapping, journal_path)
        if result["status"] != "pass":
            raise AdaptationError("built adaptation journal did not validate: " + "; ".join(result["errors"][:8]))
    return journal


def main(argv: list[str] | None = None) -> int:
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True)
    parser.add_argument("--mapping", required=True)
    parser.add_argument("--baseline", required=True)
    parser.add_argument("--candidate", required=True)
    plan_group = parser.add_mutually_exclusive_group()
    plan_group.add_argument("--localization-plan", help="Canonical adaptation localization plan JSON")
    plan_group.add_argument("--image-journal", help="Fresh image-localization journal with per-slide new_shapes")
    parser.add_argument("--out", required=True)
    args = parser.parse_args(argv)
    output = Path(args.out)
    if output.exists():
        parser.error(f"refusing to overwrite existing journal: {output}")
    try:
        localization_plan = args.localization_plan
        if args.image_journal:
            image_journal = json.loads(Path(args.image_journal).read_text(encoding="utf-8"))
            localization_plan = image_journal_to_localization_plan(image_journal)
        journal = build_adaptation_journal(args.source, args.mapping, args.baseline, args.candidate, localization_plan)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(journal, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({"status": "built", "path": str(output), "sha256": sha256(output.read_bytes()),
                          "layout_changes": len(journal["layout_changes"]),
                          "localized_shapes": sum(len(item["objects"]) for item in journal["localizations"]),
                          "image_journal": str(Path(args.image_journal)) if args.image_journal else None}, ensure_ascii=False, indent=2))
        return 0
    except (OSError, ValueError, TypeError, KeyError, AttributeError, zipfile.BadZipFile,
            engine.TranslationError, AdaptationError, etree.XMLSyntaxError) as exc:
        print(str(exc))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
