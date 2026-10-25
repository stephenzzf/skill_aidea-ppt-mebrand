#!/usr/bin/env python3
import argparse
from collections import Counter
import html
import json
import os
from pathlib import Path
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

from pptx_geometry import (
    collect_visual_objects,
    image_union_summary,
    is_out_of_bounds,
)
from pptx_package_checks import check_package

NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
}

EMU_PER_INCH = 914400
BODY_AREA_TOP_IN = 1.55
BODY_AREA_BOTTOM_IN = 6.20
TITLE_AREA_BOTTOM_IN = 2.55
RASTER_BODY_COVERAGE_THRESHOLD = 0.90
TITLE_NAME_RE = re.compile(r"(?:^|[\s_.-])(title|subtitle|heading|标题|副标题|主标题)(?:$|[\s_.-])", re.IGNORECASE)


def parse_args():
    parser = argparse.ArgumentParser(description="Inspect ME brand PPTX package quality.")
    parser.add_argument("pptx")
    parser.add_argument("--expected-slides", type=int)
    parser.add_argument("--required-text", action="append", default=[])
    parser.add_argument("--required-font", action="append", default=[])
    parser.add_argument("--forbid-font", action="append", default=[])
    parser.add_argument("--allowed-color", action="append", default=[])
    parser.add_argument("--print-style-summary", action="store_true")
    parser.add_argument(
        "--json-report",
        help="Optional path for a machine-readable QA report; stdout remains human-readable.",
    )
    parser.add_argument("--check-numbered-circles", action="store_true")
    parser.add_argument("--check-package-compatibility", action="store_true")
    parser.add_argument("--check-no-fullslide-images", action="store_true")
    parser.add_argument(
        "--allow-fullslide-image-slides",
        default="",
        help="Comma-separated slide numbers allowed to use full-slide decorative images.",
    )
    parser.add_argument(
        "--allow-body-image-only-slides",
        default=None,
        help="Comma-separated slide numbers exempt from the editable body-content contract (for cover/section/closing roles).",
    )
    parser.add_argument("--check-integer-font-sizes", action="store_true")
    parser.add_argument("--min-font-size", type=float)
    parser.add_argument("--check-header-safe-zone", action="store_true")
    parser.add_argument("--header-safe-y-in", type=float, default=1.55)
    parser.add_argument("--header-text-count", type=int, default=2)
    parser.add_argument("--check-me2026-footer-logo-alignment", action="store_true")
    parser.add_argument("--check-icon-card-alignment", action="store_true")
    parser.add_argument("--check-label-text-row-alignment", action="store_true")
    parser.add_argument("--alignment-tolerance-in", type=float, default=0.08)
    return parser.parse_args()


def slide_num(name):
    match = re.search(r"slide(\d+)\.xml$", name)
    return int(match.group(1)) if match else 0


def read_xml(zf, name):
    return zf.read(name).decode("utf-8", errors="ignore")


def get_slide_size(zf):
    try:
        root = ET.fromstring(zf.read("ppt/presentation.xml"))
    except (KeyError, ET.ParseError):
        return None
    size = root.find(".//p:sldSz", NS)
    if size is None:
        return None
    try:
        return int(size.attrib["cx"]), int(size.attrib["cy"])
    except (KeyError, TypeError, ValueError):
        return None


def collect_text(zf, slides):
    chunks = []
    for name in slides:
        xml = read_xml(zf, name)
        chunks.extend(html.unescape(t) for t in re.findall(r"<a:t>(.*?)</a:t>", xml))
    return "".join(chunks)


def collect_style(zf, slides):
    fonts = Counter()
    colors = Counter()
    sizes = Counter()
    for name in slides:
        xml = read_xml(zf, name)
        for font in re.findall(r'<a:(?:latin|ea|cs)[^>]*typeface="([^"]+)"', xml):
            if font and not font.startswith("+"):
                fonts[font] += 1
        for color in re.findall(r'<a:srgbClr val="([0-9A-Fa-f]{6})"', xml):
            colors[color.upper()] += 1
        for size in re.findall(r'<a:rPr[^>]*sz="(\d+)"', xml):
            sizes[f"{int(size) / 100:g}"] += 1
    return fonts, colors, sizes


def parsed_font_sizes(sizes):
    values = []
    for size in sizes:
        try:
            values.append(float(size))
        except ValueError:
            continue
    return values


