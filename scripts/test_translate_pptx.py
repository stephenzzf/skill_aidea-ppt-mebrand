#!/usr/bin/env python3
"""Behavioral contract tests for PPTX text extraction, writeback and QA."""

from __future__ import annotations

import json
import sys
import tempfile
import zipfile
from pathlib import Path

from lxml import etree

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
import translate_pptx as engine
import translation_checks as checks
import translation_adaptations as adaptations


def _zip_bytes(parts: dict[str, bytes]) -> bytes:
    import io
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, value in parts.items():
            archive.writestr(name, value)
    return out.getvalue()


def _fixture_xlsx() -> bytes:
    parts = {
        "xl/workbook.xml": b'''<?xml version="1.0"?><x:workbook xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><x:sheets><x:sheet name="Sheet1" sheetId="1" r:id="rId1"/></x:sheets></x:workbook>''',
        "xl/_rels/workbook.xml.rels": b'''<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>''',
        "xl/worksheets/sheet1.xml": b'''<?xml version="1.0"?><x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheetData><x:row r="1"><x:c r="A1" t="s"><x:v>0</x:v></x:c><x:c r="B1" t="s"><x:v>1</x:v></x:c></x:row></x:sheetData></x:worksheet>''',
        "xl/sharedStrings.xml": '''<?xml version="1.0"?><x:sst xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="2" uniqueCount="2"><x:si><x:t>类别</x:t></x:si><x:si><x:t>得分</x:t></x:si></x:sst>'''.encode("utf-8"),
    }
    return _zip_bytes(parts)


def _fixture_pptx() -> bytes:
    slide = '''<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:cSld><p:spTree><p:nvGrpSpPr/><p:grpSpPr/><p:sp><p:nvSpPr/><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr b="1"><a:hlinkClick r:id="rIdLink"/></a:rPr><a:t>中文</a:t></a:r><a:r><a:rPr i="1"/><a:t>标题</a:t></a:r></a:p><a:p><a:r><a:rPr/><a:t>English title</a:t></a:r></a:p></p:txBody></p:sp><p:grpSp><p:nvGrpSpPr/><p:grpSpPr/><p:sp><p:nvSpPr/><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr/><a:t>流程</a:t></a:r></a:p></p:txBody></p:sp></p:grpSp><p:graphicFrame><p:nvGraphicFramePr/><p:xfrm/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr/><a:tblGrid><a:gridCol w="1000"/><a:gridCol w="1000"/></a:tblGrid><a:tr h="1000"><a:tc gridSpan="2"><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr/><a:t>合并单元格</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc><a:tc hMerge="1"><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr/></a:p></a:txBody><a:tcPr/></a:tc></a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame></p:spTree></p:cSld></p:sld>'''.encode("utf-8")
    notes = '''<?xml version="1.0"?><p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr/><a:t>备注内容</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>'''.encode("utf-8")
    chart = '''<?xml version="1.0"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:chart><c:plotArea><c:barChart><c:ser><c:tx><c:strRef><c:f>Sheet1!$B$1</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>得分</c:v></c:pt></c:strCache></c:strRef></c:tx><c:cat><c:strRef><c:f>Sheet1!$A$1</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>类别</c:v></c:pt></c:strCache></c:strRef></c:cat><c:val><c:numRef><c:f>Sheet1!$B$2</c:f><c:numCache><c:ptCount val="1"/><c:pt idx="0"><c:v>55.95</c:v></c:pt></c:numCache></c:numRef></c:val></c:ser></c:barChart></c:plotArea></c:chart><c:externalData r:id="rIdBook"/></c:chartSpace>'''.encode("utf-8")
    parts = {
        "ppt/slides/slide1.xml": slide,
        # Notes parts are numbered independently from slides; this fixture
        # binds notesSlide1 to slide7 to prevent index-based assignment.
        "ppt/slides/slide7.xml": slide,
        "ppt/slides/_rels/slide1.xml.rels": b'''<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com/docs" TargetMode="External"/></Relationships>''',
        "ppt/notesSlides/_rels/notesSlide1.xml.rels": b'''<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdSlide" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="../slides/slide7.xml"/></Relationships>''',
        "ppt/notesSlides/notesSlide1.xml": notes,
        "ppt/charts/chart1.xml": chart,
        "ppt/charts/_rels/chart1.xml.rels": b'''<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdBook" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/package" Target="../embeddings/chartdata.xlsx"/></Relationships>''',
        "ppt/embeddings/chartdata.xlsx": _fixture_xlsx(),
        "ppt/media/image1.png": b"unchanged-image-bytes",
    }
    return _zip_bytes(parts)


def _mapping_for(extraction: dict) -> dict:
    units = []
    for unit in extraction["units"]:
        source = unit["source_text"]
        if unit["kind"] == "slide" and source == "中文标题":
            output = ["English ", "Title"]
            units.append({"id": unit["id"], "source_text": source, "segments": output, "status": "translated"})
        elif unit["kind"] in ("chart-string-cache", "chart-workbook-cell") and source == "得分":
            units.append({"id": unit["id"], "source_text": source, "segments": ["Score"], "status": "translated"})
        elif unit["kind"] == "chart-string-cache" and source == "类别":
            units.append({"id": unit["id"], "source_text": source, "segments": ["Category"], "status": "translated"})
        elif unit["kind"] == "chart-workbook-cell" and source == "类别":
            units.append({"id": unit["id"], "source_text": source, "segments": ["Category"], "status": "translated"})
        elif any("\u3400" <= char <= "\u9fff" for char in source):
            # This fixture intentionally tests mapping completeness. A unit kept
            # in source Chinese is not accepted as a translated deliverable.
            units.append({"id": unit["id"], "source_text": source, "segments": unit["segments"], "status": "preserve", "reason": "fixture untranslated unit for QA behavior"})
        else:
            units.append({"id": unit["id"], "source_text": source, "segments": unit["segments"], "status": "preserve", "reason": "non-translatable English identifier"})
    return {"schema_version": 1, "source_sha256": extraction["source_sha256"], "units": units}


