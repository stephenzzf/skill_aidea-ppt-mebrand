#!/usr/bin/env python3
"""Detect common ME2026 editable PPT layout risks that structural checks miss.

This script intentionally uses conservative OOXML heuristics. It is not a
renderer, but it catches recurring issues from dense PPT rebuilds and test
decks: tiny text boxes, long labels squeezed into narrow cards, non-footer body
text below the readable threshold, and accidental literal newline strings.
"""

import argparse
from collections import Counter
from io import BytesIO
import json
import os
from pathlib import Path
import posixpath
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

from pptx_geometry import collect_visual_objects

try:
    from PIL import Image
except ImportError:
    Image = None

NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
}

EMU_PER_INCH = 914400
ICON_OBJECT_PREFIX = "ME2026_ICON:"


def parse_args():
    parser = argparse.ArgumentParser(description="Check ME2026 PPTX layout readability risks.")
    parser.add_argument("pptx")
    parser.add_argument("--min-body-font-size", type=float, default=9.0)
    parser.add_argument("--min-text-height-in", type=float, default=0.15)
    parser.add_argument("--min-long-text-height-in", type=float, default=0.18)
    parser.add_argument("--long-text-min-chars", type=int, default=10)
    parser.add_argument("--long-text-narrow-width-in", type=float, default=1.1)
    parser.add_argument("--footer-start-y-in", type=float, default=6.85)
    parser.add_argument("--text-overlap-ratio", type=float, default=0.12)
    parser.add_argument("--icon-overlap-ratio", type=float, default=0.08)
    parser.add_argument("--min-table-module-gap-in", type=float, default=0.30)
    parser.add_argument("--min-table-note-gap-in", type=float, default=0.28)
    parser.add_argument("--container-padding-in", type=float, default=0.06)
    parser.add_argument("--min-contrast-body", type=float, default=4.5)
    parser.add_argument("--min-contrast-large", type=float, default=3.0)
    parser.add_argument("--max-issues", type=int, default=80)
    parser.add_argument(
        "--json-report",
        help="Optional path for a machine-readable QA report; stdout remains human-readable.",
    )
    return parser.parse_args()


def slide_num(name):
    match = re.search(r"slide(\d+)\.xml$", name)
    return int(match.group(1)) if match else 0


def inches(emu):
    return emu / EMU_PER_INCH


def xfrm_tuple(el, geometry_by_element=None):
    if geometry_by_element is not None:
        visual = geometry_by_element.get(el)
        if visual is not None:
            return visual.box
    xfrm = el.find(".//a:xfrm", NS)
    if xfrm is None:
        return None
    off = xfrm.find("a:off", NS)
    ext = xfrm.find("a:ext", NS)
    if off is None or ext is None:
        return None
    return (
        int(off.attrib.get("x", "0")),
        int(off.attrib.get("y", "0")),
        int(ext.attrib.get("cx", "0")),
        int(ext.attrib.get("cy", "0")),
    )


def geom_type(shape):
    prst = shape.find(".//a:prstGeom", NS)
    return prst.attrib.get("prst") if prst is not None else None


def text_of_shape(shape):
    return "".join(t.text or "" for t in shape.findall(".//a:t", NS)).strip()


def clean_text(text):
    return re.sub(r"\s+", " ", text).strip()


def visible_len(text):
    return len(re.sub(r"\s+", "", text))


def is_source_or_legal_note(text):
    normalized = clean_text(text)
    return (
        normalized.startswith(("来源：", "注：", "说明：", "备注："))
        or "公开资料版" in normalized
        or "仅用于公开资料调研" in normalized
        or "未使用未授权" in normalized
        or "不代表真实客户指标" in normalized
    )


def font_sizes(shape):
    sizes = []
    for rpr in shape.findall(".//a:rPr", NS):
        if "sz" in rpr.attrib:
            try:
                sizes.append(int(rpr.attrib["sz"]) / 100)
            except ValueError:
                pass
    return sizes


def srgb_color(el):
    color = el.find("./a:srgbClr", NS)
    if color is not None and re.fullmatch(r"[0-9A-Fa-f]{6}", color.attrib.get("val", "")):
        return color.attrib["val"].upper()
    return None


def shape_fill_color(shape):
    return _fill_color(shape, "./p:spPr")


def text_colors(shape):
    colors = []
    for rpr in shape.findall(".//a:rPr", NS):
        solid = rpr.find("./a:solidFill", NS)
        if solid is None:
            continue
        color = srgb_color(solid)
        if color:
            colors.append(color)
    return colors


