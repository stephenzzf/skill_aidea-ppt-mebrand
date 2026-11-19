"""Verify the reusable, source-measured QBR chrome in slide coordinates."""
import hashlib
import posixpath
import xml.etree.ElementTree as ET

from pptx_geometry import EMU_PER_INCH, NS, collect_visual_objects


def check_chrome(zf, part, appendix=False):
    root = ET.fromstring(zf.read(part))
    items = collect_visual_objects(root)
    named = {}
    errors = []
    for obj in items:
        props = obj.element.find(".//p:cNvPr", NS)
        if props is not None:
            named.setdefault(props.get("name", ""), []).append(obj)

    def single(name):
        group = named.get(name, [])
        if len(group) != 1:
            errors.append(f"{part}: expected one {name}, found {len(group)}")
            return None
        return group[0]

    def check_box(obj, expected, label, flexible_height=False):
        if obj is None:
            return
        actual = obj.box
        # Writer/exporter integer rounding may differ by a single EMU.
        if not actual or any(abs(a - b) > 2 for a, b in zip(actual[:3], expected[:3])):
            errors.append(f"{part}: {label} anchor/width differs from H2 source")
        elif (actual[3] < expected[3] - 2 if flexible_height else abs(actual[3] - expected[3]) > 2):
            errors.append(f"{part}: {label} height differs from H2 source")

    def inch_box(*values):
        return tuple(round(v * EMU_PER_INCH) for v in values)

    title = single("ME_REPORT_TITLE")
    kicker = single("ME_REPORT_KICKER")
    check_box(title, inch_box(.55, .70, 12.23, .82), "title", flexible_height=True)
    check_box(kicker, inch_box(.55, .36, 7.20, .34), "chapter")
    for obj in [title, kicker]:
        if obj:
            props = obj.element.find(".//a:bodyPr", NS)
            if props is None or any(props.get(k) != v for k, v in {
                "lIns": "91440", "rIns": "91440", "tIns": "45720", "bIns": "45720", "anchor": "t",
            }.items()):
                errors.append(f"{part}: chapter/title text insets differ from H2 source")

    nav = [item for name, matches in named.items() if name.startswith("ME_REPORT_NAV_") for item in matches]
    stride = min(.79, 4.74 / max(len(nav), 1))
    for i, item in enumerate(nav):
        check_box(item, inch_box(8.05 + stride * i, .38, stride - .03, .28), "navigation")
    if nav and (appendix or sum(len(matches) for name, matches in named.items() if name.startswith("ME_REPORT_NAV_ACTIVE_")) != 1):
        errors.append(f"{part}: navigation requires a single active tab on body pages and no tabs on appendix pages")

    # The historic group is emitted as three editable native objects. The PNG
    # hashes bind the already-cropped official art, including transparent margins.
    marks = {
        "ME2026_FOOTER_ME_LOGO": ((539113, 6556536, 1278980, 105953),
            "cad50c08213c53ef92819c5ff1a3b04fb94c43c337bdc3773dee6414406c4114"),
        "ME2026_FOOTER_GROUP_LOGO": ((1994094, 6529946, 1221586, 159134),
            "5658bf8c5bd735def216dda4af3aaa26d54cfc0fcfafa50c1b7c45478ca4bf19"),
    }
    directory, filename = posixpath.split(part)
    rels_path = posixpath.join(directory, "_rels", filename + ".rels")
    rels = {r.get("Id"): r.get("Target") for r in ET.fromstring(zf.read(rels_path))} if rels_path in zf.namelist() else {}
    verified = []
    for name, (box, digest) in marks.items():
        mark = single(name)
        check_box(mark, box, name)
        if not mark:
            continue
        verified.append(mark)
        if mark.kind != "picture" or mark.element.find("p:blipFill/a:srcRect", NS) is not None:
            errors.append(f"{part}: {name} must use the supplied pre-cropped picture without additional cropping")
        blip = mark.element.find("p:blipFill/a:blip", NS)
        rel_id = blip.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed") if blip is not None else None
        target = rels.get(rel_id)
        media = posixpath.normpath(posixpath.join(directory, target)).lstrip("/") if target else None
        if not media or media not in zf.namelist() or hashlib.sha256(zf.read(media)).hexdigest() != digest:
            errors.append(f"{part}: {name} must use the original brand artwork")
    for item in items:
        if item.kind == "picture" and item not in verified and item.box:
            x, y, _, _ = item.box
            if x < 3.72 * EMU_PER_INCH and y > 6.85 * EMU_PER_INCH:
                errors.append(f"{part}: unexpected picture in the dual-brand footer")
    divider = single("ME2026_FOOTER_DIVIDER")
    check_box(divider, (1937872, 6541948, 0, 135129), "footer divider")
    if divider:
        stroke = divider.element.find("p:spPr/a:ln", NS)
        color = divider.element.find("p:spPr/a:ln/a:solidFill/a:srgbClr", NS)
        if stroke is None or stroke.get("w") != "6350" or color is None or color.get("val") != "A6A6A6":
            errors.append(f"{part}: source footer divider must be a visible 0.5pt gray line")
    for note in named.get("ME_REPORT_FOOTER_NOTE", []):
        check_box(note, inch_box(3.72, 6.93, 8.13, .32), "footer note")

    safe_y = title.box[1] + title.box[3] if title and title.box else round(1.52 * EMU_PER_INCH)
    for obj in items:
        if obj in [title, kicker, *nav] or not obj.box:
            continue
        if not obj.text and obj.kind == "shape" and any(tab.box == obj.box for tab in nav):
            continue  # The active tab background is separate from its editable label.
        if obj.box[1] < safe_y - 2:
            errors.append(f"{part}: body object intrudes into the title area: {obj.text[:45]}")
    return errors