def xfrm_tuple(el):
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


def center_y(box):
    return box[1] + box[3] / 2


def in_to_emu(value):
    return int(value * EMU_PER_INCH)


def text_of_shape(shape):
    return "".join(t.text or "" for t in shape.findall(".//a:t", NS)).strip()


def is_footer_text(text, box):
    if not box:
        return False
    _, y, _, _ = box
    return y > 6_200_000 or re.fullmatch(r"\d{1,2}", text or "")


def _is_title_text_object(obj, all_text_objects, canvas):
    """Use OOXML role/name first, then a conservative top-band fallback.

    A single wide, shallow text box near the top of a slide is commonly the
    editable title. It cannot satisfy the body-editability contract by itself.
    """
    element = obj.element
    placeholder = element.find(".//p:nvSpPr/p:nvPr/p:ph", NS)
    if placeholder is not None and placeholder.attrib.get("type") in {"title", "ctrTitle", "subTitle"}:
        return True
    nonvisual = element.find(".//p:cNvPr", NS)
    shape_name = nonvisual.attrib.get("name", "") if nonvisual is not None else ""
    if TITLE_NAME_RE.search(shape_name):
        return True
    if len(all_text_objects) != 1 or obj.box is None or canvas is None:
        return False
    _, y, w, h = obj.box
    return (
        y < int(TITLE_AREA_BOTTOM_IN * EMU_PER_INCH)
        and h <= int(1.2 * EMU_PER_INCH)
        and w >= canvas[2] * 0.65
    )


def _overlaps_body_area(obj):
    if obj.box is None:
        return False
    _, y, _, h = obj.box
    body_top = int(BODY_AREA_TOP_IN * EMU_PER_INCH)
    body_bottom = int(BODY_AREA_BOTTOM_IN * EMU_PER_INCH)
    return y < body_bottom and y + h > body_top


def check_header_safe_zone(zf, slides, safe_y_in, header_text_count):
    errors = []
    safe_y = int(safe_y_in * 914400)
    for name in slides:
        root = ET.fromstring(zf.read(name))
        header_text_seen = 0
        for sp in root.findall(".//p:sp", NS):
            text = text_of_shape(sp)
            if not text:
                continue
            box = xfrm_tuple(sp)
            if not box:
                continue
            if is_footer_text(text, box):
                continue
            if header_text_seen < header_text_count:
                header_text_seen += 1
                continue
            x, y, w, h = box
            if y < safe_y:
                clean = re.sub(r"\s+", " ", text)[:40]
                errors.append(
                    f"{name}: body text enters header safe zone before {safe_y_in:g}in: "
                    f"'{clean}' at {(x, y, w, h)}"
                )
    return errors


def check_numbered_circles(zf, slides):
    errors = []
    for name in slides:
        root = ET.fromstring(zf.read(name))
        ellipses = set()
        for sp in root.findall(".//p:sp", NS):
            prst = sp.find(".//a:prstGeom", NS)
            if prst is not None and prst.attrib.get("prst") == "ellipse":
                box = xfrm_tuple(sp)
                if box:
                    ellipses.add(box)
        for sp in root.findall(".//p:sp", NS):
            text = text_of_shape(sp)
            if not re.fullmatch(r"\d{1,2}", text):
                continue
            box = xfrm_tuple(sp)
            if not box:
                continue
            x, y, w, h = box
            # Ignore title badges and tiny footer page numbers. They are page
            # markers, not numbered content circles.
            if x < 900_000 and y < 650_000:
                continue
            if y > 6_200_000 or w < 300_000 or h < 300_000:
                continue
            if abs(w - h) > 2000:
                errors.append(f"{name}: numbered text '{text}' box is not square: {box}")
            if box not in ellipses:
                errors.append(f"{name}: numbered text '{text}' has no same-bounds ellipse: {box}")
    return errors


def parse_slide_allowlist(value):
    allowed = set()
    for item in (value or "").split(","):
        item = item.strip()
        if not item:
            continue
        try:
            allowed.add(int(item))
        except ValueError:
            continue
    return allowed


