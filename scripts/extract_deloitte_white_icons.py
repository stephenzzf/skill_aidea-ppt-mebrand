#!/usr/bin/env python3
"""Extract selected Deloitte white-background appendix icons for ME2026.

The Deloitte template stores most appendix icons as editable PowerPoint
custom-geometry shapes, not as standalone image files. This script reads the
white icon appendix slides directly from the OOXML package, converts selected
shape paths to transparent SVG, and uses local Node `sharp` to rasterize PNGs.

Only white appendix slides are used. Dark/black slides, Deloitte palette,
Deloitte logo, footer, and copyright material are intentionally ignored.
"""

import argparse
import json
import shutil
import subprocess
import tempfile
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
}
EMU_PER_INCH = 914400
VIEWBOX = 512

ME2026_COLORS = {
    "primaryBlue": "1161F7",
    "primarySteel": "398BBF",
    "primaryDarkBlue": "0D49B9",
    "secondaryPurple": "8801DF",
    "secondaryDarkPurple": "6601A7",
    "secondarySky": "4CB9FF",
    "secondaryCyan": "45D0E4",
    "tertiaryDeepTeal": "226872",
    "tertiaryAmber": "FFC000",
    "tertiaryLavender": "B867EC",
}

TARGETS = [
    {"alias": "consult-target", "slide": 296, "label": "标靶", "color": "primaryBlue", "title": "目标", "lucide": "Target"},
    {"alias": "consult-checklist", "slide": 296, "label": "清单", "color": "primaryBlue", "title": "清单", "lucide": "ListChecks"},
    {"alias": "consult-global", "slide": 296, "label": "全球", "color": "primaryBlue", "title": "全球", "lucide": "Globe"},
    {"alias": "consult-dashboard", "slide": 296, "label": "显示屏", "color": "primarySteel", "title": "看板", "lucide": "Monitor"},
    {"alias": "consult-timer", "slide": 296, "label": "秒表", "color": "tertiaryDeepTeal", "title": "效率", "lucide": "Timer"},
    {"alias": "consult-document", "slide": 296, "label": "文档 1", "color": "primaryDarkBlue", "title": "文档", "lucide": "FileText"},
    {"alias": "consult-handshake", "slide": 296, "label": "握手", "color": "primaryBlue", "title": "合作", "lucide": "Handshake"},
    {"alias": "consult-grid", "slide": 296, "label": "网格", "color": "primarySteel", "title": "矩阵", "lucide": "Grid2X2"},
    {"alias": "consult-gear", "slide": 296, "label": "齿轮", "color": "secondaryPurple", "title": "机制", "lucide": "Settings"},
    {"alias": "consult-message", "slide": 296, "label": "评论", "color": "primaryBlue", "title": "反馈", "lucide": "MessageCircle"},
    {"alias": "consult-calendar", "slide": 297, "label": "日历", "color": "tertiaryLavender", "title": "日程", "lucide": "CalendarDays"},
    {"alias": "consult-verified", "slide": 297, "label": "核对", "color": "tertiaryDeepTeal", "title": "核验", "lucide": "BadgeCheck"},
    {"alias": "consult-clock", "slide": 297, "label": "时钟", "color": "primarySteel", "title": "时间", "lucide": "Clock3"},
    {"alias": "consult-user", "slide": 298, "label": "用户", "color": "primaryBlue", "title": "用户", "lucide": "UserRound"},
    {"alias": "consult-rocket", "slide": 298, "label": "火箭", "color": "secondaryPurple", "title": "启动", "lucide": "Rocket"},
    {"alias": "consult-list-check", "slide": 298, "label": "勾选列表", "color": "tertiaryDeepTeal", "title": "清单核验", "lucide": "ListTodo"},
    {"alias": "consult-line-chart", "slide": 299, "label": "线形图", "color": "primaryBlue", "title": "趋势", "lucide": "ChartLine"},
    {"alias": "consult-bar-chart", "slide": 299, "label": "柱形图 1", "color": "primarySteel", "title": "柱形图", "lucide": "ChartColumn"},
    {"alias": "consult-pie-chart", "slide": 299, "label": "饼状图 1", "color": "tertiaryLavender", "title": "占比", "lucide": "ChartPie"},
    {"alias": "consult-arrow-path", "slide": 300, "label": "箭头路径", "color": "primaryBlue", "title": "路径", "lucide": "Route"},
    {"alias": "consult-arrow-right", "slide": 300, "label": "向右箭头", "color": "primaryBlue", "title": "推进", "lucide": "ArrowRight"},
    {"alias": "consult-shield", "slide": 305, "label": "盾牌", "color": "tertiaryDeepTeal", "title": "风控", "lucide": "ShieldCheck"},
    {"alias": "consult-calculator", "slide": 305, "label": "计算器", "color": "tertiaryAmber", "title": "测算", "lucide": "Calculator"},
    {"alias": "consult-smartphone", "slide": 307, "label": "智能手机", "color": "primaryBlue", "title": "移动端", "lucide": "Smartphone"},
    {"alias": "consult-qr", "slide": 307, "label": "二维码", "color": "primaryDarkBlue", "title": "二维码", "lucide": "QrCode"},
    {"alias": "consult-upload-cloud", "slide": 307, "label": "上传至云", "color": "secondarySky", "title": "云上传", "lucide": "CloudUpload"},
    {"alias": "consult-download-cloud", "slide": 307, "label": "从云下载", "color": "secondarySky", "title": "云下载", "lucide": "CloudDownload"},
    {"alias": "consult-chip", "slide": 307, "label": "微芯片", "color": "secondaryPurple", "title": "AI/芯片", "lucide": "Cpu"},
    {"alias": "consult-search", "slide": 309, "label": "搜索", "color": "tertiaryDeepTeal", "title": "搜索", "lucide": "Search"},
    {"alias": "consult-refresh", "slide": 309, "label": "刷新", "color": "primarySteel", "title": "刷新", "lucide": "RefreshCcw"},
    {"alias": "consult-download", "slide": 309, "label": "下载", "color": "primaryBlue", "title": "下载", "lucide": "Download"},
    {"alias": "consult-meeting", "slide": 310, "label": "会议", "color": "primaryBlue", "title": "会议", "lucide": "Presentation"},
    {"alias": "consult-org", "slide": 310, "label": "组织结构图", "color": "primarySteel", "title": "组织", "lucide": "Network"},
    {"alias": "consult-dialog", "slide": 310, "label": "对话泡", "color": "secondaryPurple", "title": "对话", "lucide": "MessagesSquare"},
    {"alias": "consult-presentation", "slide": 310, "label": "展示", "color": "primaryBlue", "title": "展示", "lucide": "PanelTop"},
    {"alias": "consult-proposal", "slide": 315, "label": "提交服务建议书", "color": "primaryBlue", "title": "建议书", "lucide": "FileCheck2"},
    {"alias": "consult-office-list", "slide": 315, "label": "办事处名录", "color": "primarySteel", "title": "名录", "lucide": "ClipboardList"},
    {"alias": "consult-work-search", "slide": 315, "label": "工作搜索", "color": "tertiaryDeepTeal", "title": "工作搜索", "lucide": "BriefcaseBusiness"},
]