def _color_from_solid_fill(solid_fill):
    if solid_fill is None:
        return None, None
    color = solid_fill.find("./a:srgbClr", NS)
    if color is None:
        return None, "non-sRGB color"
    value = color.attrib.get("val", "")
    if not re.fullmatch(r"[0-9A-Fa-f]{6}", value):
        return None, "invalid sRGB color"
    if list(color):
        return None, "sRGB color has transforms or transparency"
    return value.upper(), None


def _fill_color(shape, properties_path):
    properties = shape.find(properties_path, NS)
    if properties is None:
        return None
    solid = properties.find("./a:solidFill", NS)
    if solid is None:
        return None
    color, _ = _color_from_solid_fill(solid)
    return color


def _fill_state(shape, properties_path="./p:spPr"):
    """Return (explicit sRGB color, reason) for a fill, if one is specified."""
    properties = shape if properties_path == "." else shape.find(properties_path, NS)
    if properties is None:
        return None, None
    solid = properties.find("./a:solidFill", NS)
    if solid is not None:
        return _color_from_solid_fill(solid)
    fill_tags = {"gradFill", "blipFill", "pattFill", "grpFill"}
    for child in list(properties):
        if child.tag.rsplit("}", 1)[-1] in fill_tags:
            return None, "complex fill"
    return None, None


def _explicit_text_run_colors(shape):
    """Return visible text run color evidence without guessing theme defaults."""
    parents = {child: parent for parent in shape.iter() for child in list(parent)}
    runs = list(shape.findall(".//a:r", NS)) + list(shape.findall(".//a:fld", NS))
    result = []
    for run in runs:
        text = "".join(node.text or "" for node in run.findall(".//a:t", NS))
        if not text.strip():
            continue
        run_props = run.find("./a:rPr", NS)
        color, reason = _fill_state(run_props, ".") if run_props is not None else (None, None)
        if color is None and reason is None:
            paragraph = parents.get(run)
            paragraph_props = paragraph.find("./a:pPr/a:defRPr", NS) if paragraph is not None else None
            if paragraph_props is not None:
                color, reason = _fill_state(paragraph_props, ".")
        if color is None and reason is None:
            result.append({"text": text, "color": None, "reason": "no explicit run color"})
        else:
            result.append({"text": text, "color": color, "reason": reason})
    if not result and text_of_shape(shape):
        result.append({"text": text_of_shape(shape), "color": None, "reason": "no parseable text runs"})
    return result


def _slide_background_color(root):
    background = root.find("./p:cSld/p:bg", NS)
    if background is None:
        return None, "no explicit slide background"
    solid = background.find("./p:bgPr/a:solidFill", NS)
    if solid is not None:
        return _color_from_solid_fill(solid)
    return None, "complex or inherited slide background"


def _resolve_background(shape, box, order, shape_backgrounds, slide_background):
    own_color, own_reason = _fill_state(shape)
    if own_color is not None:
        return own_color, None
    if own_reason:
        return None, own_reason

    candidates = []
    overlaps = []
    if box is not None:
        for candidate in shape_backgrounds:
            if candidate["order"] >= order or candidate["element"] is shape:
                continue
            intersection = overlap_area(candidate["box"], box)
            if intersection:
                overlaps.append(candidate)
            # Only attribute a fill as the text background when the complete
            # text shape lies inside that filled shape. A partial intersection
            # may mean the text crosses two backgrounds, so it cannot safely
            # inherit the slide background as a fallback.
            if box_contains_with_pad(candidate["box"], box):
                candidates.append(candidate)
    if candidates:
        # Later filled shapes are painted over earlier ones and therefore
        # provide the most relevant explicit background for this text.
        selected = max(candidates, key=lambda item: item["order"])
        later_overlaps = [item for item in overlaps if item["order"] > selected["order"]]
        if later_overlaps:
            return None, "text intersects a later filled shape; visible background depends on z-order"
        if selected["color"] is not None:
            return selected["color"], None
        return None, selected["reason"] or "parent container fill is not explicit sRGB"
    if overlaps:
        return None, "text box partially overlaps a filled shape; background may cross fills"
    return slide_background