def _fully_translate_fixture(extraction: dict) -> dict:
    mapping = _mapping_for(extraction)
    translations = {
        "流程": "Flow", "合并单元格": "Merged cell", "备注内容": "Notes",
        "类别": "Category", "得分": "Score",
    }
    by_id = {unit["id"]: unit for unit in extraction["units"]}
    for entry in mapping["units"]:
        if entry["status"] != "preserve":
            continue
        unit = by_id[entry["id"]]
        source = unit["source_text"]
        if any("\u3400" <= char <= "\u9fff" for char in source):
            translated = translations[source]
            entry["segments"] = [translated] + [segment for segment in unit["segments"][1:]]
            entry["status"] = "translated"
            entry.pop("reason", None)
    return mapping


def _write_candidate_for_qa(source: Path, extraction: dict, mapping: dict, target: Path) -> None:
    """Create an otherwise-valid candidate to prove QA independently blocks unsupported parts."""
    mapping_units, _ = engine._check_mapping(extraction, mapping)
    with zipfile.ZipFile(source) as source_zip:
        original = {name: source_zip.read(name) for name in source_zip.namelist()}
        changed = engine._apply_xml_units(original, extraction, mapping_units)
        changed.update(engine._apply_workbook_units(source_zip, extraction, mapping_units))
        with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as candidate_zip:
            for info in source_zip.infolist():
                candidate_zip.writestr(info, changed.get(info.filename, original[info.filename]))


def _add_smartart(source: Path, target: Path) -> None:
    parts = {}
    with zipfile.ZipFile(source) as package:
        parts = {name: package.read(name) for name in package.namelist()}
    parts["ppt/diagrams/data1.xml"] = '''<?xml version="1.0"?><dgm:dataModel xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><dgm:ptLst><dgm:pt modelId="1" type="node"><dgm:sp><dgm:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>SmartArt未翻译正文</a:t></a:r></a:p></dgm:txBody></dgm:sp></dgm:pt></dgm:ptLst></dgm:dataModel>'''.encode("utf-8")
    target.write_bytes(_zip_bytes(parts))


def _add_named_range_chart(source: Path, target: Path) -> None:
    from io import BytesIO

    parts = {}
    with zipfile.ZipFile(source) as package:
        parts = {name: package.read(name) for name in package.namelist()}
    chart = etree.fromstring(parts["ppt/charts/chart1.xml"])
    formulas = chart.xpath(".//c:strRef/c:f", namespaces=engine.NS)
    category_formula = next(node for node in formulas if node.text == "Sheet1!$A$1")
    category_formula.text = "Sheet1!MyLabels"
    parts["ppt/charts/chart1.xml"] = etree.tostring(chart, encoding="utf-8", xml_declaration=True)

    workbook_parts = {}
    with zipfile.ZipFile(BytesIO(parts["ppt/embeddings/chartdata.xlsx"])) as workbook:
        workbook_parts = {name: workbook.read(name) for name in workbook.namelist()}
    workbook_root = etree.fromstring(workbook_parts["xl/workbook.xml"])
    defined_names = etree.SubElement(workbook_root, f"{{{engine.NS_XL}}}definedNames")
    defined_name = etree.SubElement(defined_names, f"{{{engine.NS_XL}}}definedName", name="MyLabels", localSheetId="0")
    defined_name.text = "Sheet1!$A$1"
    workbook_parts["xl/workbook.xml"] = etree.tostring(workbook_root, encoding="utf-8", xml_declaration=True)
    parts["ppt/embeddings/chartdata.xlsx"] = _zip_bytes(workbook_parts)
    target.write_bytes(_zip_bytes(parts))


def _adaptation_fixture_pptx() -> bytes:
    slide = '''<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:nvGrpSpPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1000" cy="500"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="1800"/><a:t>标题 2025</a:t></a:r></a:p></p:txBody></p:sp><p:pic><p:nvPicPr><p:cNvPr id="3" name="Source image"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rIdImg"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="1000" y="0"/><a:ext cx="1000" cy="500"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:spTree></p:cSld></p:sld>'''.encode("utf-8")
    return _zip_bytes({
        "ppt/slides/slide1.xml": slide,
        "ppt/slides/_rels/slide1.xml.rels": b'''<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdImg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>''',
        "ppt/media/image1.png": b"raster-image-source",
    })


def _write_candidate_parts(source: Path, target: Path, changes: dict[str, bytes]) -> None:
    with zipfile.ZipFile(source) as src, zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as out:
        for info in src.infolist():
            out.writestr(info, changes.get(info.filename, src.read(info.filename)))


def _localized_shape(shape_id: int, text: str) -> etree._Element:
    node = etree.fromstring(f'''<p:sp xmlns:p="{engine.NS_P}" xmlns:a="{engine.NS_A}"><p:nvSpPr><p:cNvPr id="{shape_id}" name="Localized"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="2000" y="1000"/><a:ext cx="2000" cy="500"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="1600"><a:latin typeface="Arial"/></a:rPr><a:t>{text}</a:t></a:r></a:p></p:txBody></p:sp>''')
    return node


def _append_adaptation_objects(baseline: Path, target: Path, objects: list[etree._Element]) -> None:
    with zipfile.ZipFile(baseline) as source:
        parts = {name: source.read(name) for name in source.namelist()}
    root = etree.fromstring(parts["ppt/slides/slide1.xml"])
    tree = root.find(".//p:spTree", engine.NS)
    for node in objects:
        tree.append(node)
    parts["ppt/slides/slide1.xml"] = etree.tostring(root, encoding="UTF-8", xml_declaration=True)
    _write_candidate_parts(baseline, target, parts)


