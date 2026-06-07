#!/usr/bin/env python3
import argparse
from collections import Counter
import html
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
}

EMU_PER_INCH = 914400


def parse_args():
    parser = argparse.ArgumentParser(description="Inspect ME brand PPTX package quality.")
    parser.add_argument("pptx")
    parser.add_argument("--expected-slides", type=int)
    parser.add_argument("--required-text", action="append", default=[])
    parser.add_argument("--required-font", action="append", default=[])
    parser.add_argument("--forbid-font", action="append", default=[])
    parser.add_argument("--allowed-color", action="append", default=[])
    parser.add_argument("--print-style-summary", action="store_true")
    parser.add_argument("--check-numbered-circles", action="store_true")
    parser.add_argument("--check-no-fullslide-images", action="store_true")
    parser.add_argument(
        "--allow-fullslide-image-slides",
        default="",
        help="Comma-separated slide numbers allowed to use full-slide decorative images.",
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
    xml = read_xml(zf, "ppt/presentation.xml")
    match = re.search(r'<p:sldSz cx="(\d+)" cy="(\d+)"', xml)
    if not match:
        return None
    return int(match.group(1)), int(match.group(2))


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
    sw, sh = slide_size
    errors = []
    allowed_slides = allowed_slides or set()
    for name in slides:
        num = slide_num(name)
        root = ET.fromstring(zf.read(name))
        for pic in root.findall(".//p:pic", NS):
            box = xfrm_tuple(pic)
            if not box:
                continue
            x, y, w, h = box
            if w >= sw * 0.93 and h >= sh * 0.93 and num not in allowed_slides:
                errors.append(f"{name}: possible full-slide image at {(x, y, w, h)}")
    return errors


def main():
    args = parse_args()
    errors = []
    if not os.path.exists(args.pptx) or os.path.getsize(args.pptx) == 0:
        print(f"ERROR: missing or empty PPTX: {args.pptx}", file=sys.stderr)
        return 2

    with zipfile.ZipFile(args.pptx) as zf:
        names = zf.namelist()
        slides = sorted(
            [n for n in names if re.match(r"ppt/slides/slide\d+\.xml$", n)],
            key=slide_num,
        )
        media = [n for n in names if n.startswith("ppt/media/") and not n.endswith("/")]
        slide_size = get_slide_size(zf)
        text = collect_text(zf, slides)
        fonts, colors, sizes = collect_style(zf, slides)

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
            errors.extend(check_fullslide_images(zf, slides, slide_size, parse_slide_allowlist(args.allow_fullslide_image_slides)))
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
        return 1
    print("PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