def _slide_relationship_targets(zf, slide_name):
    rels_part = posixpath.join(posixpath.dirname(slide_name), "_rels", posixpath.basename(slide_name) + ".rels")
    if rels_part not in zf.namelist():
        return {}
    try:
        rels_root = ET.fromstring(zf.read(rels_part))
    except ET.ParseError:
        return {}
    targets = {}
    for relation in rels_root:
        rel_id = relation.attrib.get("Id")
        target = relation.attrib.get("Target")
        if not rel_id or not target or relation.attrib.get("TargetMode") == "External":
            continue
        targets[rel_id] = posixpath.normpath(target.lstrip("/") if target.startswith("/") else posixpath.join(posixpath.dirname(slide_name), target))
    return targets


def _picture_object_name(picture):
    non_visual = picture.find("./p:nvPicPr/p:cNvPr", NS)
    return non_visual.attrib.get("name", "") if non_visual is not None else ""


def _picture_media_part(picture, relationships):
    blip = picture.find("./p:blipFill/a:blip", NS)
    if blip is None:
        return None
    embed = blip.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed")
    return relationships.get(embed)


def _single_color_glyph(png_bytes):
    """Return the dominant opaque stroke RGB only for transparent, monochrome PNG glyphs."""
    if Image is None:
        return None, "Pillow is unavailable for PNG glyph inspection"
    try:
        with Image.open(BytesIO(png_bytes)) as source:
            if source.width * source.height > 4_000_000:
                return None, "glyph PNG exceeds the safe pixel inspection limit"
            source.load()
            image = source.convert("RGBA")
            alpha = image.getchannel("A")
            if alpha.getextrema()[0] == 255:
                return None, "glyph PNG has no transparent pixels"
            opaque = [pixel[:3] for pixel in image.getdata() if pixel[3] >= 240]
    except Exception as exc:
        return None, f"glyph PNG could not be decoded: {exc}"
    if not opaque:
        return None, "glyph PNG has no sufficiently opaque stroke pixels"
    color, count = Counter(opaque).most_common(1)[0]
    if count / len(opaque) < 0.70:
        return None, "glyph PNG is multicolor or has no dominant monochrome stroke"
    return "".join(f"{channel:02X}" for channel in color), None


def relative_luminance(hex_color):
    def channel(value):
        value = value / 255
        return value / 12.92 if value <= 0.03928 else ((value + 0.055) / 1.055) ** 2.4

    r = channel(int(hex_color[0:2], 16))
    g = channel(int(hex_color[2:4], 16))
    b = channel(int(hex_color[4:6], 16))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(foreground, background):
    fg = relative_luminance(foreground)
    bg = relative_luminance(background)
    lighter = max(fg, bg)
    darker = min(fg, bg)
    return (lighter + 0.05) / (darker + 0.05)


def estimated_visible_text_box(text, box, font_size):
    x, y, w, h = box
    # Approximate the visible glyph span for left-aligned business text. CJK
    # glyphs are close to one em wide; Latin-heavy text is overestimated, which
    # is acceptable for a conservative collision check. This prevents short
    # headings in intentionally wide text boxes from creating false positives.
    estimated_w = int((visible_len(text) * (font_size / 72.0) + 0.10) * EMU_PER_INCH)
    return (x, y, min(w, max(int(0.18 * EMU_PER_INCH), estimated_w)), h)


def is_footer_or_page_number(text, box, footer_y_emu):
    if not box:
        return False
    _, y, _, _ = box
    if y >= footer_y_emu:
        return True
    return bool(re.fullmatch(r"\d{1,3}", clean_text(text)))


def box_label(box):
    x, y, w, h = box
    return f"x={inches(x):.2f}, y={inches(y):.2f}, w={inches(w):.2f}, h={inches(h):.2f}"


def overlap_area(a, b):
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    x_overlap = max(0, min(ax + aw, bx + bw) - max(ax, bx))
    y_overlap = max(0, min(ay + ah, by + bh) - max(ay, by))
    return x_overlap * y_overlap


def x_overlap(a, b):
    ax, _, aw, _ = a
    bx, _, bw, _ = b
    return max(0, min(ax + aw, bx + bw) - max(ax, bx))


def x_overlap_ratio(a, b):
    smallest = min(max(0, a[2]), max(0, b[2]))
    if smallest <= 0:
        return 0
    return x_overlap(a, b) / smallest


def area(box):
    return max(0, box[2]) * max(0, box[3])


def overlap_ratio(a, b):
    smallest = min(area(a), area(b))
    if smallest <= 0:
        return 0
    return overlap_area(a, b) / smallest


def is_small_icon_shape(shape, box):
    if not box:
        return False
    _, _, w, h = box
    if w > int(0.9 * EMU_PER_INCH) or h > int(0.9 * EMU_PER_INCH):
        return False
    prst = shape.find(".//a:prstGeom", NS)
    return prst is not None and prst.attrib.get("prst") == "ellipse"


