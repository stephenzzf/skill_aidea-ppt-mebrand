"""Small OOXML geometry helpers shared by the ME2026 PPTX QA scripts.

Coordinates returned by this module are slide-space EMU bounding boxes. Group
shape child coordinate systems, group scaling, flips, and rotations are
composed before returning them. Geometry that cannot be recovered from OOXML
is kept explicit as unresolved instead of being silently treated as on-slide.
"""

from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Iterable, Optional
import xml.etree.ElementTree as ET


NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
}

EMU_PER_INCH = 914400
Matrix = tuple[float, float, float, float, float, float]
Box = tuple[int, int, int, int]
IDENTITY: Matrix = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)


@dataclass(frozen=True)
class VisualObject:
    """A shape-like OOXML object and its resolved slide-space bounds."""

    element: ET.Element
    kind: str
    box: Optional[Box]
    local_box: Optional[Box]
    depth: int
    text: str
    graphic_kind: Optional[str] = None
    unresolved_reason: Optional[str] = None

    @property
    def text_chars(self) -> int:
        return len(self.text)


def qname(namespace: str, local: str) -> str:
    return f"{{{namespace}}}{local}"


def local_name(element: ET.Element) -> str:
    return element.tag.rsplit("}", 1)[-1]


def _matrix_multiply(left: Matrix, right: Matrix) -> Matrix:
    """Return ``left @ right`` for affine transforms in (a,b,c,d,e,f) form."""
    a, b, c, d, e, f = left
    g, h, i, j, k, l = right
    return (
        a * g + c * h,
        b * g + d * h,
        a * i + c * j,
        b * i + d * j,
        a * k + c * l + e,
        b * k + d * l + f,
    )


def _translate(x: float, y: float) -> Matrix:
    return (1.0, 0.0, 0.0, 1.0, x, y)


def _scale(x: float, y: float) -> Matrix:
    return (x, 0.0, 0.0, y, 0.0, 0.0)


def _rotation_flip_about_box(
    box: Box,
    rotation_units: int = 0,
    flip_h: bool = False,
    flip_v: bool = False,
) -> Matrix:
    x, y, w, h = box
    cx = x + w / 2
    cy = y + h / 2
    radians = math.radians(rotation_units / 60000.0)
    cos_a = math.cos(radians)
    sin_a = math.sin(radians)
    rotation: Matrix = (cos_a, sin_a, -sin_a, cos_a, 0.0, 0.0)
    flip = _scale(-1.0 if flip_h else 1.0, -1.0 if flip_v else 1.0)
    return _matrix_multiply(
        _translate(cx, cy),
        _matrix_multiply(
            rotation,
            _matrix_multiply(flip, _translate(-cx, -cy)),
        ),
    )


def _transform_point(matrix: Matrix, x: float, y: float) -> tuple[float, float]:
    a, b, c, d, e, f = matrix
    return a * x + c * y + e, b * x + d * y + f


def _bounds_from_points(points: Iterable[tuple[float, float]]) -> Box:
    coords = list(points)
    if not coords:
        return (0, 0, 0, 0)
    min_x = math.floor(min(point[0] for point in coords))
    min_y = math.floor(min(point[1] for point in coords))
    max_x = math.ceil(max(point[0] for point in coords))
    max_y = math.ceil(max(point[1] for point in coords))
    return (min_x, min_y, max_x - min_x, max_y - min_y)


def transform_box(box: Box, matrix: Matrix) -> Box:
    x, y, w, h = box
    points = (
        _transform_point(matrix, x, y),
        _transform_point(matrix, x + w, y),
        _transform_point(matrix, x, y + h),
        _transform_point(matrix, x + w, y + h),
    )
    return _bounds_from_points(points)


def _read_box(transform: Optional[ET.Element]) -> Optional[Box]:
    if transform is None:
        return None
    off = transform.find("a:off", NS)
    ext = transform.find("a:ext", NS)
    if off is None or ext is None:
        return None
    try:
        return (
            int(off.attrib["x"]),
            int(off.attrib["y"]),
            int(ext.attrib["cx"]),
            int(ext.attrib["cy"]),
        )
    except (KeyError, TypeError, ValueError):
        return None