def _adaptation_candidate(baseline: Path, target: Path, title: str = "Title 2025", add_extra: bool = False) -> None:
    with zipfile.ZipFile(baseline) as source:
        parts = {name: source.read(name) for name in source.namelist()}
    root = etree.fromstring(parts["ppt/slides/slide1.xml"])
    old_text = root.xpath(".//a:t", namespaces=engine.NS)[0]
    old_text.text = title
    off = root.xpath(".//p:sp[p:nvSpPr/p:cNvPr[@id='2']]/p:spPr/a:xfrm/a:off", namespaces=engine.NS)[0]
    off.set("x", "250")
    title_shape = root.xpath(".//p:sp[p:nvSpPr/p:cNvPr[@id='2']]", namespaces=engine.NS)[0]
    body_pr = title_shape.find("./p:txBody/a:bodyPr", engine.NS)
    body_pr.set("wrap", "square")
    etree.SubElement(body_pr, f"{{{engine.NS_A}}}noAutofit")
    title_rpr = title_shape.find(".//a:rPr", engine.NS)
    title_rpr.set("sz", "1700")
    title_rpr.set("spc", "10")
    etree.SubElement(title_rpr, f"{{{engine.NS_A}}}latin", typeface="Arial")
    paragraph = title_shape.find("./p:txBody/a:p", engine.NS)
    ppr = etree.Element(f"{{{engine.NS_A}}}pPr", latinLnBrk="1", eaLnBrk="1")
    line_spacing = etree.SubElement(ppr, f"{{{engine.NS_A}}}lnSpc")
    etree.SubElement(line_spacing, f"{{{engine.NS_A}}}spcPct", val="105000")
    paragraph.insert(0, ppr)
    tree = root.find(".//p:spTree", engine.NS)
    tree.append(_localized_shape(90001, "Label 2025"))
    if add_extra:
        tree.append(_localized_shape(90002, "Unregistered"))
    parts["ppt/slides/slide1.xml"] = etree.tostring(root, encoding="UTF-8", xml_declaration=True)
    _write_candidate_parts(baseline, target, parts)


def _layout_visibility_fixture() -> bytes:
    p = engine.NS_P
    a = engine.NS_A
    slide = f'''<p:sld xmlns:p="{p}" xmlns:a="{a}"><p:cSld><p:spTree/></p:cSld></p:sld>'''.encode()
    layout = f'''<p:sldLayout xmlns:p="{p}" xmlns:a="{a}"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="prompt"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1" hasCustomPrompt="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>隐藏提示</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="static"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Visible static label</a:t></a:r></a:p></p:txBody></p:sp><p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="5" name="Layout table"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr/><a:tblGrid><a:gridCol w="1000"/></a:tblGrid><a:tr h="500"><a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>布局表格中文</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc></a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame></p:spTree></p:cSld></p:sldLayout>'''.encode()
    unused = f'''<p:sldLayout xmlns:p="{p}" xmlns:a="{a}"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="4" name="unused"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>未引用中文</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sldLayout>'''.encode()
    notes_master = f'''<p:notesMaster xmlns:p="{p}" xmlns:a="{a}"><p:cSld><p:spTree><p:sp><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>备注模板中文</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notesMaster>'''.encode()
    return _zip_bytes({
        "ppt/slides/slide1.xml": slide,
        "ppt/slides/_rels/slide1.xml.rels": b'''<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rLayout" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>''',
        "ppt/slideLayouts/slideLayout1.xml": layout,
        "ppt/slideLayouts/slideLayout2.xml": unused,
        "ppt/notesMasters/notesMaster1.xml": notes_master,
    })


