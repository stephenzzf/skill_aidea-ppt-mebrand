"""Read an offline, unlabelled drawing and serialize only supported SVG geometry."""
import math
import re
import sys
from xml.etree import ElementTree as ET

NS = "http://www.w3.org/2000/svg"
ELEMENTS = {
    "svg": {"viewBox", "width", "height"}, "g": set(),
    "path": {"d"}, "rect": {"x", "y", "width", "height", "rx", "ry"},
    "circle": {"cx", "cy", "r"}, "ellipse": {"cx", "cy", "rx", "ry"},
    "line": {"x1", "y1", "x2", "y2"}, "polyline": {"points"}, "polygon": {"points"},
}
PRESENTATION = set("fill stroke stroke-width opacity fill-opacity stroke-opacity stroke-linecap stroke-linejoin stroke-dasharray fill-rule transform".split())
NUMBER = r"[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?"
NUMBERS = rf"{NUMBER}(?:(?:\s*,\s*|\s+){NUMBER})*"
VALUE = {
    **dict.fromkeys(("fill", "stroke"), r"(?:none|#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?|white|black)"),
    "stroke-linecap": "round|butt|square", "stroke-linejoin": "round|bevel|miter",
    "fill-rule": "nonzero|evenodd", "points": NUMBERS, "stroke-dasharray": rf"none|{NUMBERS}",
    "transform": rf"(?:\s*(?:translate|rotate|scale|matrix|skewX|skewY)\(\s*{NUMBERS}\s*\)\s*)+",
    "d": r"[Mm][\s\d.eE,+MmZzLlHhVvCcSsQqTtAa-]*", "viewBox": NUMBERS,
}


def numbers(value):
    result = [float(part) for part in re.split(r"[\s,]+", value.strip()) if part]
    if not all(map(math.isfinite, result)):
        raise ValueError("expected finite SVG coordinates")
    return result


def check_dimensions(name, attrs):
    for key in ("r", "rx", "ry", "width", "height", "stroke-width"):
        if key in attrs and float(attrs[key]) < 0:
            raise ValueError(f"negative SVG dimension: {key}")
    needed = {"rect": ("width", "height"), "ellipse": ("rx", "ry"), "circle": ("r",)}
    if any(float(attrs.get(key, 0)) <= 0 for key in needed.get(name, ())):
        raise ValueError(f"empty SVG geometry: {name}")
    if name in {"polygon", "polyline"}:
        coords = numbers(attrs.get("points", ""))
        if len(coords) % 2 or len(coords) < (6 if name == "polygon" else 4):
            raise ValueError(f"expected coordinate pairs for {name}")
    if name == "path" and not attrs.get("d", "").strip():
        raise ValueError("missing SVG path data")
    if "transform" in attrs:
        arities = {"matrix": {6}, "rotate": {1, 3}, "translate": {1, 2},
                   "scale": {1, 2}, "skewX": {1}, "skewY": {1}}
        for function, args in re.findall(r"([a-zA-Z]+)\(([^)]+)\)", attrs["transform"]):
            if len(numbers(args)) not in arities[function]:
                raise ValueError(f"invalid SVG transform: {function}")


def geometry(source, width, height):
    if len(source) > 262144 or "<!" in source or "<?" in source:
        raise ValueError("expected plain geometry without declarations")
    root = ET.fromstring(source)
    if root.tag != f"{{{NS}}}svg":
        raise ValueError("supply an SVG root with the SVG namespace")
    count = 0
    for node in root.iter():
        name = node.tag.removeprefix(f"{{{NS}}}")
        if node.tag != f"{{{NS}}}{name}" or name not in ELEMENTS or (name == "svg" and node is not root):
            raise ValueError(f"unsupported SVG element: {name}")
        if (node.text or "").strip() or (node.tail or "").strip():
            raise ValueError("keep labels in editable PowerPoint objects")
        if name not in {"g", "svg"}:
            count += 1
        for key, value in node.attrib.items():
            if key not in ELEMENTS[name] | PRESENTATION or not re.fullmatch(VALUE.get(key, NUMBER), value.strip()):
                raise ValueError(f"unsupported SVG attribute or value: {key}")
        check_dimensions(name, node.attrib)
    box = numbers(root.get("viewBox", ""))
    if len(box) != 4 or min(box[2:]) <= 0 or not math.isclose(box[2] / box[3], width / height, rel_tol=0.002):
        raise ValueError("viewBox must match the aspect ratio of the specified canvas")
    if not count:
        raise ValueError("diagram has no shapes")
    root.set("class", "diagram")
    ET.register_namespace("", NS)
    return ET.tostring(root, encoding="unicode")


if __name__ == "__main__":
    try:
        print(geometry(sys.stdin.read(262145), int(sys.argv[1]), int(sys.argv[2])))
    except (ValueError, ET.ParseError) as exc:
        sys.exit(str(exc))