def transform_for(element: ET.Element, kind: str) -> Optional[ET.Element]:
    if kind == "group":
        group_properties = element.find("./p:grpSpPr", NS)
        return group_properties.find("./a:xfrm", NS) if group_properties is not None else None
    if kind == "graphic_frame":
        return element.find("./p:xfrm", NS)
    shape_properties = element.find("./p:spPr", NS)
    return shape_properties.find("./a:xfrm", NS) if shape_properties is not None else None


def _group_child_matrix(transform: ET.Element, box: Box) -> tuple[Matrix, bool]:
    off = transform.find("a:off", NS)
    ch_off = transform.find("a:chOff", NS)
    ch_ext = transform.find("a:chExt", NS)
    if off is None or ch_off is None or ch_ext is None:
        return IDENTITY, False
    try:
        ch_x = float(ch_off.attrib["x"])
        ch_y = float(ch_off.attrib["y"])
        ch_w = float(ch_ext.attrib["cx"])
        ch_h = float(ch_ext.attrib["cy"])
        if ch_w == 0 or ch_h == 0:
            return IDENTITY, False
        sx = box[2] / ch_w
        sy = box[3] / ch_h
        base: Matrix = (
            sx,
            0.0,
            0.0,
            sy,
            float(off.attrib["x"]) - sx * ch_x,
            float(off.attrib["y"]) - sy * ch_y,
        )
    except (KeyError, TypeError, ValueError, ZeroDivisionError):
        return IDENTITY, False

    rotation_units = int(transform.attrib.get("rot", "0"))
    frame_transform = _rotation_flip_about_box(
        box,
        rotation_units,
        transform.attrib.get("flipH") == "1",
        transform.attrib.get("flipV") == "1",
    )
    return _matrix_multiply(frame_transform, base), True


def _object_kind(element: ET.Element) -> Optional[str]:
    return {
        "sp": "shape",
        "cxnSp": "connector",
        "pic": "picture",
        "graphicFrame": "graphic_frame",
        "grpSp": "group",
    }.get(local_name(element))


def _graphic_kind(element: ET.Element) -> Optional[str]:
    graphic_data = element.find(".//a:graphicData", NS)
    if graphic_data is None:
        return None
    child_names = {local_name(child) for child in graphic_data.iter()}
    if "tbl" in child_names:
        return "table"
    if "chart" in child_names:
        return "chart"
    if "diagram" in child_names or "relIds" in child_names:
        return "diagram"
    return "other"


def _text_content(element: ET.Element) -> str:
    return "".join(node.text or "" for node in element.findall(".//a:t", NS)).strip()


def collect_visual_objects(root: ET.Element) -> list[VisualObject]:
    """Walk slide shapes, pictures, graphic frames, and nested groups.

    The root slide tree is already expressed in slide coordinates. Each nested
    group contributes a child-coordinate transform that is composed with its
    parent transform. Objects missing usable OOXML geometry remain in the
    returned list with ``box=None`` and an explanatory unresolved reason.
    """
    objects: list[VisualObject] = []

    def walk(
        container: ET.Element,
        parent_matrix: Matrix,
        depth: int,
        inherited_unresolved: Optional[str] = None,
    ) -> None:
        for element in list(container):
            kind = _object_kind(element)
            if not kind:
                continue
            transform = transform_for(element, kind)
            local_box = _read_box(transform)
            unresolved = inherited_unresolved
            box = None
            if inherited_unresolved:
                unresolved = f"ancestor group transform is unresolved: {inherited_unresolved}"
            elif transform is None:
                unresolved = "missing transform"
            elif local_box is None:
                unresolved = "transform has no usable off/ext"
            else:
                if kind == "group":
                    object_transform = _rotation_flip_about_box(
                        local_box,
                        int(transform.attrib.get("rot", "0")),
                        transform.attrib.get("flipH") == "1",
                        transform.attrib.get("flipV") == "1",
                    )
                else:
                    object_transform = _rotation_flip_about_box(
                        local_box,
                        int(transform.attrib.get("rot", "0")),
                        transform.attrib.get("flipH") == "1",
                        transform.attrib.get("flipV") == "1",
                    )
                box = transform_box(local_box, _matrix_multiply(parent_matrix, object_transform))

            objects.append(
                VisualObject(
                    element=element,
                    kind=kind,
                    box=box,
                    local_box=local_box,
                    depth=depth,
                    text="" if kind == "group" else _text_content(element),
                    graphic_kind=_graphic_kind(element) if kind == "graphic_frame" else None,
                    unresolved_reason=unresolved,
                )
            )

            if kind == "group":
                if inherited_unresolved:
                    walk(element, parent_matrix, depth + 1, unresolved)
                    continue
                if transform is None or local_box is None:
                    reason = unresolved or "group transform is incomplete"
                    walk(element, parent_matrix, depth + 1, reason)
                    continue
                group_matrix, resolved = _group_child_matrix(transform, local_box)
                if not resolved:
                    objects[-1] = VisualObject(
                        element=element,
                        kind=kind,
                        box=box,
                        local_box=local_box,
                        depth=depth,
                        text="",
                        unresolved_reason="group child coordinate transform is incomplete",
                    )
                    walk(element, parent_matrix, depth + 1, "group child coordinate transform is incomplete")
                else:
                    walk(element, _matrix_multiply(parent_matrix, group_matrix), depth + 1)

    tree = root.find(".//p:spTree", NS)
    if tree is None:
        return objects
    walk(tree, IDENTITY, 0)
    return objects