def box_contains_with_pad(outer, inner, pad=0):
    ox, oy, ow, oh = outer
    ix, iy, iw, ih = inner
    return (
        ix >= ox + pad
        and iy >= oy + pad
        and ix + iw <= ox + ow - pad
        and iy + ih <= oy + oh - pad
    )


def center_inside(outer, inner):
    ox, oy, ow, oh = outer
    ix, iy, iw, ih = inner
    cx = ix + iw / 2
    cy = iy + ih / 2
    return ox <= cx <= ox + ow and oy <= cy <= oy + oh


def union_box(boxes):
    min_x = min(b[0] for b in boxes)
    min_y = min(b[1] for b in boxes)
    max_x = max(b[0] + b[2] for b in boxes)
    max_y = max(b[1] + b[3] for b in boxes)
    return (min_x, min_y, max_x - min_x, max_y - min_y)


def boxes_vertical_gap(upper, lower):
    return lower[1] - (upper[1] + upper[3])


def infer_table_boxes(rect_boxes):
    """Infer editable table-like grids drawn as adjacent rectangle cells."""
    row_tol = int(0.04 * EMU_PER_INCH)
    rows = []
    for box in sorted(rect_boxes, key=lambda b: (b[1], b[0])):
        x, y, w, h = box
        if w < int(0.35 * EMU_PER_INCH) or h < int(0.22 * EMU_PER_INCH):
            continue
        if w > int(6.2 * EMU_PER_INCH) or h > int(1.1 * EMU_PER_INCH):
            continue
        target = None
        for row in rows:
            if abs(row["y"] - y) <= row_tol and abs(row["h"] - h) <= row_tol:
                target = row
                break
        if target is None:
            target = {"y": y, "h": h, "boxes": []}
            rows.append(target)
        target["boxes"].append(box)

    row_bounds = []
    for row in rows:
        if len(row["boxes"]) < 3:
            continue
        row_bounds.append(union_box(row["boxes"]))

    tables = []
    for row in sorted(row_bounds, key=lambda b: b[1]):
        placed = False
        for table in tables:
            tb = table[-1]
            gap = row[1] - (tb[1] + tb[3])
            same_span = abs(row[0] - tb[0]) <= int(0.08 * EMU_PER_INCH) and abs((row[0] + row[2]) - (tb[0] + tb[2])) <= int(0.08 * EMU_PER_INCH)
            if same_span and -row_tol <= gap <= int(0.08 * EMU_PER_INCH):
                table.append(row)
                placed = True
                break
        if not placed:
            tables.append([row])

    return [union_box(table) for table in tables if len(table) >= 2]