def check_me2026_footer_logo_alignment(zf, slides, tolerance_in=0.12):
    errors = []
    tolerance = in_to_emu(tolerance_in)
    footer_y_min = in_to_emu(6.75)
    footer_x_max = in_to_emu(3.6)
    divider_x_min = in_to_emu(1.7)
    divider_x_max = in_to_emu(2.15)
    for name in slides:
      root = ET.fromstring(zf.read(name))
      pics = []
      for pic in root.findall(".//p:pic", NS):
          box = xfrm_tuple(pic)
          if not box:
              continue
          x, y, w, h = box
          if x < footer_x_max and y > footer_y_min and h < in_to_emu(0.35):
              pics.append(box)
      if len(pics) < 2:
          continue
      pics = sorted(pics, key=lambda b: b[0])[:2]
      pic_centers = [center_y(box) for box in pics]
      if max(pic_centers) - min(pic_centers) > tolerance:
          errors.append(f"{name}: ME2026 footer logo centers are not aligned: {pics}")

      dividers = []
      for el in list(root.findall(".//p:cxnSp", NS)) + list(root.findall(".//p:sp", NS)):
          box = xfrm_tuple(el)
          if not box:
              continue
          x, y, w, h = box
          if divider_x_min <= x <= divider_x_max and y > footer_y_min and h <= in_to_emu(0.35):
              text = text_of_shape(el)
              if not text:
                  dividers.append(box)
      if dividers:
          divider_center = center_y(sorted(dividers, key=lambda b: abs(center_y(b) - sum(pic_centers) / len(pic_centers)))[0])
          if abs(divider_center - sum(pic_centers) / len(pic_centers)) > tolerance:
              errors.append(f"{name}: ME2026 footer divider is not aligned with logos: {dividers[0]}")
    return errors


def check_icon_card_alignment(zf, slides, tolerance_in=0.12):
    errors = []
    tolerance = in_to_emu(tolerance_in)
    min_d = in_to_emu(0.42)
    max_d = in_to_emu(1.08)
    same_column_tolerance = in_to_emu(0.12)
    for name in slides:
        root = ET.fromstring(zf.read(name))
        texts = []
        for sp in root.findall(".//p:sp", NS):
            text = re.sub(r"\s+", " ", text_of_shape(sp)).strip()
            box = xfrm_tuple(sp)
            if not text or not box or re.fullmatch(r"\d{1,2}", text):
                continue
            texts.append((text, box))
        for sp in root.findall(".//p:sp", NS):
            prst = sp.find(".//a:prstGeom", NS)
            if prst is None or prst.attrib.get("prst") != "ellipse":
                continue
            box = xfrm_tuple(sp)
            if not box:
                continue
            x, y, w, h = box
            if not (min_d <= w <= max_d and min_d <= h <= max_d):
                continue
            if y < in_to_emu(1.2) or y > in_to_emu(6.7):
                continue
            candidates = []
            for text, tbox in texts:
                tx, ty, tw, th = tbox
                if tx <= x + w * 0.75:
                    continue
                if tx > x + w + in_to_emu(2.15):
                    continue
                if abs(center_y(tbox) - center_y(box)) > in_to_emu(0.55):
                    continue
                candidates.append((text, tbox))
            if not candidates:
                continue
            # Stacked icon rows intentionally center the icon against the whole
            # row while title and body occupy separate upper/lower text zones.
            # They are validated by check_me2026_layout_risks.py for text/icon
            # overlap, not by this same-row icon/title alignment rule.
            stacked = False
            for _, upper in candidates:
                for _, lower in candidates:
                    if upper == lower:
                        continue
                    if abs(upper[0] - lower[0]) > same_column_tolerance:
                        continue
                    if center_y(upper) < center_y(box) < center_y(lower):
                        stacked = True
                        break
                if stacked:
                    break
            if stacked:
                continue
            text, tbox = sorted(candidates, key=lambda item: (item[1][0], abs(center_y(item[1]) - center_y(box))))[0]
            if abs(center_y(tbox) - center_y(box)) > tolerance:
                clean = text[:28]
                errors.append(f"{name}: icon/title centers are not aligned near '{clean}': icon={box} text={tbox}")
    return errors


def box_contains(outer, inner, pad=0):
    ox, oy, ow, oh = outer
    ix, iy, iw, ih = inner
    return (
        ix >= ox - pad
        and iy >= oy - pad
        and ix + iw <= ox + ow + pad
        and iy + ih <= oy + oh + pad
    )