def parse_args():
    parser = argparse.ArgumentParser(description="Extract Deloitte white appendix icons for ME2026.")
    parser.add_argument("--source", required=True, help="Path to Deloitte .potx/.pptx template.")
    parser.add_argument("--out-dir", default="assets/me-2026-app/deloitte-white-icons")
    parser.add_argument("--png-size", type=int, default=256)
    parser.add_argument("--svg-only", action="store_true", help="Write SVG/catalog only; skip PNG rasterization.")
    parser.add_argument("--node", default=shutil.which("node") or "node")
    return parser.parse_args()


def read_xml(zf, name):
    return ET.fromstring(zf.read(name))


def box_in_inches(el):
    xfrm = el.find(".//a:xfrm", NS)
    if xfrm is None:
        return None
    off = xfrm.find("a:off", NS)
    ext = xfrm.find("a:ext", NS)
    if off is None or ext is None:
        return None
    return tuple(int(v) / EMU_PER_INCH for v in (off.get("x"), off.get("y"), ext.get("cx"), ext.get("cy")))


def xfrm_values(el):
    xfrm = el.find("./a:xfrm", NS)
    if xfrm is None:
        xfrm = el.find(".//a:xfrm", NS)
    if xfrm is None:
        return None
    off = xfrm.find("a:off", NS)
    ext = xfrm.find("a:ext", NS)
    if off is None or ext is None:
        return None
    ch_off = xfrm.find("a:chOff", NS)
    ch_ext = xfrm.find("a:chExt", NS)
    return {
        "x": int(off.get("x")),
        "y": int(off.get("y")),
        "w": int(ext.get("cx")),
        "h": int(ext.get("cy")),
        "ch_x": int((ch_off if ch_off is not None else off).get("x")),
        "ch_y": int((ch_off if ch_off is not None else off).get("y")),
        "ch_w": int((ch_ext if ch_ext is not None else ext).get("cx")),
        "ch_h": int((ch_ext if ch_ext is not None else ext).get("cy")),
    }


def text_of_shape(shape):
    return "".join(t.text or "" for t in shape.findall(".//a:t", NS)).strip()


