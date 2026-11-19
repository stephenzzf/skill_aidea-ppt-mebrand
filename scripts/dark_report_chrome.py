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

    logo = single("ME_REPORT_FOOTER_LOGO")
    check_box(logo, (363909, 6313546, 1162594, 314585), "brand footer")
    if logo:
        crop = logo.element.find("p:blipFill/a:srcRect", NS)
        if crop is None or crop.attrib != {"l": "17983", "t": "32568", "r": "24874", "b": "39944"}:
            errors.append(f"{part}: brand footer source crop differs")
        blip = logo.element.find("p:blipFill/a:blip", NS)
        rel_id = blip.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed") if blip is not None else None
        directory, filename = posixpath.split(part)
        rels_part = posixpath.join(directory, "_rels", filename + ".rels")
        target = None
        if rels_part in zf.namelist():
            target = next((rel.get("Target") for rel in ET.fromstring(zf.read(rels_part)) if rel.get("Id") == rel_id), None)
        media = posixpath.normpath(posixpath.join(directory, target)).lstrip("/") if target else None
        if not media or media not in zf.namelist() or hashlib.sha256(zf.read(media)).hexdigest() != "04dbf702913f474d080d22eb176afed1dee40c878f962d1b5ed36bb021285c6b":
            errors.append(f"{part}: brand footer media is not the measured H2 source")
    for note in named.get("ME_REPORT_FOOTER_NOTE", []):
        check_box(note, inch_box(1.95, 6.93, 9.9, .32), "footer note")

    safe_y = title.box[1] + title.box[3] if title and title.box else round(1.52 * EMU_PER_INCH)
    for obj in items:
        if obj in [title, kicker, *nav] or not obj.box:
            continue
        if not obj.text and obj.kind == "shape" and any(tab.box == obj.box for tab in nav):
            continue  # The active tab background is separate from its editable label.
        if obj.box[1] < safe_y - 2:
            errors.append(f"{part}: body object intrudes into the title area: {obj.text[:45]}")
    return errors