def check_label_text_row_alignment(zf, slides, tolerance_in=0.08):
    errors = []
    tolerance = in_to_emu(tolerance_in)
    contain_pad = in_to_emu(0.04)
    for name in slides:
        root = ET.fromstring(zf.read(name))
        text_shapes = []
        label_cards = []
        for sp in root.findall(".//p:sp", NS):
            box = xfrm_tuple(sp)
            if not box:
                continue
            text = re.sub(r"\s+", " ", text_of_shape(sp)).strip()
            x, y, w, h = box
            if text:
                if not is_footer_text(text, box):
                    text_shapes.append((text, box))
                continue
            prst = sp.find(".//a:prstGeom", NS)
            if prst is None or prst.attrib.get("prst") != "roundRect":
                continue
            if (
                in_to_emu(0.7) <= w <= in_to_emu(2.4)
                and in_to_emu(0.25) <= h <= in_to_emu(0.75)
                and in_to_emu(1.2) <= y <= in_to_emu(6.7)
            ):
                label_cards.append(box)

        for card_box in label_cards:
            cx, cy, cw, ch = card_box
            labels = [
                (text, box)
                for text, box in text_shapes
                if len(text) <= 12 and box_contains(card_box, box, contain_pad)
            ]
            if not labels:
                continue
            label_text, label_box = sorted(labels, key=lambda item: abs(center_y(item[1]) - center_y(card_box)))[0]
            bodies = []
            for text, box in text_shapes:
                if box == label_box:
                    continue
                tx, ty, tw, th = box
                if tx <= cx + cw + in_to_emu(0.06):
                    continue
                if tx > cx + cw + in_to_emu(0.45):
                    continue
                if tw < in_to_emu(2.5) and len(text) < 14:
                    continue
                if abs(center_y(box) - center_y(card_box)) > in_to_emu(0.3):
                    continue
                bodies.append((text, box))
            if not bodies:
                continue
            body_text, body_box = sorted(bodies, key=lambda item: (item[1][0], abs(center_y(item[1]) - center_y(card_box))))[0]
            centers = [center_y(card_box), center_y(label_box), center_y(body_box)]
            if max(centers) - min(centers) > tolerance:
                errors.append(
                    f"{name}: label/text row centers are not aligned near '{label_text}' / '{body_text[:28]}': "
                    f"label_card={card_box} label_text={label_box} body={body_box}"
                )
    return errors


def check_fullslide_images(zf, slides, slide_size, allowed_slides=None):
    if not slide_size:
        return ["presentation slide size not found"]
    errors = []
    allowed_slides = allowed_slides or set()
    for name in slides:
        num = slide_num(name)
        root = ET.fromstring(zf.read(name))
        if num in allowed_slides:
            continue
        canvas = (0, 0, slide_size[0], slide_size[1])
        objects = collect_visual_objects(root)
        pictures = [obj for obj in objects if obj.kind == "picture" and obj.box]
        union = image_union_summary(objects, canvas)
        full_picture = any(
            obj.box[2] >= slide_size[0] * 0.93 and obj.box[3] >= slide_size[1] * 0.93
            for obj in pictures
        )
        tiled_picture = (union["coverage_ratio"] or 0) >= 0.93
        if full_picture or tiled_picture:
            count = len(pictures)
            errors.append(
                f"{name}: picture union covers {union['coverage_ratio']:.1%} of the canvas "
                f"({count} picture object(s)); possible full-slide or tiled raster page"
            )
    return errors


def _box_json(box):
    return list(box) if box is not None else None


