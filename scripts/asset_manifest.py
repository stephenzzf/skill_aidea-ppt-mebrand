#!/usr/bin/env python3
"""Validate declared media and editable objects against a PPTX package."""
from __future__ import annotations

import hashlib
import json
import math
import os
from pathlib import Path
import posixpath
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}
EMU = 914400
KINDS = {"photo", "illustration", "background", "screenshot"}
ORIGINS = {"generated", "user", "url"}
PLACEMENTS = {"background", "illustration", "photo", "screenshot"}
OBJECT_TYPES = {"text", "shape", "table", "chart"}
SEMANTIC_BRIEF_TEXT_FIELDS = ("page_claim", "subject", "action", "inputs", "outputs")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def local_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _png_has_alpha(data: bytes) -> bool | None:
    """Return true only when decoded PNG pixels contain non-opaque alpha."""
    if len(data) < 33 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        return None
    try:
        from PIL import Image
        import io

        with Image.open(io.BytesIO(data)) as image:
            image.load()
            alpha = image.convert("RGBA").getchannel("A")
            return alpha.getextrema()[0] < 255
    except Exception:
        # Do not claim visible transparency when the PNG cannot be decoded.
        return False


def _semantic_brief_errors(asset: dict, asset_id: str) -> list[str]:
    """Validate the human-authored semantic contract for an explanatory image."""
    if "semantic_brief" not in asset:
        return []
    brief = asset.get("semantic_brief")
    if not isinstance(brief, dict):
        return [f"asset '{asset_id}' semantic_brief must be an object"]

    errors: list[str] = []
    for field in SEMANTIC_BRIEF_TEXT_FIELDS:
        value = brief.get(field)
        if not isinstance(value, str) or not value.strip():
            errors.append(f"asset '{asset_id}' semantic_brief.{field} must be a non-empty string")

    cues = brief.get("required_cues")
    if not isinstance(cues, list) or not cues:
        errors.append(f"asset '{asset_id}' semantic_brief.required_cues must be a non-empty array of strings")
    else:
        for index, cue in enumerate(cues):
            if not isinstance(cue, str) or not cue.strip():
                errors.append(f"asset '{asset_id}' semantic_brief.required_cues[{index}] must be a non-empty string")
        valid_cues = [cue.strip() for cue in cues if isinstance(cue, str) and cue.strip()]
        if len(valid_cues) != len(set(valid_cues)):
            errors.append(f"asset '{asset_id}' semantic_brief.required_cues must not contain duplicates")

    if asset.get("kind") != "illustration" or asset.get("placement") != "illustration":
        errors.append(f"asset '{asset_id}' semantic_brief is only supported for kind=illustration and placement=illustration")
    return errors


def _slide_parts(names: list[str]) -> list[str]:
    parts = [name for name in names if name.startswith("ppt/slides/slide") and name.endswith(".xml")]
    return sorted(parts, key=lambda name: int(name.rsplit("slide", 1)[1].split(".", 1)[0]))