def run() -> int:
    with tempfile.TemporaryDirectory(prefix="me2026-translate-contract-") as tmp:
        root = Path(tmp)
        image_journal = {"slides": {"15": {"new_shapes": [
            {"shape_id": 93012, "kind": "mask", "text": "", "source_text": "raster Chinese",
             "source_picture": "ppt/media/image173.png"},
            {"shape_id": 93013, "kind": "editable_text", "text": "Short-Drama Translation",
             "note": {"source_text": "短剧翻译", "method": "native_overlay"},
             "evidence_part": "ppt/media/image173.png"},
            {"shape_id": 93014, "kind": "connector", "text": "", "method": "native_workflow"},
            {"shape_id": 93015, "kind": "editable_text", "text": "Translated labels over source screenshots",
             "note": {"source_text": "", "method": "translation-disclosure"}},
        ]}}}
        converted_plan = adaptations.image_journal_to_localization_plan(image_journal)
        converted_objects = converted_plan["localizations"][0]["objects"]
        assert [item["id"] for item in converted_objects] == [93012, 93013, 93014, 93015], "image-journal conversion must consume current shape IDs rather than cached IDs"
        assert [item["role"] for item in converted_objects] == ["mask", "localized-text", "decoration", "annotation"]
        assert converted_objects[1]["source_text"] == "短剧翻译", "nested note.source_text must retain exact source wording"
        assert converted_plan["localizations"][0]["source_media_parts"] == ["ppt/media/image173.png"]
        source = root / "source.pptx"
        output = root / "translated.pptx"
        mapping_path = root / "mapping.json"
        report_path = root / "apply-report.json"
        source.write_bytes(_fixture_pptx())
        extraction = engine.extract_pptx(source)
        by_kind = {unit["kind"] for unit in extraction["units"]}
        assert {"slide", "speaker-notes", "chart-string-cache", "chart-workbook-cell"} <= by_kind
        note_unit = next(u for u in extraction["units"] if u["kind"] == "speaker-notes")
        assert note_unit["slide"] == 7, "notes page must follow its slide relationship, not the notesSlide part number"
        run_unit = next(u for u in extraction["units"] if u.get("source_text") == "中文标题")
        assert run_unit["segments"] == ["中文", "标题"]
        assert run_unit["locator"]["type"] == "paragraph"
        mapping = _mapping_for(extraction)
        mapping_path.write_text(json.dumps(mapping, ensure_ascii=False), encoding="utf-8")
        report = engine.apply_mapping(source, mapping_path, output, report_path)
        assert report["status"] == "applied"
        qa = checks.verify_translation(source, output, mapping_path, report_path)
        assert qa["status"] == "fail"  # One fixture text box and speaker note remain untranslated.
        assert any("Chinese remains" in item for item in qa["errors"])
        # Apply and QA must preserve all drawing tree, run formatting, hyperlink,
        # merged cell, image and workbook numeric/formula data.
        assert not any("structure" in item or "workbook" in item or "payload" in item or "member" in item for item in qa["errors"]), qa["errors"]

        # The optional adaptation journal permits only registered typography/
        # geometry changes and appended native localization shapes. No-journal
        # QA keeps the original strict contract.
        adapt_source = root / "adapt-source.pptx"
        adapt_mapping = root / "adapt-mapping.json"
        adapt_baseline = root / "adapt-baseline.pptx"
        adapt_candidate = root / "adapt-candidate.pptx"
        adapt_report = root / "adapt-report.json"
        adapt_journal = root / "adapt-journal.json"
        adapt_source.write_bytes(_adaptation_fixture_pptx())
        adapt_extraction = engine.extract_pptx(adapt_source)
        native_unit = next(u for u in adapt_extraction["units"] if u["kind"] == "slide")
        adapt_mapping.write_text(json.dumps({"schema_version": 1, "source_sha256": adapt_extraction["source_sha256"],
            "units": [{"id": native_unit["id"], "source_text": native_unit["source_text"], "segments": ["Title 2025"], "status": "translated"}]}, ensure_ascii=False), encoding="utf-8")
        engine.apply_mapping(adapt_source, adapt_mapping, adapt_baseline, adapt_report)
        _adaptation_candidate(adapt_baseline, adapt_candidate)
        localization_plan = {"localizations": [{"part": "ppt/slides/slide1.xml", "slide": 1,
            "source_media_parts": ["ppt/media/image1.png"], "reason": "Replace the approved raster Chinese label with editable English.",
            "objects": [{"id": 90001, "role": "localized-text", "source_text": "图片中文 2025"}]}]}
        journal = adaptations.build_adaptation_journal(adapt_source, adapt_mapping, adapt_baseline, adapt_candidate, localization_plan)
        assert len(journal["layout_nodes"]) >= 2, "approved non-text typography nodes must be individually journaled"
        adapt_journal.write_text(json.dumps(journal, ensure_ascii=False), encoding="utf-8")
        strict_qa = checks.verify_translation(adapt_source, adapt_candidate, adapt_mapping, adapt_report)
        assert strict_qa["status"] == "fail", "without a journal the original strict geometry/object guard must remain active"
        adapted_qa = checks.verify_translation(adapt_source, adapt_candidate, adapt_mapping, adapt_report, adapt_journal)
        assert adapted_qa["status"] == "pass", adapted_qa["errors"]

        duplicate_media_journal = json.loads(json.dumps(journal))
        duplicate_media_journal["localizations"][0]["source_media_parts"].append("ppt/media/image1.png")
        duplicate_media_path = root / "adapt-duplicate-localization-media.json"
        duplicate_media_path.write_text(json.dumps(duplicate_media_journal, ensure_ascii=False), encoding="utf-8")
        duplicate_media_validation = adaptations.validate_adaptations(adapt_source, adapt_candidate, adapt_mapping, duplicate_media_path)
        assert duplicate_media_validation["status"] == "fail", "hand-authored localization journals must reject duplicate media scope"
        assert any("source media parts must be unique" in error for error in duplicate_media_validation["errors"])

        changed_number = root / "adapt-changed-number.pptx"
        _adaptation_candidate(adapt_baseline, changed_number, "Title 2026")
        numeric_journal = dict(journal)
        import hashlib
        numeric_journal["candidate_sha256"] = hashlib.sha256(changed_number.read_bytes()).hexdigest()
        numeric_journal_path = root / "adapt-changed-number.json"
        numeric_journal_path.write_text(json.dumps(numeric_journal), encoding="utf-8")
        assert adaptations.validate_adaptations(adapt_source, changed_number, adapt_mapping, numeric_journal_path)["status"] == "fail", "source numeric facts must not be changed by layout adaptation"

        extra_shape = root / "adapt-unregistered-shape.pptx"
        _adaptation_candidate(adapt_baseline, extra_shape, add_extra=True)
        extra_journal = dict(journal)
        extra_journal["candidate_sha256"] = hashlib.sha256(extra_shape.read_bytes()).hexdigest()
        extra_journal_path = root / "adapt-unregistered-shape.json"
        extra_journal_path.write_text(json.dumps(extra_journal), encoding="utf-8")
        assert adaptations.validate_adaptations(adapt_source, extra_shape, adapt_mapping, extra_journal_path)["status"] == "fail", "every appended native shape must be registered"

        unapproved_formatting = root / "adapt-unapproved-formatting.pptx"
        with zipfile.ZipFile(adapt_candidate) as source_zip:
            parts = {name: source_zip.read(name) for name in source_zip.namelist()}
        bad_root = etree.fromstring(parts["ppt/slides/slide1.xml"])
        etree.SubElement(bad_root.xpath(".//p:sp[p:nvSpPr/p:cNvPr[@id='2']]/p:spPr", namespaces=engine.NS)[0], f"{{{engine.NS_A}}}solidFill")
        parts["ppt/slides/slide1.xml"] = etree.tostring(bad_root, encoding="UTF-8", xml_declaration=True)
        _write_candidate_parts(adapt_baseline, unapproved_formatting, parts)
        try:
            adaptations.build_adaptation_journal(adapt_source, adapt_mapping, adapt_baseline, unapproved_formatting, localization_plan)
            raise AssertionError("unapproved slide formatting nodes must not be journaled as safe")
        except adaptations.AdaptationError as exc:
            assert "unapproved formatting node addition" in str(exc)

        no_text_shape = _localized_shape(90003, "")
        for node in no_text_shape.xpath(".//a:t", namespaces=engine.NS):
            node.getparent().remove(node)
        mask_shape = _localized_shape(90004, "")
        for node in mask_shape.xpath(".//a:t", namespaces=engine.NS):
            node.getparent().remove(node)
        disclose = _localized_shape(90005, "Translated labels over source screenshots")
        low_res_disclosure = _localized_shape(90007, "Source UI screenshot — embedded labels are too small to verify.")
        disclosure_candidate = root / "adapt-disclosure-and-decoration.pptx"
        _append_adaptation_objects(adapt_baseline, disclosure_candidate, [mask_shape, no_text_shape, disclose, low_res_disclosure])
        disclosure_plan = {"localizations": [{"part": "ppt/slides/slide1.xml", "slide": 1,
            "source_media_parts": ["ppt/media/image1.png"], "reason": "Reconstruct image labels as editable slide objects.",
            "objects": [
                {"id": 90003, "role": "decoration", "reason": "Add a native diagram connector."},
                {"id": 90004, "role": "mask"},
                {"id": 90005, "role": "annotation", "annotation_type": "translation-disclosure",
                 "reason": "Disclose that source-image labels were translated."},
                {"id": 90007, "role": "annotation", "annotation_type": "translation-disclosure",
                 "reason": "Disclose unreadable low-resolution source image labels."},
            ]}]}
        disclosure_journal = adaptations.build_adaptation_journal(adapt_source, adapt_mapping, adapt_baseline, disclosure_candidate, disclosure_plan)
        assert [row["role"] for row in disclosure_journal["localizations"][0]["objects"]] == ["decoration", "mask", "annotation", "annotation"]

        false_claim = _localized_shape(90008, "This screenshot is an official English product UI")
        false_claim_candidate = root / "adapt-unapproved-disclosure.pptx"
        _append_adaptation_objects(adapt_baseline, false_claim_candidate, [false_claim])
        false_claim_plan = {"localizations": [{"part": "ppt/slides/slide1.xml", "slide": 1,
            "source_media_parts": ["ppt/media/image1.png"], "reason": "Image localization.",
            "objects": [{"id": 90008, "role": "annotation", "annotation_type": "translation-disclosure",
                         "reason": "Attempt to claim the screenshot is a product UI."}]}]}
        try:
            adaptations.build_adaptation_journal(adapt_source, adapt_mapping, adapt_baseline, false_claim_candidate, false_claim_plan)
            raise AssertionError("an annotation cannot introduce an arbitrary product claim")
        except adaptations.AdaptationError as exc:
            assert "approved fixed translation-disclosure" in str(exc)

        bad_mask = _localized_shape(90006, "Unregistered factual claim")
        bad_mask_candidate = root / "adapt-text-in-mask.pptx"
        _append_adaptation_objects(adapt_baseline, bad_mask_candidate, [bad_mask])
        bad_mask_plan = {"localizations": [{"part": "ppt/slides/slide1.xml", "slide": 1,
            "source_media_parts": ["ppt/media/image1.png"], "reason": "Image localization.",
            "objects": [{"id": 90006, "role": "mask"}]}]}
        try:
            adaptations.build_adaptation_journal(adapt_source, adapt_mapping, adapt_baseline, bad_mask_candidate, bad_mask_plan)
            raise AssertionError("a mask must not carry text that bypasses source-to-translation reconciliation")
        except adaptations.AdaptationError as exc:
            assert "mask objects must contain no text" in str(exc)

        hidden_candidate = root / "adapt-approved-image-hide.pptx"
        with zipfile.ZipFile(adapt_baseline) as package:
            hidden_parts = {name: package.read(name) for name in package.namelist()}
        hidden_root = etree.fromstring(hidden_parts["ppt/slides/slide1.xml"])
        hidden_root.xpath(".//p:pic/p:nvPicPr/p:cNvPr[@id='3']", namespaces=engine.NS)[0].set("hidden", "1")
        hidden_parts["ppt/slides/slide1.xml"] = etree.tostring(hidden_root, encoding="UTF-8", xml_declaration=True)
        _write_candidate_parts(adapt_baseline, hidden_candidate, hidden_parts)
        hidden_plan = {"media_visibility_changes": [{"part": "ppt/slides/slide1.xml", "shape_id": 3,
            "before": None, "after": "1", "source_media_parts": ["ppt/media/image1.png"],
            "region_reason": "Only the translated label region is covered by an editable native overlay."}]}
        hidden_journal = adaptations.build_adaptation_journal(adapt_source, adapt_mapping, adapt_baseline, hidden_candidate, hidden_plan)
        assert hidden_journal["media_visibility_changes"] == [{"part": "ppt/slides/slide1.xml", "shape_id": 3,
            "property": "hidden", "before": None, "after": "1", "region_reason": hidden_plan["media_visibility_changes"][0]["region_reason"],
            "source_media_parts": ["ppt/media/image1.png"]}]

        no_scope_plan = {"media_visibility_changes": [{"part": "ppt/slides/slide1.xml", "shape_id": 3,
            "before": None, "after": "1", "region_reason": "A reason without a media scope is insufficient."}]}
        try:
            adaptations.build_adaptation_journal(adapt_source, adapt_mapping, adapt_baseline, hidden_candidate, no_scope_plan)
            raise AssertionError("picture visibility must be bound to exact source media parts")
        except adaptations.AdaptationError as exc:
            assert "exact related source image parts" in str(exc)

        hidden_shape_candidate = root / "adapt-hidden-native-shape.pptx"
        with zipfile.ZipFile(adapt_baseline) as package:
            hidden_shape_parts = {name: package.read(name) for name in package.namelist()}
        hidden_shape_root = etree.fromstring(hidden_shape_parts["ppt/slides/slide1.xml"])
        hidden_shape_root.xpath(".//p:sp/p:nvSpPr/p:cNvPr[@id='2']", namespaces=engine.NS)[0].set("hidden", "1")
        hidden_shape_parts["ppt/slides/slide1.xml"] = etree.tostring(hidden_shape_root, encoding="UTF-8", xml_declaration=True)
        _write_candidate_parts(adapt_baseline, hidden_shape_candidate, hidden_shape_parts)
        malicious_journal = adaptations.build_adaptation_journal(adapt_source, adapt_mapping, adapt_baseline, adapt_baseline)
        malicious_journal["candidate_sha256"] = adaptations.sha256(hidden_shape_candidate.read_bytes())
        malicious_journal["layout_changes"] = [{"part": "ppt/slides/slide1.xml", "shape_id": 2,
            "selector": "p:nvSpPr[0]/p:cNvPr[0]", "attribute": "hidden", "before": None, "after": "1"}]
        malicious_journal_path = root / "adapt-malicious-hidden-shape.json"
        malicious_journal_path.write_text(json.dumps(malicious_journal, ensure_ascii=False), encoding="utf-8")
        malicious_validation = adaptations.validate_adaptations(adapt_source, hidden_shape_candidate, adapt_mapping, malicious_journal_path)
        assert malicious_validation["status"] == "fail", "a hand-authored journal cannot bypass the picture-only visibility rule"
        assert any("outside the approved allowlist" in error for error in malicious_validation["errors"])

        shape_visibility_journal = dict(malicious_journal)
        shape_visibility_journal["layout_changes"] = []
        shape_visibility_journal["media_visibility_changes"] = [{"part": "ppt/slides/slide1.xml", "shape_id": 2,
            "property": "hidden", "before": None, "after": "1", "region_reason": "Attempted text-shape hide.",
            "source_media_parts": ["ppt/media/image1.png"]}]
        shape_visibility_path = root / "adapt-shape-in-visibility-list.json"
        shape_visibility_path.write_text(json.dumps(shape_visibility_journal, ensure_ascii=False), encoding="utf-8")
        shape_visibility_validation = adaptations.validate_adaptations(adapt_source, hidden_shape_candidate, adapt_mapping, shape_visibility_path)
        assert shape_visibility_validation["status"] == "fail", "the media visibility registry must also reject hidden native text shapes"
        assert any("allowed only for a native picture" in error for error in shape_visibility_validation["errors"])

        missing_media_scope_journal = dict(hidden_journal)
        missing_media_scope_journal["media_visibility_changes"] = [
            {key: value for key, value in hidden_journal["media_visibility_changes"][0].items() if key != "source_media_parts"}
        ]
        missing_media_scope_path = root / "adapt-picture-hide-without-media-scope.json"
        missing_media_scope_path.write_text(json.dumps(missing_media_scope_journal, ensure_ascii=False), encoding="utf-8")
        missing_scope_validation = adaptations.validate_adaptations(adapt_source, hidden_candidate, adapt_mapping, missing_media_scope_path)
        assert missing_scope_validation["status"] == "fail", "hand-authored picture visibility journals must include exact media scope"
        assert any("exact related source image parts" in error for error in missing_scope_validation["errors"])

        layout_source = root / "layout-visibility.pptx"
        layout_source.write_bytes(_layout_visibility_fixture())
        layout_extraction = {"units": [
            {"id": "hidden-prompt", "kind": "slide-layout", "part": "ppt/slideLayouts/slideLayout1.xml", "locator": {"index": 0}},
            {"id": "static-visible", "kind": "slide-layout", "part": "ppt/slideLayouts/slideLayout1.xml", "locator": {"index": 1}},
            {"id": "layout-table", "kind": "slide-layout", "part": "ppt/slideLayouts/slideLayout1.xml", "locator": {"index": 2}},
            {"id": "unused-layout", "kind": "slide-layout", "part": "ppt/slideLayouts/slideLayout2.xml", "locator": {"index": 0}},
            {"id": "notes-template", "kind": "notes-master", "part": "ppt/notesMasters/notesMaster1.xml", "locator": {"index": 0}},
        ]}
        with zipfile.ZipFile(layout_source) as layout_zip:
            visible_ids = checks._visible_layout_unit_ids(layout_zip, layout_extraction)
        assert "hidden-prompt" not in visible_ids and "unused-layout" not in visible_ids and "notes-template" not in visible_ids
        assert "static-visible" in visible_ids and "layout-table" in visible_ids, "visible static layout and table text must remain in translation coverage"

        extracted_layout = engine.extract_pptx(layout_source)
        layout_mapping = {"schema_version": 1, "source_sha256": extracted_layout["source_sha256"],
                          "units": [{"id": unit["id"], "source_text": unit["source_text"],
                                     "segments": unit["segments"], "status": "preserve",
                                     "reason": "QA fixture preserves source content."}
                                    for unit in extracted_layout["units"]]}
        layout_mapping_path = root / "layout-visibility-mapping.json"
        layout_mapping_path.write_text(json.dumps(layout_mapping, ensure_ascii=False), encoding="utf-8")
        layout_false_pass = checks.verify_translation(layout_source, layout_source, layout_mapping_path)
        assert layout_false_pass["status"] == "fail", "visible table text on a referenced layout must not pass untranslated"
        assert any("Chinese remains" in error and "ppt/slideLayouts/slideLayout1.xml#p2" in error
                   for error in layout_false_pass["errors"]), layout_false_pass["errors"]

        report_dir = root / "report-is-a-directory"
        report_dir.mkdir()
        report_failure_output = root / "must-not-survive-report-failure.pptx"
        try:
            engine.apply_mapping(source, mapping_path, report_failure_output, report_dir)
            raise AssertionError("a directory cannot be used as the report file")
        except engine.TranslationError as exc:
            assert "report" in str(exc).lower()
        assert not report_failure_output.exists()
        alias_output = root / "must-not-survive-path-alias.pptx"
        try:
            engine.apply_mapping(source, mapping_path, alias_output, alias_output)
            raise AssertionError("candidate and report paths must be distinct")
        except engine.TranslationError as exc:
            assert "same path" in str(exc).lower()
        assert not alias_output.exists()
        try:
            engine.apply_mapping(source, mapping_path, root / "must-not-survive-mapping-alias.pptx", mapping_path)
            raise AssertionError("report must not overwrite the mapping")
        except engine.TranslationError as exc:
            assert "mapping" in str(exc).lower()
        rollback_output = root / "must-be-rolled-back.pptx"
        rollback_report = root / "simulated-report-publication-failure.json"
        original_link = engine.os.link

        def fail_report_link(src, dst, *args, **kwargs):
            if Path(dst) == rollback_report:
                raise OSError("simulated report publication failure")
            return original_link(src, dst, *args, **kwargs)

        engine.os.link = fail_report_link
        try:
            try:
                engine.apply_mapping(source, mapping_path, rollback_output, rollback_report)
                raise AssertionError("report publication failure must fail the apply")
            except OSError as exc:
                assert "simulated" in str(exc)
        finally:
            engine.os.link = original_link
        assert not rollback_output.exists() and not rollback_report.exists()

        geometry_bad = root / "geometry-mutated.pptx"
        with zipfile.ZipFile(output) as existing:
            altered_parts = {name: existing.read(name) for name in existing.namelist()}
        slide_root = etree.fromstring(altered_parts["ppt/slides/slide1.xml"])
        shape_pr = slide_root.xpath(".//*[local-name()='spPr']")[0]
        xfrm = etree.SubElement(shape_pr, "{http://schemas.openxmlformats.org/drawingml/2006/main}xfrm")
        etree.SubElement(xfrm, "{http://schemas.openxmlformats.org/drawingml/2006/main}off", x="900", y="0")
        etree.SubElement(xfrm, "{http://schemas.openxmlformats.org/drawingml/2006/main}ext", cx="100", cy="100")
        altered_parts["ppt/slides/slide1.xml"] = etree.tostring(slide_root, encoding="utf-8", xml_declaration=True)
        geometry_bad.write_bytes(_zip_bytes(altered_parts))
        geometry_qa = checks.verify_translation(source, geometry_bad, mapping_path, report_path)
        assert geometry_qa["status"] == "fail"
        assert any("OOXML structure" in item for item in geometry_qa["errors"]), geometry_qa["errors"]

        original = json.loads(json.dumps(mapping, ensure_ascii=False))
        mapping["units"].pop()
        _, errors = engine._check_mapping(extraction, mapping)
        assert any("missing" in item for item in errors)
        mapping = json.loads(json.dumps(original, ensure_ascii=False))
        mapping["units"][0]["source_text"] = "stale"
        _, errors = engine._check_mapping(extraction, mapping)
        assert any("source_text changed" in item for item in errors)
        mapping = json.loads(json.dumps(original, ensure_ascii=False))
        mapping["units"][0]["segments"] = []
        _, errors = engine._check_mapping(extraction, mapping)
        assert any("segment count mismatch" in item for item in errors)
        mapping = json.loads(json.dumps(original, ensure_ascii=False))
        mapping["units"][0]["segments"] = ["", ""]
        _, errors = engine._check_mapping(extraction, mapping)
        assert any("empty translation" in item for item in errors)
        mapping = json.loads(json.dumps(original, ensure_ascii=False))
        mapping["units"][0]["segments"] = ["https://bad.example", "Title"]
        _, errors = engine._check_mapping(extraction, mapping)
        assert any("protected URL/code/model" in item for item in errors)
        mapping = json.loads(json.dumps(original, ensure_ascii=False))
        mapping["units"][0]["segments"] = ["English 2027", "Title"]
        _, errors = engine._check_mapping(extraction, mapping)
        assert any("numeric fact" in item for item in errors)
        assert engine._numeric_signature("每100万 tokens") == engine._numeric_signature("per 1 million tokens")
        assert engine._numeric_signature("2026年10月24日") == engine._numeric_signature("October 24, 2026")
        assert engine._numeric_signature("5.25点") == engine._numeric_signature("5.25 points")
        assert engine._numeric_signature("Highspeed官方2–3倍") == engine._numeric_signature("official Highspeed 2–3x speed")
        assert engine._numeric_signature("计划日期包含11月4日当天") == engine._numeric_signature("The deadline includes November 4")
        assert engine._numeric_signature("11月4日") == [("--11-04", "date")]
        assert engine._numeric_signature("11月4日") != engine._numeric_signature("November 5")
        assert engine._numeric_signature("2026年11月4日") != engine._numeric_signature("November 4")

        date_extraction = {
            "source_sha256": "date-fixture",
            "units": [{
                "id": "date-unit", "source_text": "11月4日", "segments": ["11月4日"],
                "kind": "slide", "locator": {}, "fields": [],
            }],
        }
        correct_date_mapping = {
            "schema_version": 1, "source_sha256": "date-fixture",
            "units": [{"id": "date-unit", "source_text": "11月4日", "segments": ["November 4"], "status": "translated"}],
        }
        _, errors = engine._check_mapping(date_extraction, correct_date_mapping)
        assert errors == [], errors
        wrong_date_mapping = json.loads(json.dumps(correct_date_mapping))
        wrong_date_mapping["units"][0]["segments"] = ["November 5"]
        _, errors = engine._check_mapping(date_extraction, wrong_date_mapping)
        assert any("numeric fact" in item for item in errors)

        # Natural English wording remains translatable, while actual model/API
        # identifiers, product names, currencies and URLs retain their identity.
        assert engine._protected_identity_tokens("模型任务") == engine._protected_identity_tokens("model tasks") == []
        assert engine._protected_identity_tokens("厂商内部评测") == engine._protected_identity_tokens("Vendor Internal Benchmark") == []
        assert engine._protected_identity_tokens("Kimi模型任务") == engine._protected_identity_tokens("Kimi model tasks") == []
        assert engine._protected_identity_tokens("非Kimi输出") == engine._protected_identity_tokens("Not Kimi output") == []
        assert engine._protected_identity_tokens("standard-template, vendor-reported, long-horizon, multi-turn, same-metric") == []
        assert engine._protected_identity_tokens("Kimi K3.1 Pro官方发布") == engine._protected_identity_tokens("Kimi K3.1 Pro Launch")
        assert engine._protected_identity_tokens("Kimi K3.1 Pro") != engine._protected_identity_tokens("Kimi K3.2 Pro")
        assert engine._protected_identity_tokens("Kimi Work 与 Kimi Code") == engine._protected_identity_tokens("Kimi Work and Kimi Code")
        assert engine._protected_identity_tokens("美元") == engine._protected_identity_tokens("USD")
        assert engine._protected_identity_tokens("美元") != engine._protected_identity_tokens("HKD")
        assert engine._protected_identity_tokens("see https://example.com/a") == engine._protected_identity_tokens("see https://example.com/a")
        assert engine._protected_identity_tokens("see https://example.com/a") != engine._protected_identity_tokens("see https://example.com/b")
        assert engine._protected_identity_tokens("--max-tokens and response_format") == ["--max-tokens", "response_format"]
        assert engine._protected_identity_tokens("传入reasoning_effort参数") == ["reasoning_effort"]
        assert engine._protected_identity_tokens("Base URL 与BaseURL") == ["Base URL", "BaseURL"]
        assert engine._protected_identity_tokens("山海短剧--AI翻译问题测试与反馈") == [], "Chinese title punctuation must not be mistaken for a CLI flag"
        assert engine._protected_identity_tokens("运行 --max-tokens 8") == ["--max-tokens"], "standalone CLI flags remain protected"
        assert engine._protected_identity_tokens("运行 -f 参数") == ["-f"], "standalone short CLI flags remain protected"

        external_source = root / "external-chart-source.pptx"
        with zipfile.ZipFile(source) as existing:
            external_parts = {name: existing.read(name) for name in existing.namelist()}
        rel_name = "ppt/charts/_rels/chart1.xml.rels"
        external_parts[rel_name] = external_parts[rel_name].replace(
            b'Target="../embeddings/chartdata.xlsx"',
            b'Target="https://example.com/chartdata.xlsx" TargetMode="External"',
        )
        external_source.write_bytes(_zip_bytes(external_parts))
        external_extraction = engine.extract_pptx(external_source)
        external_mapping_path = root / "external-mapping.json"
        external_mapping_path.write_text(json.dumps(_mapping_for(external_extraction), ensure_ascii=False), encoding="utf-8")
        external_output = root / "must-not-be-written.pptx"
        try:
            engine.apply_mapping(external_source, external_mapping_path, external_output)
            raise AssertionError("external chart data must block translation writeback")
        except engine.TranslationError as exc:
            assert "external chart data" in str(exc)
        assert not external_output.exists()

        smartart_source = root / "smartart-source.pptx"
        _add_smartart(source, smartart_source)
        smartart_extraction = engine.extract_pptx(smartart_source)
        smartart_mapping = _fully_translate_fixture(smartart_extraction)
        smartart_mapping_path = root / "smartart-mapping.json"
        smartart_mapping_path.write_text(json.dumps(smartart_mapping, ensure_ascii=False), encoding="utf-8")
        smartart_errors = engine._unsupported_inventory_errors(smartart_extraction["inventory"])
        assert any("smartart" in error.lower() for error in smartart_errors), smartart_errors
        _, errors = engine._check_mapping(smartart_extraction, smartart_mapping)
        assert any("smartart" in error.lower() for error in errors), errors
        smartart_output = root / "smartart-apply-must-not-write.pptx"
        try:
            engine.apply_mapping(smartart_source, smartart_mapping_path, smartart_output)
            raise AssertionError("SmartArt with unsupported text must block apply")
        except engine.TranslationError as exc:
            assert "smartart" in str(exc).lower()
        assert not smartart_output.exists()
        smartart_candidate = root / "smartart-qa-candidate.pptx"
        _write_candidate_for_qa(smartart_source, smartart_extraction, smartart_mapping, smartart_candidate)
        smartart_qa = checks.verify_translation(smartart_source, smartart_candidate, smartart_mapping_path)
        assert smartart_qa["status"] == "fail", smartart_qa
        assert smartart_qa["checks"]["unsupported_visible_content"] == "fail", smartart_qa
        assert any("smartart" in error.lower() for error in smartart_qa["errors"]), smartart_qa["errors"]

        named_chart_source = root / "named-range-chart-source.pptx"
        _add_named_range_chart(source, named_chart_source)
        named_chart_extraction = engine.extract_pptx(named_chart_source)
        unresolved_cache = [u for u in named_chart_extraction["units"] if u["kind"] == "chart-string-cache" and u["source_text"] == "类别"]
        assert len(unresolved_cache) == 1 and unresolved_cache[0]["locator"].get("workbook_cell") is None
        named_chart_mapping = _fully_translate_fixture(named_chart_extraction)
        named_chart_mapping_path = root / "named-range-chart-mapping.json"
        named_chart_mapping_path.write_text(json.dumps(named_chart_mapping, ensure_ascii=False), encoding="utf-8")
        _, errors = engine._check_mapping(named_chart_extraction, named_chart_mapping)
        assert any("unresolved-chart-string-cache" in error for error in errors), errors
        named_chart_output = root / "named-range-apply-must-not-write.pptx"
        try:
            engine.apply_mapping(named_chart_source, named_chart_mapping_path, named_chart_output)
            raise AssertionError("unresolved named-range chart text must block apply")
        except engine.TranslationError as exc:
            assert "unresolved-chart-string-cache" in str(exc)
        assert not named_chart_output.exists()
        named_chart_candidate = root / "named-range-qa-candidate.pptx"
        _write_candidate_for_qa(named_chart_source, named_chart_extraction, named_chart_mapping, named_chart_candidate)
        named_chart_qa = checks.verify_translation(named_chart_source, named_chart_candidate, named_chart_mapping_path)
        assert named_chart_qa["status"] == "fail", named_chart_qa
        assert named_chart_qa["checks"]["unsupported_visible_content"] == "fail", named_chart_qa
        assert any("unresolved-chart-string-cache" in error for error in named_chart_qa["errors"]), named_chart_qa["errors"]
        print("translation contracts: pass (extract/apply, rich text/group/table/notes, chart/workbook sync, failure guards, semantic numeric equivalence)")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