def union_box(boxes: Iterable[Box]) -> Optional[Box]:
    boxes = list(boxes)
    if not boxes:
        return None
    min_x = min(box[0] for box in boxes)
    min_y = min(box[1] for box in boxes)
    max_x = max(box[0] + box[2] for box in boxes)
    max_y = max(box[1] + box[3] for box in boxes)
    return (min_x, min_y, max_x - min_x, max_y - min_y)


def rectangle_union_area(boxes: Iterable[Box], clip_box: Optional[Box] = None) -> int:
    """Calculate exact union area of axis-aligned rectangles using a sweep."""
    rects: list[Box] = []
    clip_x1 = clip_y1 = None
    clip_x2 = clip_y2 = None
    if clip_box is not None:
        cx, cy, cw, ch = clip_box
        clip_x1, clip_y1, clip_x2, clip_y2 = cx, cy, cx + cw, cy + ch

    for box in boxes:
        x, y, w, h = box
        if w <= 0 or h <= 0:
            continue
        x1, y1, x2, y2 = x, y, x + w, y + h
        if clip_box is not None:
            x1 = max(x1, clip_x1)
            y1 = max(y1, clip_y1)
            x2 = min(x2, clip_x2)
            y2 = min(y2, clip_y2)
        if x2 > x1 and y2 > y1:
            rects.append((x1, y1, x2 - x1, y2 - y1))

    if not rects:
        return 0
    xs = sorted({x for rect in rects for x in (rect[0], rect[0] + rect[2])})
    area = 0
    for left, right in zip(xs, xs[1:]):
        if right <= left:
            continue
        intervals = sorted(
            (rect[1], rect[1] + rect[3])
            for rect in rects
            if rect[0] < right and rect[0] + rect[2] > left
        )
        covered_y = 0
        start = end = None
        for y1, y2 in intervals:
            if start is None:
                start, end = y1, y2
            elif y1 > end:
                covered_y += end - start
                start, end = y1, y2
            else:
                end = max(end, y2)
        if start is not None:
            covered_y += end - start
        area += int(right - left) * int(covered_y)
    return area


def image_union_summary(objects: Iterable[VisualObject], canvas: Optional[Box]) -> dict:
    image_boxes = [obj.box for obj in objects if obj.kind == "picture" and obj.box is not None]
    bounds = union_box(image_boxes)
    if canvas is None:
        return {"area_emu2": 0, "coverage_ratio": None, "bounds_emu": bounds}
    canvas_area = max(0, canvas[2]) * max(0, canvas[3])
    area = rectangle_union_area(image_boxes, canvas)
    return {
        "area_emu2": area,
        "coverage_ratio": area / canvas_area if canvas_area else None,
        "bounds_emu": bounds,
    }


def is_out_of_bounds(box: Box, canvas: Box, tolerance_emu: int = 914) -> bool:
    x, y, w, h = box
    cx, cy, cw, ch = canvas
    return (
        x < cx - tolerance_emu
        or y < cy - tolerance_emu
        or x + w > cx + cw + tolerance_emu
        or y + h > cy + ch + tolerance_emu
    )


def slide_canvas(root: ET.Element) -> Optional[Box]:
    size = root.find(".//p:sldSz", NS)
    if size is None:
        return None
    try:
        return (0, 0, int(size.attrib["cx"]), int(size.attrib["cy"]))
    except (KeyError, TypeError, ValueError):
        return None
