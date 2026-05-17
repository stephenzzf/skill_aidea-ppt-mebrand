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
    parser.add_argument("--check-integer-font-sizes", action="store_true")
    parser.add_argument("--min-font-size", type=float)
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


def text_of_shape(shape):
    return "".join(t.text or "" for t in shape.findall(".//a:t", NS)).strip()


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


def check_fullslide_images(zf, slides, slide_size):
    if not slide_size:
        return ["presentation slide size not found"]
    sw, sh = slide_size
    errors = []
    for name in slides:
        root = ET.fromstring(zf.read(name))
        for pic in root.findall(".//p:pic", NS):
            box = xfrm_tuple(pic)
            if not box:
                continue
            x, y, w, h = box
            if w >= sw * 0.93 and h >= sh * 0.93:
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
            errors.extend(check_fullslide_images(zf, slides, slide_size))
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