def _read_media_refs(deck: zipfile.ZipFile, slide_parts: list[str]) -> tuple[dict[str, list[int]], dict[int, dict]]:
    media_slides: dict[str, list[int]] = {}
    slide_shapes: dict[int, dict] = {}
    names = set(deck.namelist())
    for slide_part in slide_parts:
        slide_num = int(slide_part.rsplit("slide", 1)[1].split(".", 1)[0])
        root = ET.fromstring(deck.read(slide_part))
        rels_part = posixpath.join(posixpath.dirname(slide_part), "_rels", posixpath.basename(slide_part) + ".rels")
        rels: dict[str, str] = {}
        if rels_part in names:
            rels_root = ET.fromstring(deck.read(rels_part))
            for rel in rels_root:
                rel_id = rel.attrib.get("Id")
                target = rel.attrib.get("Target")
                if rel_id and target and rel.attrib.get("TargetMode") != "External":
                    rels[rel_id] = posixpath.normpath(posixpath.join(posixpath.dirname(slide_part), target))

        for blip in root.findall(".//a:blip", NS):
            target = rels.get(blip.attrib.get(f"{{{NS['r']}}}embed", ""))
            if target in names and target.startswith("ppt/media/"):
                digest = sha256_bytes(deck.read(target))
                media_slides.setdefault(digest, []).append(slide_num)

        shape_map: dict[str, list[dict]] = {}
        tree = root.find(".//p:spTree", NS)
        if tree is not None:
            for node in list(tree):
                tag = node.tag.rsplit("}", 1)[-1]
                nv = node.find(".//p:cNvPr", NS)
                shape_name = nv.attrib.get("name", "") if nv is not None else ""
                if not shape_name:
                    continue
                if tag == "sp":
                    object_type = "shape"
                elif tag == "graphicFrame":
                    uri = node.find(".//a:graphicData", NS)
                    uri = uri.attrib.get("uri", "") if uri is not None else ""
                    object_type = "table" if uri.endswith("/table") else "chart" if uri.endswith("/chart") else "shape"
                else:
                    continue
                texts = [text.text or "" for text in node.findall(".//a:t", NS)]
                text_content = "".join(texts)
                entry = {"name": shape_name, "type": object_type, "text": text_content}
                # A textbox remains type=shape in OOXML; expose it separately.
                if text_content.strip():
                    entry["type"] = "text"
                    shape_map.setdefault("text", []).append(entry)
                shape_map.setdefault(object_type, []).append(entry)
                shape_map.setdefault("all", []).append(entry)
        slide_shapes[slide_num] = shape_map
    return media_slides, slide_shapes


def _placement_box_errors(asset: dict, deck: zipfile.ZipFile, slide_parts: list[str], slide_num: int) -> list[str]:
    box = asset.get("placement_box")
    if box is None:
        return []
    if not isinstance(box, dict) or any(key not in box for key in ("x", "y", "w", "h")):
        return ["placement_box must contain x, y, w, h in inches"]
    try:
        expected = {key: float(box[key]) for key in ("x", "y", "w", "h")}
    except (TypeError, ValueError):
        return ["placement_box values must be finite numbers"]
    if not all(math.isfinite(value) for value in expected.values()) or expected["w"] <= 0 or expected["h"] <= 0:
        return ["placement_box values must be finite and w/h must be positive"]

    part = next((item for item in slide_parts if int(item.rsplit("slide", 1)[1].split(".", 1)[0]) == slide_num), None)
    if not part:
        return [f"slide {slide_num} was not found in the PPTX"]
    root = ET.fromstring(deck.read(part))
    rels_part = posixpath.join(posixpath.dirname(part), "_rels", posixpath.basename(part) + ".rels")
    rels_root = ET.fromstring(deck.read(rels_part)) if rels_part in deck.namelist() else None
    rels = {}
    if rels_root is not None:
        rels = {item.attrib.get("Id"): posixpath.normpath(posixpath.join(posixpath.dirname(part), item.attrib.get("Target", ""))) for item in rels_root if item.attrib.get("Id") and item.attrib.get("Target") and item.attrib.get("TargetMode") != "External"}
    digest = asset.get("sha256", "")
    found = False
    actual_crop = None
    tolerance = 0.03 * EMU
    for pic in root.findall(".//p:pic", NS):
        embed = pic.find(".//a:blip", NS)
        target = rels.get(embed.attrib.get(f"{{{NS['r']}}}embed", "")) if embed is not None else None
        if target not in deck.namelist() or sha256_bytes(deck.read(target)) != digest:
            continue
        xfrm = pic.find("./p:spPr/a:xfrm", NS)
        if xfrm is None:
            continue
        off, ext = xfrm.find("a:off", NS), xfrm.find("a:ext", NS)
        if off is None or ext is None:
            continue
        actual = {"x": int(off.attrib["x"]), "y": int(off.attrib["y"]), "w": int(ext.attrib["cx"]), "h": int(ext.attrib["cy"])}
        if all(abs(actual[key] - round(expected[key] * EMU)) <= tolerance for key in actual):
            found = True
            src_rect = pic.find(".//a:srcRect", NS)
            actual_crop = {
                "left": int(src_rect.attrib.get("l", 0)) if src_rect is not None else 0,
                "top": int(src_rect.attrib.get("t", 0)) if src_rect is not None else 0,
                "right": int(src_rect.attrib.get("r", 0)) if src_rect is not None else 0,
                "bottom": int(src_rect.attrib.get("b", 0)) if src_rect is not None else 0,
            }
            break
    if not found:
        return [f"placement_box for asset '{asset.get('id')}' does not match the embedded image on slide {slide_num}"]
    crop = asset.get("crop")
    if any(actual_crop.values()) and not isinstance(crop, dict):
        return [f"asset '{asset.get('id')}' has PowerPoint crop values that are missing from the manifest"]
    if crop is not None:
        if not isinstance(crop, dict) or any(key not in crop for key in ("left", "top", "right", "bottom")):
            return [f"asset '{asset.get('id')}' crop must contain left, top, right, bottom in 1/1000 percent"]
        try:
            declared_crop = {key: int(crop[key]) for key in actual_crop}
        except (TypeError, ValueError):
            return [f"asset '{asset.get('id')}' crop values must be integers in 1/1000 percent"]
        if any(value < 0 or value > 100000 for value in declared_crop.values()):
            return [f"asset '{asset.get('id')}' crop values must be between 0 and 100000"]
        if declared_crop != actual_crop:
            return [f"asset '{asset.get('id')}' crop values do not match PowerPoint's embedded crop"]
    return []


