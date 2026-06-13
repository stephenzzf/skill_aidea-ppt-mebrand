#!/usr/bin/env python3
"""Detect common ME2026 editable PPT layout risks that structural checks miss.

This script intentionally uses conservative OOXML heuristics. It is not a
renderer, but it catches recurring issues from dense PPT rebuilds and test
decks: tiny text boxes, long labels squeezed into narrow cards, non-footer body
text below the readable threshold, and accidental literal newline strings.
"""

import argparse
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
    parser.add_argument("--max-issues", type=int, default=80)
    return parser.parse_args()


def slide_num(name):
    match = re.search(r"slide(\d+)\.xml$", name)
    return int(match.group(1)) if match else 0


def inches(emu):
    return emu / EMU_PER_INCH


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


def main():
    args = parse_args()
    footer_y_emu = int(args.footer_start_y_in * EMU_PER_INCH)
    min_h_emu = int(args.min_text_height_in * EMU_PER_INCH)
    min_long_h_emu = int(args.min_long_text_height_in * EMU_PER_INCH)
    narrow_w_emu = int(args.long_text_narrow_width_in * EMU_PER_INCH)
    issues = []
    stats = {"text_shapes": 0, "font_checked": 0, "small_icons": 0}

    try:
        zf = zipfile.ZipFile(args.pptx)
    except FileNotFoundError:
        print(f"FAIL: file not found: {args.pptx}", file=sys.stderr)
        return 2

    with zf:
        slides = sorted(
            [n for n in zf.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", n)],
            key=slide_num,
        )
        for slide_name in slides:
            slide_no = slide_num(slide_name)
            root = ET.fromstring(zf.read(slide_name))
            text_boxes = []
            small_icon_boxes = []

            for pic in root.findall(".//p:pic", NS):
                box = xfrm_tuple(pic)
                if not box:
                    continue
                _, y, w, h = box
                if y >= footer_y_emu:
                    continue
                if w <= int(0.9 * EMU_PER_INCH) and h <= int(0.9 * EMU_PER_INCH):
                    small_icon_boxes.append(("picture icon", box))

            for sp in root.findall(".//p:sp", NS):
                text = text_of_shape(sp)
                box = xfrm_tuple(sp)
                if not box:
                    continue
                if not text and is_small_icon_shape(sp, box):
                    _, y, _, _ = box
                    if y < footer_y_emu:
                        small_icon_boxes.append(("shape icon", box))
                    continue
                if not text:
                    continue
                if is_footer_or_page_number(text, box, footer_y_emu):
                    continue

                stats["text_shapes"] += 1
                clean = clean_text(text)
                x, y, w, h = box
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

                if not source_or_legal and vlen > 2:
                    text_boxes.append({
                        "text": clean,
                        "box": box,
                        "effective_box": estimated_visible_text_box(text, box, min_size),
                    })

            stats["small_icons"] += len(small_icon_boxes)
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

    if issues:
        print(f"FAIL: {len(issues)} ME2026 layout risk(s) detected")
        for issue in issues[: args.max_issues]:
            print(f"- {issue}")
        if len(issues) > args.max_issues:
            print(f"... {len(issues) - args.max_issues} more issue(s) truncated")
        print(f"summary: text_shapes={stats['text_shapes']} font_checked={stats['font_checked']}")
        return 1

    print(
        "PASS: no ME2026 layout risks detected; "
        f"text_shapes={stats['text_shapes']} font_checked={stats['font_checked']} small_icons={stats['small_icons']}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