def _page_metrics(root, slide_size):
    canvas = (0, 0, slide_size[0], slide_size[1]) if slide_size else None
    objects = collect_visual_objects(root)
    leaves = [obj for obj in objects if obj.kind != "group"]
    text_objects = [obj for obj in leaves if obj.text]
    non_footer_text_chars = sum(
        obj.text_chars
        for obj in text_objects
        if obj.box is not None and not is_footer_text(obj.text, obj.box)
    )
    body_text_objects = [
        obj for obj in text_objects
        if not is_footer_text(obj.text, obj.box)
        and not _is_title_text_object(obj, text_objects, canvas)
        and _overlaps_body_area(obj)
    ]
    substantive_body_text_chars = sum(obj.text_chars for obj in body_text_objects)
    body_native_data_objects = [
        obj for obj in objects
        if obj.kind == "graphic_frame" and obj.graphic_kind in {"table", "chart"}
        and _overlaps_body_area(obj)
    ]
    picture_boxes = [obj.box for obj in objects if obj.kind == "picture" and obj.box]
    image_union = image_union_summary(objects, canvas)
    if canvas is not None:
        body_canvas = (
            canvas[0],
            int(BODY_AREA_TOP_IN * EMU_PER_INCH),
            canvas[2],
            min(canvas[3], int(BODY_AREA_BOTTOM_IN * EMU_PER_INCH)) - int(BODY_AREA_TOP_IN * EMU_PER_INCH),
        )
        body_image_union = image_union_summary(objects, body_canvas)
    else:
        body_image_union = {"area_emu2": 0, "coverage_ratio": None, "bounds_emu": None}
    counts = {
        "text_shapes": len(text_objects),
        "text_chars": sum(obj.text_chars for obj in text_objects),
        # Retain the historical broad count for existing consumers. The new
        # substantive count excludes title/header/footer objects by role and
        # body-area geometry.
        "body_text_chars": non_footer_text_chars,
        "substantive_body_text_chars": substantive_body_text_chars,
        "body_text_objects": len(body_text_objects),
        "pictures": sum(obj.kind == "picture" for obj in objects),
        "shapes": sum(obj.kind in {"shape", "connector"} for obj in objects),
        "graphic_frames": sum(obj.kind == "graphic_frame" for obj in objects),
        "groups": sum(obj.kind == "group" for obj in objects),
        "tables": sum(obj.kind == "graphic_frame" and obj.graphic_kind == "table" for obj in objects),
        "charts": sum(obj.kind == "graphic_frame" and obj.graphic_kind == "chart" for obj in objects),
    }
    editable_text_objects = sum(
        bool(obj.text) and obj.kind in {"shape", "connector", "graphic_frame"}
        for obj in leaves
    )
    editable_text_shapes = sum(
        bool(obj.text) and obj.kind in {"shape", "connector"}
        for obj in leaves
    )
    editable_graphic_frame_text_objects = sum(
        bool(obj.text) and obj.kind == "graphic_frame"
        for obj in leaves
    )
    editable_shapes = sum(obj.kind in {"shape", "connector"} for obj in objects)
    unresolved = [
        {"kind": obj.kind, "reason": obj.unresolved_reason}
        for obj in objects
        if obj.unresolved_reason
    ]
    out_of_bounds = [
        {
            "kind": obj.kind,
            "box_emu": _box_json(obj.box),
            "graphic_kind": obj.graphic_kind,
        }
        for obj in objects
        if obj.box is not None and canvas is not None and is_out_of_bounds(obj.box, canvas)
    ]
    body_image_only = (
        body_image_union["coverage_ratio"] is not None
        and body_image_union["coverage_ratio"] >= RASTER_BODY_COVERAGE_THRESHOLD
        and substantive_body_text_chars < 40
        and not body_native_data_objects
    )
    return {
        "counts": counts,
        "image_union": {
            "area_emu2": image_union["area_emu2"],
            "coverage_ratio": image_union["coverage_ratio"],
            "bounds_emu": _box_json(image_union["bounds_emu"]),
        },
        "editability": {
            "editable_text_objects": editable_text_objects,
            "editable_text_shapes": editable_text_shapes,
            "editable_graphic_frame_text_objects": editable_graphic_frame_text_objects,
            "editable_shape_objects": editable_shapes,
            "picture_objects": counts["pictures"],
            "native_tables": counts["tables"],
            "native_charts": counts["charts"],
            "body_image_coverage": body_image_union["coverage_ratio"],
            "substantive_body_text_chars": substantive_body_text_chars,
            "body_native_tables": sum(obj.graphic_kind == "table" for obj in body_native_data_objects),
            "body_native_charts": sum(obj.graphic_kind == "chart" for obj in body_native_data_objects),
            "has_body_text": substantive_body_text_chars > 0,
            "has_native_body_content": substantive_body_text_chars >= 40 or bool(body_native_data_objects),
            "body_image_only_suspected": body_image_only,
        },
        "unresolved_geometry": unresolved,
        "out_of_bounds": out_of_bounds,
        "_picture_boxes": picture_boxes,
    }