def validate_manifest(pptx_path: str, manifest_path: str) -> dict:
    pptx = Path(pptx_path).resolve()
    manifest_file = Path(manifest_path).resolve()
    errors: list[str] = []
    warnings: list[str] = []
    asset_results: list[dict] = []
    editable_results: list[dict] = []
    try:
        manifest_hash = local_sha256(manifest_file)
        manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
    except OSError as exc:
        return {"schema_version": 1, "status": "fail", "manifest": str(manifest_file), "sha256": None, "errors": [f"cannot read asset manifest: {exc}"], "warnings": [], "assets": [], "required_editable": []}
    except Exception as exc:
        return {"schema_version": 1, "status": "fail", "manifest": str(manifest_file), "sha256": manifest_hash, "errors": [f"cannot parse asset manifest: {exc}"], "warnings": [], "assets": [], "required_editable": []}
    if not isinstance(manifest, dict) or manifest.get("schema_version") != 1:
        errors.append("asset manifest schema_version must be 1")
        manifest = {}
    assets = manifest.get("assets")
    if not isinstance(assets, list):
        errors.append("asset manifest assets must be an array")
        assets = []
    editable = manifest.get("required_editable", [])
    if not isinstance(editable, list):
        errors.append("asset manifest required_editable must be an array")
        editable = []
    ids: set[str] = set()
    try:
        deck = zipfile.ZipFile(pptx)
    except Exception as exc:
        return {"schema_version": 1, "status": "fail", "manifest": str(manifest_file), "sha256": manifest_hash, "errors": [f"cannot read PPTX package: {exc}"], "warnings": [], "assets": [], "required_editable": []}
    with deck:
        names = deck.namelist()
        slide_parts = _slide_parts(names)
        media_slides, slide_shapes = _read_media_refs(deck, slide_parts)
        for index, asset in enumerate(assets):
            item_errors: list[str] = []
            if not isinstance(asset, dict):
                errors.append(f"assets[{index}] must be an object")
                continue
            asset_id = asset.get("id")
            if not isinstance(asset_id, str) or not asset_id.strip():
                item_errors.append("asset id is required")
                asset_id = f"assets[{index}]"
            elif asset_id in ids:
                item_errors.append(f"duplicate asset id '{asset_id}'")
            ids.add(asset_id)
            if asset.get("kind") not in KINDS:
                item_errors.append(f"asset '{asset_id}' kind must be one of {sorted(KINDS)}")
            origin = asset.get("origin")
            if not isinstance(origin, dict) or origin.get("type") not in ORIGINS:
                item_errors.append(f"asset '{asset_id}' origin.type must be generated, user, or url")
                origin = {}
            else:
                if origin["type"] == "generated" and (not isinstance(origin.get("prompt"), str) or not origin["prompt"].strip()):
                    item_errors.append(f"asset '{asset_id}' generated origin requires a prompt")
                if origin["type"] == "url" and (not isinstance(origin.get("url"), str) or not origin["url"].strip()):
                    item_errors.append(f"asset '{asset_id}' URL origin requires a url")
                if origin["type"] == "user" and (not isinstance(origin.get("source"), str) or not origin["source"].strip()):
                    item_errors.append(f"asset '{asset_id}' user origin requires a source description")
            if origin.get("type") == "generated":
                host = origin.get("host")
                if host is None or (isinstance(host, str) and not host.strip()):
                    origin["host"] = "unknown"
                    warnings.append(f"asset '{asset_id}' host is unknown")
                elif not isinstance(host, str):
                    item_errors.append(f"asset '{asset_id}' generated origin host must be a string or unknown")
            if "transparency_required" in asset and not isinstance(asset["transparency_required"], bool):
                item_errors.append(f"asset '{asset_id}' transparency_required must be a boolean")
            relative = asset.get("file")
            asset_file = None
            if not isinstance(relative, str) or not relative.strip() or Path(relative).is_absolute():
                item_errors.append(f"asset '{asset_id}' file must be a relative path")
            else:
                asset_file = (manifest_file.parent / relative).resolve()
                try:
                    asset_file.relative_to(manifest_file.parent)
                except ValueError:
                    item_errors.append(f"asset '{asset_id}' file must stay within the manifest directory")
                if not asset_file.is_file():
                    item_errors.append(f"asset '{asset_id}' file does not exist: {relative}")
            expected_hash = asset.get("sha256", "")
            if not isinstance(expected_hash, str) or len(expected_hash) != 64 or any(char not in "0123456789abcdef" for char in expected_hash.lower()):
                item_errors.append(f"asset '{asset_id}' must include a valid SHA-256")
            elif asset_file is not None and asset_file.is_file() and local_sha256(asset_file) != expected_hash.lower():
                item_errors.append(f"asset '{asset_id}' file hash is stale")
            try:
                slide = int(asset.get("slide"))
            except (TypeError, ValueError):
                slide = 0
            if slide < 1 or slide > len(slide_parts):
                item_errors.append(f"asset '{asset_id}' slide must be between 1 and {len(slide_parts)}")
                slide = 0
            if asset.get("placement") not in PLACEMENTS:
                item_errors.append(f"asset '{asset_id}' placement must be one of {sorted(PLACEMENTS)}")
            item_errors.extend(_semantic_brief_errors(asset, str(asset_id)))
            if asset.get("crop") is not None and asset.get("placement_box") is None:
                item_errors.append(f"asset '{asset_id}' crop requires placement_box to identify the embedded picture")
            actual_hash = None
            used_slides: list[int] = []
            if isinstance(expected_hash, str) and len(expected_hash) == 64:
                used_slides = sorted(set(media_slides.get(expected_hash.lower(), [])))
                if not used_slides:
                    item_errors.append(f"asset '{asset_id}' is not embedded in the current PPTX")
                elif slide and slide not in used_slides:
                    item_errors.append(f"asset '{asset_id}' is declared on slide {slide} but embedded on slide(s) {used_slides}")
                else:
                    actual_hash = expected_hash.lower()
            actual_alpha = None
            if asset.get("transparency_required"):
                if asset_file is None or not asset_file.is_file():
                    pass
                else:
                    try:
                        alpha_data = asset_file.read_bytes()
                        actual_alpha = _png_has_alpha(alpha_data)
                        if actual_alpha is not True:
                            item_errors.append(f"asset '{asset_id}' transparency was required but image pixels have no non-opaque alpha")
                    except Exception as exc:
                        item_errors.append(f"asset '{asset_id}' alpha inspection failed: {exc}")
            if slide:
                item_errors.extend(_placement_box_errors(asset, deck, slide_parts, slide))
            result = {"id": asset_id, "slide": slide or None, "file": relative, "sha256": actual_hash, "embedded_slides": used_slides, "alpha_transparency": actual_alpha, "semantic_brief": asset.get("semantic_brief"), "errors": item_errors}
            asset_results.append(result)
            errors.extend(item_errors)

        seen_editable: set[tuple[int, str]] = set()
        for index, page in enumerate(editable):
            page_errors: list[str] = []
            if not isinstance(page, dict):
                errors.append(f"required_editable[{index}] must be an object")
                continue
            try:
                slide = int(page.get("slide"))
            except (TypeError, ValueError):
                slide = 0
            if slide < 1 or slide > len(slide_parts):
                page_errors.append(f"required_editable[{index}] slide must be between 1 and {len(slide_parts)}")
                slide = 0
            objects = page.get("objects")
            if not isinstance(objects, list) or not objects:
                page_errors.append(f"required_editable[{index}].objects must be a non-empty array")
                objects = []
            shape_map = slide_shapes.get(slide, {})
            for obj in objects:
                if not isinstance(obj, dict):
                    page_errors.append(f"slide {slide} editable object declaration must be an object")
                    continue
                object_id = obj.get("id")
                shape_name = obj.get("shape_name")
                object_type = obj.get("type")
                if object_id is not None and (not isinstance(object_id, str) or not object_id.strip()):
                    page_errors.append(f"slide {slide} editable object id must be a non-empty logical identifier")
                    continue
                if shape_name is not None and (not isinstance(shape_name, str) or not shape_name.strip()):
                    page_errors.append(f"slide {slide} editable object shape_name must be a non-empty PPTX shape name")
                    continue
                # New manifests separate a stable logical id from the PPTX
                # object name. Legacy manifests used id as the shape name, so
                # it remains the fallback when shape_name is absent.
                actual_shape_name = shape_name or object_id
                logical_id = object_id or shape_name
                if not actual_shape_name:
                    page_errors.append(f"slide {slide} editable object requires shape_name or legacy id as a PPTX shape name")
                    continue
                key = (slide, str(logical_id))
                if key in seen_editable:
                    page_errors.append(f"slide {slide} editable logical id '{logical_id}' is declared more than once")
                seen_editable.add(key)
                if object_type not in OBJECT_TYPES:
                    page_errors.append(f"slide {slide} editable object '{logical_id}' has invalid type")
                    continue
                minimum = obj.get("min_count", 1)
                if not isinstance(minimum, int) or isinstance(minimum, bool) or minimum < 1:
                    page_errors.append(f"slide {slide} editable object '{logical_id}' min_count must be a positive integer")
                    continue
                candidates = [item for item in shape_map.get(object_type, []) if item["name"] == actual_shape_name]
                if object_type == "text":
                    expected_text = obj.get("text")
                    if not candidates:
                        page_errors.append(f"slide {slide} has no editable text object named '{actual_shape_name}' (logical id '{logical_id}')")
                    else:
                        if len(candidates) < minimum:
                            page_errors.append(f"slide {slide} editable text object '{actual_shape_name}' (logical id '{logical_id}') count is below min_count")
                        if expected_text and not any(expected_text in item["text"] for item in candidates):
                            page_errors.append(f"slide {slide} editable text '{actual_shape_name}' (logical id '{logical_id}') is missing expected text")
                elif not candidates:
                    page_errors.append(f"slide {slide} has no native {object_type} object named '{actual_shape_name}' (logical id '{logical_id}')")
                else:
                    if len(candidates) < minimum:
                        page_errors.append(f"slide {slide} native {object_type} object '{actual_shape_name}' (logical id '{logical_id}') count is below min_count")
            editable_results.append({"slide": slide or None, "errors": page_errors})
            errors.extend(page_errors)

    return {
        "schema_version": 1,
        "manifest": str(manifest_file),
        "sha256": manifest_hash,
        "status": "fail" if errors else "pass",
        "asset_count": len(asset_results),
        "required_editable_count": sum(len(item.get("objects", [])) for item in editable if isinstance(item, dict)),
        "assets": asset_results,
        "required_editable": editable_results,
        "errors": errors,
        "warnings": warnings,
    }


if __name__ == "__main__":
    if len(sys.argv) != 5 or sys.argv[1] != "--pptx" or sys.argv[3] != "--manifest":
        print("Usage: asset_manifest.py --pptx <file.pptx> --manifest <manifest.json>", file=sys.stderr)
        sys.exit(2)
    pptx_path, manifest_path = sys.argv[2], sys.argv[4]
    report = validate_manifest(pptx_path, manifest_path)
    print(json.dumps(report, ensure_ascii=False))
    sys.exit(0 if report["status"] == "pass" else 1)