def main():
    args = parse_args()
    footer_y_emu = int(args.footer_start_y_in * EMU_PER_INCH)
    min_h_emu = int(args.min_text_height_in * EMU_PER_INCH)
    min_long_h_emu = int(args.min_long_text_height_in * EMU_PER_INCH)
    narrow_w_emu = int(args.long_text_narrow_width_in * EMU_PER_INCH)
    issues = []
    warnings = []
    slide_reports = []
    stats = {
        "text_shapes": 0,
        "font_checked": 0,
        "contrast_checked": 0,
        "contrast_eligible": 0,
        "contrast_unknown": 0,
        "contrast_low_contrast": 0,
        "icon_contrast_checked": 0,
        "icon_contrast_eligible": 0,
        "icon_contrast_unknown": 0,
        "icon_contrast_low_contrast": 0,
        "small_icons": 0,
        "geometry_objects": 0,
        "unresolved_geometry_objects": 0,
    }

    def write_report(report):
        if not args.json_report:
            return
        target = Path(args.json_report)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    try:
        zf = zipfile.ZipFile(args.pptx)
    except FileNotFoundError:
        print(f"FAIL: file not found: {args.pptx}", file=sys.stderr)
        write_report({
            "schema_version": 1,
            "tool": "check_me2026_layout_risks",
            "input": args.pptx,
            "ok": False,
            "summary": {},
            "errors": [{"code": "invalid-input", "slide": None, "message": f"file not found: {args.pptx}"}],
            "warnings": [],
            "slides": [],
        })
        return 2
    except (OSError, zipfile.BadZipFile) as exc:
        message = f"invalid PPTX package: {exc}"
        print(f"FAIL: {message}", file=sys.stderr)
        write_report({
            "schema_version": 1,
            "tool": "check_me2026_layout_risks",
            "input": args.pptx,
            "ok": False,
            "summary": {},
            "errors": [{"code": "invalid-input", "slide": None, "message": message}],
            "warnings": [],
            "slides": [],
        })
        return 2

    with zf:
        slides = sorted(
            [n for n in zf.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", n)],
            key=slide_num,
        )
        for slide_name in slides:
            slide_no = slide_num(slide_name)
            root = ET.fromstring(zf.read(slide_name))
            visual_objects = collect_visual_objects(root)
            geometry_by_element = {obj.element: obj for obj in visual_objects}
            object_order = {obj.element: index for index, obj in enumerate(visual_objects)}
            stats["geometry_objects"] += len(visual_objects)
            stats["unresolved_geometry_objects"] += sum(bool(obj.unresolved_reason) for obj in visual_objects)
            slide_contrast = {
                "checked": 0,
                "eligible": 0,
                "unknown": 0,
                "low_contrast": 0,
                "unknown_reasons": {},
            }
            slide_icon_contrast = {
                "checked": 0,
                "eligible": 0,
                "unknown": 0,
                "low_contrast": 0,
                "unknown_reasons": {},
            }
            slide_issue_start = len(issues)
            text_boxes = []
            small_icon_boxes = []
            container_boxes = []
            rect_boxes = []
            shape_backgrounds = []
            for obj in visual_objects:
                if obj.kind != "shape" or obj.text or obj.box is None:
                    continue
                color, reason = _fill_state(obj.element)
                if color is not None or reason:
                    shape_backgrounds.append({
                        "element": obj.element,
                        "box": obj.box,
                        "color": color,
                        "reason": reason,
                        "order": object_order[obj.element],
                    })
            slide_background = _slide_background_color(root)
            slide_relationships = _slide_relationship_targets(zf, slide_name)
            glyph_color_cache = {}

            for pic in root.findall(".//p:pic", NS):
                box = xfrm_tuple(pic, geometry_by_element)
                object_name = _picture_object_name(pic)
                is_controlled_icon = object_name.startswith(ICON_OBJECT_PREFIX)
                if is_controlled_icon:
                    slide_icon_contrast["eligible"] += 1
                    stats["icon_contrast_eligible"] += 1
                if not box:
                    if is_controlled_icon:
                        slide_icon_contrast["unknown"] += 1
                        stats["icon_contrast_unknown"] += 1
                        reason = "controlled icon picture geometry is unresolved"
                        slide_icon_contrast["unknown_reasons"][reason] = slide_icon_contrast["unknown_reasons"].get(reason, 0) + 1
                    continue
                _, y, w, h = box
                if is_controlled_icon:
                    unknown_reason = None
                    glyph_color = None
                    background_color = None
                    if len(object_name) == len(ICON_OBJECT_PREFIX):
                        unknown_reason = "controlled icon picture has no semantic key"
                    elif w > int(0.9 * EMU_PER_INCH) or h > int(0.9 * EMU_PER_INCH):
                        unknown_reason = "controlled icon picture exceeds the 0.9 inch glyph bounds"
                    else:
                        media_part = _picture_media_part(pic, slide_relationships)
                        if not media_part or media_part not in zf.namelist() or not media_part.startswith("ppt/media/"):
                            unknown_reason = "controlled icon picture has no resolvable embedded media"
                        else:
                            if media_part not in glyph_color_cache:
                                glyph_color_cache[media_part] = _single_color_glyph(zf.read(media_part))
                            glyph_color, glyph_reason = glyph_color_cache[media_part]
                            if glyph_color is None:
                                unknown_reason = glyph_reason
                            else:
                                background_color, background_reason = _resolve_background(
                                    pic,
                                    box,
                                    object_order.get(pic, 0),
                                    shape_backgrounds,
                                    slide_background,
                                )
                                if background_color is None:
                                    unknown_reason = background_reason or "icon background could not be resolved"
                                else:
                                    ratio = contrast_ratio(glyph_color, background_color)
                                    slide_icon_contrast["checked"] += 1
                                    stats["icon_contrast_checked"] += 1
                                    if ratio < 3.0:
                                        slide_icon_contrast["low_contrast"] += 1
                                        stats["icon_contrast_low_contrast"] += 1
                                        issues.append(
                                            f"slide {slide_no}: low icon contrast {ratio:.2f}:1 below 3.0:1 "
                                            f"for '{object_name[len(ICON_OBJECT_PREFIX):]}' glyph={glyph_color} "
                                            f"background={background_color} at {box_label(box)}"
                                        )
                    if unknown_reason:
                        slide_icon_contrast["unknown"] += 1
                        stats["icon_contrast_unknown"] += 1
                        slide_icon_contrast["unknown_reasons"][unknown_reason] = slide_icon_contrast["unknown_reasons"].get(unknown_reason, 0) + 1
                if y >= footer_y_emu:
                    continue
                if w <= int(0.9 * EMU_PER_INCH) and h <= int(0.9 * EMU_PER_INCH):
                    small_icon_boxes.append(("picture icon", box))

            for sp in root.findall(".//p:sp", NS):
                text = text_of_shape(sp)
                box = xfrm_tuple(sp, geometry_by_element)
                if not box:
                    continue
                x, y, w, h = box
                if not text and is_small_icon_shape(sp, box):
                    if y < footer_y_emu:
                        small_icon_boxes.append(("shape icon", box))
                    continue
                if not text:
                    kind = geom_type(sp)
                    if y < footer_y_emu and kind in {"rect", "roundRect"}:
                        if w >= int(0.35 * EMU_PER_INCH) and h >= int(0.20 * EMU_PER_INCH):
                            container_boxes.append((kind, box))
                        if kind == "rect":
                            rect_boxes.append(box)
                    continue
                if is_footer_or_page_number(text, box, footer_y_emu):
                    continue

                stats["text_shapes"] += 1
                clean = clean_text(text)
                vlen = visible_len(text)
                near_bottom_wide_note = y >= int(6.45 * EMU_PER_INCH) and w >= int(8.0 * EMU_PER_INCH) and h <= int(0.26 * EMU_PER_INCH)
                source_or_legal = is_source_or_legal_note(text) or near_bottom_wide_note

                if "\\n" in text:
                    issues.append(f"slide {slide_no}: literal \\\\n in visible text '{clean[:45]}' at {box_label(box)}")
                if h < min_h_emu and vlen > 0:
                    issues.append(
                        f"slide {slide_no}: text box height below {args.min_text_height_in:.2f}in "
                        f"for '{clean[:45]}' at {box_label(box)}"
                    )
                if not source_or_legal and vlen >= args.long_text_min_chars and h < min_long_h_emu:
                    issues.append(
                        f"slide {slide_no}: long text has insufficient height for '{clean[:45]}' "
                        f"at {box_label(box)}"
                    )
                if not source_or_legal and vlen >= args.long_text_min_chars + 2 and w < narrow_w_emu:
                    issues.append(
                        f"slide {slide_no}: long text is in a narrow box for '{clean[:45]}' "
                        f"at {box_label(box)}"
                    )

                sizes = font_sizes(sp)
                min_size = min(sizes) if sizes else args.min_body_font_size
                if sizes:
                    stats["font_checked"] += 1
                    min_allowed = 8.0 if source_or_legal else args.min_body_font_size
                    if min_size < min_allowed:
                        issues.append(
                            f"slide {slide_no}: body font {min_size:g}pt below {min_allowed:g}pt "
                            f"for '{clean[:45]}' at {box_label(box)}"
                        )

                if not source_or_legal:
                    run_colors = _explicit_text_run_colors(sp)
                    background_color, background_reason = _resolve_background(
                        sp,
                        box,
                        object_order.get(sp, 0),
                        shape_backgrounds,
                        slide_background,
                    )
                    if not run_colors:
                        run_colors = [{"text": text, "color": None, "reason": "no parseable text runs"}]
                    for run in run_colors:
                        slide_contrast["eligible"] += 1
                        stats["contrast_eligible"] += 1
                        color = run["color"]
                        if color is None or background_color is None:
                            slide_contrast["unknown"] += 1
                            stats["contrast_unknown"] += 1
                            reason = run["reason"] or background_reason or "unresolved contrast inputs"
                            slide_contrast["unknown_reasons"][reason] = slide_contrast["unknown_reasons"].get(reason, 0) + 1
                            continue
                        threshold = args.min_contrast_large if min_size >= 18 else args.min_contrast_body
                        ratio = contrast_ratio(color, background_color)
                        slide_contrast["checked"] += 1
                        stats["contrast_checked"] += 1
                        if ratio < threshold:
                            slide_contrast["low_contrast"] += 1
                            stats["contrast_low_contrast"] += 1
                            issues.append(
                                f"slide {slide_no}: low text contrast {ratio:.2f}:1 below {threshold:.1f}:1 "
                                f"for '{clean[:45]}' text={color} background={background_color} at {box_label(box)}"
                            )

                if not source_or_legal and vlen > 2:
                    text_boxes.append({
                        "text": clean,
                        "box": box,
                        "effective_box": estimated_visible_text_box(text, box, min_size),
                    })

            table_boxes = infer_table_boxes(rect_boxes)
            stats["small_icons"] += len(small_icon_boxes)

            for table_box in table_boxes:
                for kind, box in container_boxes:
                    if box == table_box:
                        continue
                    gap = boxes_vertical_gap(table_box, box)
                    if gap < 0 or gap > int(args.min_table_module_gap_in * EMU_PER_INCH):
                        continue
                    if x_overlap_ratio(table_box, box) < 0.35:
                        continue
                    issues.append(
                        f"slide {slide_no}: module too close below table/grid; "
                        f"gap={inches(gap):.2f}in, table={box_label(table_box)}, module={box_label(box)}"
                    )

                for text_item in text_boxes:
                    box = text_item["box"]
                    gap = boxes_vertical_gap(table_box, box)
                    if gap < 0 or gap > int(args.min_table_note_gap_in * EMU_PER_INCH):
                        continue
                    if x_overlap_ratio(table_box, box) < 0.35:
                        continue
                    if box[2] < int(4.0 * EMU_PER_INCH) and not text_item["text"].startswith(("约束", "结论", "提示", "说明")):
                        continue
                    issues.append(
                        f"slide {slide_no}: note/text too close below table/grid; "
                        f"gap={inches(gap):.2f}in for '{text_item['text'][:36]}', table={box_label(table_box)}, text={box_label(box)}"
                    )

            for i, first in enumerate(text_boxes):
                for second in text_boxes[i + 1 :]:
                    ratio = overlap_ratio(first["effective_box"], second["effective_box"])
                    if ratio >= args.text_overlap_ratio:
                        issues.append(
                            f"slide {slide_no}: text boxes overlap ({ratio:.0%}) between "
                            f"'{first['text'][:28]}' at {box_label(first['box'])} and "
                            f"'{second['text'][:28]}' at {box_label(second['box'])}"
                        )
            for text_item in text_boxes:
                for icon_kind, icon_box in small_icon_boxes:
                    ratio = overlap_ratio(text_item["effective_box"], icon_box)
                    if ratio >= args.icon_overlap_ratio:
                        issues.append(
                            f"slide {slide_no}: text overlaps {icon_kind} ({ratio:.0%}) for "
                            f"'{text_item['text'][:36]}' at {box_label(text_item['box'])}; icon at {box_label(icon_box)}"
                        )

            containment_pad = int(args.container_padding_in * EMU_PER_INCH)
            for text_item in text_boxes:
                text_box = text_item["box"]
                candidates = []
                for kind, container in container_boxes:
                    if kind != "roundRect":
                        continue
                    if not center_inside(container, text_box):
                        continue
                    if container[2] <= text_box[2] * 0.65 or container[3] <= text_box[3] * 0.65:
                        continue
                    candidates.append((area(container), kind, container))
                if not candidates:
                    continue
                _, kind, parent = sorted(candidates, key=lambda item: item[0])[0]
                if not box_contains_with_pad(parent, text_box, -containment_pad):
                    issues.append(
                        f"slide {slide_no}: text box exceeds parent {kind} bounds for "
                        f"'{text_item['text'][:42]}' at {box_label(text_box)}; parent={box_label(parent)}"
                    )
                    continue
                # Large horizontal cards need stronger inner padding because
                # edge-touching body copy is visually perceived as crossing the
                # frame even when the OOXML box technically remains inside.
                if kind == "roundRect" and parent[2] >= int(3.0 * EMU_PER_INCH) and parent[3] >= int(0.65 * EMU_PER_INCH):
                    px, py, pw, ph = parent
                    tx, ty, tw, th = text_box
                    close_bottom = py + ph - (ty + th)
                    close_right = px + pw - (tx + tw)
                    if close_bottom < containment_pad or close_right < containment_pad:
                        issues.append(
                            f"slide {slide_no}: text box is too close to parent {kind} edge for "
                            f"'{text_item['text'][:42]}' at {box_label(text_box)}; parent={box_label(parent)}"
                        )

            coverage = (
                slide_contrast["checked"] / slide_contrast["eligible"]
                if slide_contrast["eligible"]
                else None
            )
            icon_coverage = (
                slide_icon_contrast["checked"] / slide_icon_contrast["eligible"]
                if slide_icon_contrast["eligible"]
                else None
            )
            slide_report = {
                "slide": slide_no,
                "contrast": {
                    **slide_contrast,
                    "coverage_ratio": coverage,
                },
                "icon_contrast": {
                    **slide_icon_contrast,
                    "coverage_ratio": icon_coverage,
                },
                "geometry_objects": len(visual_objects),
                "unresolved_geometry_objects": sum(bool(obj.unresolved_reason) for obj in visual_objects),
                "issues": issues[slide_issue_start:],
            }
            slide_reports.append(slide_report)
            if slide_contrast["eligible"] and slide_contrast["checked"] == 0:
                warnings.append({
                    "code": "contrast-no-coverage",
                    "slide": slide_no,
                    "message": "no text contrast comparisons could be resolved; this is not a contrast pass",
                    "coverage_ratio": 0.0,
                    "unknown": slide_contrast["unknown"],
                })
            elif slide_contrast["unknown"]:
                warnings.append({
                    "code": "contrast-partial-coverage",
                    "slide": slide_no,
                    "message": "some text contrast cases use complex, inherited, or unresolved colors",
                    "coverage_ratio": coverage,
                    "unknown": slide_contrast["unknown"],
                })
            if slide_icon_contrast["eligible"] and slide_icon_contrast["checked"] == 0:
                warnings.append({
                    "code": "icon-contrast-no-coverage",
                    "slide": slide_no,
                    "message": "no controlled glyph icon contrast comparisons could be resolved; this is not an icon contrast pass",
                    "coverage_ratio": 0.0,
                    "unknown": slide_icon_contrast["unknown"],
                })
            elif slide_icon_contrast["unknown"]:
                warnings.append({
                    "code": "icon-contrast-partial-coverage",
                    "slide": slide_no,
                    "message": "some controlled glyph icons require visual contrast review",
                    "coverage_ratio": icon_coverage,
                    "unknown": slide_icon_contrast["unknown"],
                })

    if issues:
        print(f"FAIL: {len(issues)} ME2026 layout risk(s) detected")
        for issue in issues[: args.max_issues]:
            print(f"- {issue}")
        if len(issues) > args.max_issues:
            print(f"... {len(issues) - args.max_issues} more issue(s) truncated")
        status = 1
    else:
        status = 0

    overall_coverage = (
        stats["contrast_checked"] / stats["contrast_eligible"]
        if stats["contrast_eligible"]
        else None
    )
    icon_overall_coverage = (
        stats["icon_contrast_checked"] / stats["icon_contrast_eligible"]
        if stats["icon_contrast_eligible"]
        else None
    )
    if status == 0 and warnings:
        print("PASS WITH WARNINGS: no layout risks detected; contrast coverage is incomplete")
    elif status == 0:
        print("PASS: no ME2026 layout risks detected")
    print(
        f"summary: text_shapes={stats['text_shapes']} font_checked={stats['font_checked']} "
        f"contrast_checked={stats['contrast_checked']}/{stats['contrast_eligible']} "
        f"contrast_coverage={overall_coverage if overall_coverage is not None else 'n/a'} "
        f"contrast_unknown={stats['contrast_unknown']} low_contrast={stats['contrast_low_contrast']} "
        f"icon_contrast={stats['icon_contrast_checked']}/{stats['icon_contrast_eligible']} "
        f"icon_contrast_unknown={stats['icon_contrast_unknown']} icon_low_contrast={stats['icon_contrast_low_contrast']} "
        f"small_icons={stats['small_icons']} geometry_objects={stats['geometry_objects']}"
    )
    report = {
        "schema_version": 1,
        "tool": "check_me2026_layout_risks",
        "input": args.pptx,
        "ok": status == 0,
        "summary": {
            **stats,
            "contrast_coverage_ratio": overall_coverage,
            "icon_contrast_coverage_ratio": icon_overall_coverage,
        },
        "errors": [
            {
                "code": "layout-risk",
                "slide": int(match.group(1)) if (match := re.search(r"slide\s+(\d+)", issue)) else None,
                "message": issue,
            }
            for issue in issues
        ],
        "warnings": warnings,
        "slides": slide_reports,
    }
    try:
        write_report(report)
    except OSError as exc:
        print(f"ERROR: unable to write JSON report: {exc}", file=sys.stderr)
        return 2
    return status


if __name__ == "__main__":
    sys.exit(main())