def _write_json_report(path, report):
    if not path:
        return
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _error_detail(message, slide=None, code="validation-error"):
    if slide is None:
        match = re.search(r"\bslide(?:\s+)?(\d+)\b", message)
        if match:
            slide = int(match.group(1))
    return {"code": code, "slide": slide, "message": message}


def main():
    args = parse_args()
    errors = []
    structured_errors = []
    warnings = []
    page_reports = []
    if not os.path.exists(args.pptx) or os.path.getsize(args.pptx) == 0:
        print(f"ERROR: missing or empty PPTX: {args.pptx}", file=sys.stderr)
        _write_json_report(args.json_report, {
            "schema_version": 1,
            "tool": "inspect_pptx",
            "input": args.pptx,
            "ok": False,
            "summary": {},
            "errors": [_error_detail(f"missing or empty PPTX: {args.pptx}", code="invalid-input")],
            "warnings": [],
            "slides": [],
        })
        return 2

    try:
        zf_context = zipfile.ZipFile(args.pptx)
    except (OSError, zipfile.BadZipFile) as exc:
        message = f"invalid PPTX package: {exc}"
        print(f"ERROR: {message}", file=sys.stderr)
        try:
            _write_json_report(args.json_report, {
                "schema_version": 1,
                "tool": "inspect_pptx",
                "input": args.pptx,
                "ok": False,
                "summary": {},
                "errors": [_error_detail(message, code="invalid-input")],
                "warnings": [],
                "slides": [],
            })
        except OSError as report_exc:
            print(f"ERROR: unable to write JSON report: {report_exc}", file=sys.stderr)
            return 2
        return 2

    with zf_context as zf:
        package_findings = check_package(zf) if args.check_package_compatibility else []
        for finding in package_findings:
            detail = {**finding, "message": f"{finding['part']}: {finding['message']}"}
            structured_errors.append(detail)
            errors.append(detail["message"])
        names = zf.namelist()
        slides = sorted(
            [n for n in names if re.match(r"ppt/slides/slide\d+\.xml$", n)],
            key=slide_num,
        )
        media = [n for n in names if n.startswith("ppt/media/") and not n.endswith("/")]
        slide_size = get_slide_size(zf)
        canvas = (0, 0, slide_size[0], slide_size[1]) if slide_size else None
        text = collect_text(zf, slides)
        fonts, colors, sizes = collect_style(zf, slides)

        for name in slides:
            slide_root = ET.fromstring(zf.read(name))
            page_no = slide_num(name)
            page = _page_metrics(slide_root, slide_size)
            page.pop("_picture_boxes", None)
            page["slide"] = page_no
            page["canvas_emu"] = _box_json(canvas)
            page_reports.append(page)
            for item in page["out_of_bounds"]:
                message = (
                    f"slide {page_no}: {item['kind']} object is outside slide canvas at "
                    f"{tuple(item['box_emu'])}"
                )
                errors.append(message)
                structured_errors.append(_error_detail(message, page_no, "out-of-bounds"))
            if page["unresolved_geometry"]:
                warnings.append({
                    "code": "unresolved-geometry",
                    "slide": page_no,
                    "message": f"{len(page['unresolved_geometry'])} object(s) lack complete geometry",
                    "objects": page["unresolved_geometry"],
                })

        if args.expected_slides is not None and len(slides) != args.expected_slides:
            errors.append(f"expected {args.expected_slides} slides, found {len(slides)}")
        valid_sizes = {(12191695, 6858000), (12192000, 6858000)}
        if slide_size not in valid_sizes:
            errors.append(f"unexpected slide size EMU: {slide_size}")
        for required in args.required_text:
            if required not in text:
                errors.append(f"missing required text: {required}")
        for required in args.required_font:
            if fonts[required] == 0:
                errors.append(f"missing required font: {required}")
        for forbidden in args.forbid_font:
            if fonts[forbidden] > 0:
                errors.append(f"forbidden font present: {forbidden} ({fonts[forbidden]})")
        if args.allowed_color:
            allowed = {c.upper().lstrip("#") for c in args.allowed_color}
            for color, count in colors.items():
                if color not in allowed:
                    errors.append(f"color outside allowed palette: {color} ({count})")
        for item in media:
            if len(zf.read(item)) == 0:
                errors.append(f"empty media file: {item}")
        if any("ChatGPT Image" in n for n in names):
            errors.append("source screenshot filename found inside package")
        if args.check_numbered_circles:
            errors.extend(check_numbered_circles(zf, slides))
        if args.check_no_fullslide_images:
            fullslide_allowed = parse_slide_allowlist(args.allow_fullslide_image_slides)
            fullslide_errors = check_fullslide_images(
                zf,
                slides,
                slide_size,
                fullslide_allowed,
            )
            errors.extend(fullslide_errors)
            structured_errors.extend(_error_detail(error, code="fullslide-image") for error in fullslide_errors)
            # Preserve standalone inspector behavior when the caller only
            # supplies the historic full-slide allowlist. QA passes this
            # second allowlist explicitly so a decorative-background waiver
            # never waives the body-editability requirement.
            if args.allow_body_image_only_slides is None:
                body_exempt = fullslide_allowed
            else:
                body_exempt = parse_slide_allowlist(args.allow_body_image_only_slides)
            page_by_num = {page["slide"]: page for page in page_reports}
            for page_no, page in page_by_num.items():
                if page_no in body_exempt or not page["editability"]["body_image_only_suspected"]:
                    continue
                message = (
                    f"slide {page_no}: body region is raster-dominated without substantive native body text, table, or chart "
                    f"(body image coverage={page['editability']['body_image_coverage']:.1%}, "
                    f"substantive_body_text_chars={page['editability']['substantive_body_text_chars']})"
                )
                errors.append(message)
                structured_errors.append(_error_detail(message, page_no, "body-image-only"))
        if args.check_header_safe_zone:
            errors.extend(check_header_safe_zone(zf, slides, args.header_safe_y_in, args.header_text_count))
        if args.check_me2026_footer_logo_alignment:
            errors.extend(check_me2026_footer_logo_alignment(zf, slides, args.alignment_tolerance_in))
        if args.check_icon_card_alignment:
            errors.extend(check_icon_card_alignment(zf, slides, args.alignment_tolerance_in))
        if args.check_label_text_row_alignment:
            errors.extend(check_label_text_row_alignment(zf, slides, args.alignment_tolerance_in))
        if args.check_integer_font_sizes:
            for size in parsed_font_sizes(sizes):
                if not size.is_integer():
                    errors.append(f"decimal font size present: {size:g}")
        if args.min_font_size is not None:
            for size in parsed_font_sizes(sizes):
                if size < args.min_font_size:
                    errors.append(f"font size below minimum {args.min_font_size:g}: {size:g}")

        print(f"pptx={args.pptx}")
        print(f"slides={len(slides)}")
        print(f"slide_size_emu={slide_size}")
        print(f"media={len(media)}")
        print(f"text_chars={len(text)}")
        if args.print_style_summary:
            print(f"fonts_top={fonts.most_common(20)}")
            print(f"colors_top={colors.most_common(30)}")
            print(f"font_sizes_top={sizes.most_common(30)}")

    if errors:
        print("FAIL")
        for err in errors:
            print(f"- {err}")
        status = 1
    else:
        print("PASS")
        status = 0

    for page in page_reports:
        page["out_of_bounds_count"] = len(page["out_of_bounds"])
        page["unresolved_geometry_count"] = len(page["unresolved_geometry"])
    known_messages = {item["message"] for item in structured_errors}
    structured_errors.extend(
        _error_detail(message)
        for message in errors
        if message not in known_messages
    )
    report = {
        "schema_version": 1,
        "tool": "inspect_pptx",
        "input": args.pptx,
        "ok": status == 0,
        "summary": {
            "slides": len(slides),
            "slide_size_emu": list(slide_size) if slide_size else None,
            "media": len(media),
            "text_chars": len(text),
            "out_of_bounds_objects": sum(page["out_of_bounds_count"] for page in page_reports),
            "unresolved_geometry_objects": sum(page["unresolved_geometry_count"] for page in page_reports),
        },
        "errors": structured_errors,
        "warnings": warnings,
        "slides": page_reports,
    }
    try:
        _write_json_report(args.json_report, report)
    except OSError as exc:
        print(f"ERROR: unable to write JSON report: {exc}", file=sys.stderr)
        return 2
    return status


if __name__ == "__main__":
    raise SystemExit(main())