def is_icon_box(box):
    if not box:
        return False
    _, _, w, h = box
    return 0.22 <= w <= 0.95 and 0.22 <= h <= 0.95


def slide_labels_and_icons(source, slide_no):
    with zipfile.ZipFile(source) as zf:
        root = read_xml(zf, f"ppt/slides/slide{slide_no}.xml")
    labels = []
    for shape in root.findall(".//p:sp", NS):
        text = text_of_shape(shape)
        box = box_in_inches(shape)
        if text and box:
            labels.append({"text": text, "box": box})

    icons = []
    for group in root.findall(".//p:grpSp", NS):
        if text_of_shape(group):
            continue
        box = box_in_inches(group)
        if is_icon_box(box):
            icons.append({"box": box, "kind": "group", "el": group})
    for shape in root.findall(".//p:sp", NS):
        if text_of_shape(shape):
            continue
        box = box_in_inches(shape)
        if is_icon_box(box):
            icons.append({"box": box, "kind": "shape", "el": shape})
    return labels, icons


def choose_icon(target, labels, icons):
    matches = [label for label in labels if label["text"] == target["label"]]
    if not matches:
        raise RuntimeError(f"label {target['label']!r} not found on slide {target['slide']}")
    label = sorted(matches, key=lambda item: item["box"][1])[0]
    lx, ly, lw, _ = label["box"]
    center_x = lx + lw / 2
    candidates = []
    for icon in icons:
        ix, iy, iw, ih = icon["box"]
        if iy >= ly:
            continue
        y_gap = ly - (iy + ih)
        if not (0.0 <= y_gap <= 0.55):
            continue
        score = abs(ix + iw / 2 - center_x) + y_gap * 0.2
        candidates.append((score, icon))
    if not candidates:
        raise RuntimeError(f"no icon box found above label {target['label']!r} on slide {target['slide']}")
    return label, sorted(candidates, key=lambda item: item[0])[0][1]


def pt_val(pt, axis):
    raw = pt.get(axis, "0")
    return raw


def path_commands(path):
    d = []
    for cmd in list(path):
        tag = cmd.tag.split("}")[-1]
        pts = cmd.findall("a:pt", NS)
        if tag == "moveTo" and pts:
            d.append(f"M {pt_val(pts[0], 'x')} {pt_val(pts[0], 'y')}")
        elif tag == "lnTo" and pts:
            d.append(f"L {pt_val(pts[0], 'x')} {pt_val(pts[0], 'y')}")
        elif tag == "cubicBezTo" and len(pts) == 3:
            d.append(
                "C "
                + " ".join(f"{pt_val(pt, 'x')} {pt_val(pt, 'y')}" for pt in pts)
            )
        elif tag == "quadBezTo" and len(pts) == 2:
            d.append(
                "Q "
                + " ".join(f"{pt_val(pt, 'x')} {pt_val(pt, 'y')}" for pt in pts)
            )
        elif tag == "close":
            d.append("Z")
        # arcTo and other preset-only commands are intentionally skipped; the
        # selected appendix icons primarily use freeform cubic geometry.
    return " ".join(d)


def shape_svg(shape, x, y, w, h, color):
    geom = shape.find("./p:spPr/a:custGeom", NS)
    if geom is not None:
        pieces = []
        for path in geom.findall(".//a:path", NS):
            pw = float(path.get("w") or 1)
            ph = float(path.get("h") or 1)
            d = path_commands(path)
            if not d:
                continue
            pieces.append(
                f'<path d="{d}" transform="translate({x:.4f} {y:.4f}) '
                f'scale({w / pw:.8f} {h / ph:.8f})" fill="#{color}" '
                'fill-rule="evenodd" stroke="none"/>'
            )
        return pieces

    prst = shape.find("./p:spPr/a:prstGeom", NS)
    if prst is None:
        return []
    name = prst.get("prst")
    if name in {"ellipse", "smileyFace"}:
        return [f'<ellipse cx="{x + w / 2:.4f}" cy="{y + h / 2:.4f}" rx="{w / 2:.4f}" ry="{h / 2:.4f}" fill="#{color}"/>']
    if name in {"rect", "roundRect", "snip1Rect"}:
        return [f'<rect x="{x:.4f}" y="{y:.4f}" width="{w:.4f}" height="{h:.4f}" rx="{min(w, h) * 0.08:.4f}" fill="#{color}"/>']
    if name == "line":
        return [f'<line x1="{x:.4f}" y1="{y:.4f}" x2="{x + w:.4f}" y2="{y + h:.4f}" stroke="#{color}" stroke-width="18" stroke-linecap="round"/>']
    return []


def icon_to_svg(icon, color):
    el = icon["el"]
    parts = []
    if icon["kind"] == "group":
        group_xfrm = xfrm_values(el.find("./p:grpSpPr", NS))
        if not group_xfrm:
            return None
        ch_x = group_xfrm["ch_x"]
        ch_y = group_xfrm["ch_y"]
        ch_w = group_xfrm["ch_w"] or 1
        ch_h = group_xfrm["ch_h"] or 1
        for shape in el.findall("./p:sp", NS):
            sp_xfrm = xfrm_values(shape.find("./p:spPr", NS))
            if not sp_xfrm:
                continue
            x = (sp_xfrm["x"] - ch_x) / ch_w * VIEWBOX
            y = (sp_xfrm["y"] - ch_y) / ch_h * VIEWBOX
            w = sp_xfrm["w"] / ch_w * VIEWBOX
            h = sp_xfrm["h"] / ch_h * VIEWBOX
            parts.extend(shape_svg(shape, x, y, w, h, color))
    else:
        parts.extend(shape_svg(el, 32, 32, VIEWBOX - 64, VIEWBOX - 64, color))

    if not parts:
        return None
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{VIEWBOX}" height="{VIEWBOX}" '
        f'viewBox="0 0 {VIEWBOX} {VIEWBOX}">'
        + "".join(parts)
        + "</svg>"
    )


def rasterize_svgs(node, out_dir, png_size):
    script = r"""
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const dir = process.argv[2];
const size = Number(process.argv[3] || 256);

(async () => {
  const svgs = fs.readdirSync(dir).filter((name) => name.endsWith(".svg"));
  for (const name of svgs) {
    const svgPath = path.join(dir, name);
    const pngPath = path.join(dir, name.replace(/\.svg$/, ".png"));
    await sharp(svgPath).resize(size, size, { fit: "contain" }).png().toFile(pngPath);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
"""
    with tempfile.NamedTemporaryFile("w", suffix=".cjs", delete=False, encoding="utf-8") as handle:
        handle.write(script)
        script_path = handle.name
    try:
        subprocess.run([node, script_path, str(out_dir), str(png_size)], check=True)
    finally:
        Path(script_path).unlink(missing_ok=True)


def main():
    args = parse_args()
    source = Path(args.source).expanduser().resolve()
    out_dir = Path(args.out_dir).resolve()
    if not source.exists():
        raise SystemExit(f"source not found: {source}")
    out_dir.mkdir(parents=True, exist_ok=True)

    selected_by_slide = {}
    for target in TARGETS:
        selected_by_slide.setdefault(target["slide"], []).append(target)

    catalog = {
        "source": str(source),
        "sourceSlides": [f"slide{n}.xml" for n in sorted(selected_by_slide)],
        "allowedSourceRange": "slide296-slide315 white-background icon appendix only",
        "ignoredSlides": ["slide205.xml black-background timeline", "all dark-background or Deloitte-branded pages"],
        "extraction": "Direct OOXML custom geometry path extraction to SVG, rasterized to transparent PNG, recolored with ME2026 colors.",
        "colorPolicy": "All icon fills are normalized to ME2026 colors; Deloitte green/yellow/black palette is not used.",
        "publicDistributionNote": "Source labels and geometry originate from the provided Deloitte template. Confirm redistribution authorization before public release.",
        "icons": [],
    }

    for slide_no, targets in selected_by_slide.items():
        labels, icons = slide_labels_and_icons(source, slide_no)
        for target in targets:
            label, icon = choose_icon(target, labels, icons)
            color_hex = ME2026_COLORS[target["color"]]
            svg = icon_to_svg(icon, color_hex)
            if not svg:
                raise RuntimeError(f"unable to convert icon {target['alias']} from slide {slide_no}")
            svg_name = f"{target['alias']}.svg"
            png_name = f"{target['alias']}.png"
            (out_dir / svg_name).write_text(svg + "\n", encoding="utf-8")
            catalog["icons"].append(
                {
                    "alias": target["alias"],
                    "label": target["title"],
                    "sourceSlide": f"slide{slide_no}.xml",
                    "sourceLabel": target["label"],
                    "file": png_name,
                    "svg": svg_name,
                    "color": color_hex,
                    "me2026Color": target["color"],
                    "sourceBoxIn": [round(v, 4) for v in icon["box"]],
                    "labelBoxIn": [round(v, 4) for v in label["box"]],
                    "lucideFallback": target["lucide"],
                }
            )

    if not args.svg_only:
        rasterize_svgs(args.node, out_dir, args.png_size)

    catalog_path = out_dir / "catalog.json"
    catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"extracted {len(catalog['icons'])} icons -> {out_dir}")


if __name__ == "__main__":
    main()
