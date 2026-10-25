#!/usr/bin/env python3
"""Synthetic OOXML contract tests for pptx_subset.select_slides."""

from __future__ import annotations

import hashlib
import json
import sys
import tempfile
import zipfile
from pathlib import Path
from unittest.mock import patch

from lxml import etree

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
import pptx_subset as subset


NS_P = subset.NS_P
NS_R = subset.NS_R
NS_REL = subset.NS_REL
NS_CT = subset.NS_CT
NS_APP = "http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
NS_VT = "http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"
NS_P14 = "http://schemas.microsoft.com/office/powerpoint/2010/main"


def _xml_bytes(text: str) -> bytes:
    return text.encode("utf-8")


def _fixture_parts() -> dict[str, bytes]:
    p = NS_P
    r = NS_R
    rel = NS_REL
    p14 = NS_P14
    parts: dict[str, bytes] = {
        "_rels/.rels": _xml_bytes(f'''<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="{rel}">
  <Relationship Id="rOffice" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="/ppt/presentation.xml"/>
  <Relationship Id="rCore" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rApp" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
  <Relationship Id="rThumb" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail" Target="docProps/thumbnail.jpeg"/>
</Relationships>'''),
        "docProps/core.xml": b"<coreProperties xmlns=\"http://schemas.openxmlformats.org/package/2006/metadata/core-properties\"/>\n",
        "docProps/app.xml": _xml_bytes(f'''<?xml version="1.0" encoding="UTF-8"?>
<Properties xmlns="{NS_APP}" xmlns:vt="{NS_VT}">
  <Application>Microsoft PowerPoint</Application>
  <Slides>52</Slides><Notes>51</Notes><HiddenSlides>4</HiddenSlides>
  <Pages>52</Pages><Words>8042</Words><Paragraphs>172</Paragraphs><Characters>52000</Characters><MMClips>7</MMClips>
  <CharactersWithSpaces>61000</CharactersWithSpaces><Lines>820</Lines>
  <HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Slide Titles</vt:lpstr></vt:variant><vt:variant><vt:i4>52</vt:i4></vt:variant></vt:vector></HeadingPairs>
  <TitlesOfParts><vt:vector size="3" baseType="lpstr"><vt:lpstr>Page One</vt:lpstr><vt:lpstr>UNSELECTED_SLIDE_SECRET</vt:lpstr><vt:lpstr>Page Three</vt:lpstr></vt:vector></TitlesOfParts>
</Properties>'''),
        "docProps/thumbnail.jpeg": b"cover-thumbnail-bytes",
        "ppt/presentation.xml": _xml_bytes(f'''<?xml version="1.0" encoding="UTF-8"?>
<p:presentation xmlns:p="{p}" xmlns:r="{r}" xmlns:p14="{p14}">
  <p:sldIdLst>
    <p:sldId id="256" r:id="rSlide1"/>
    <p:sldId id="257" r:id="rSlide2" show="0"/>
    <p:sldId id="258" r:id="rSlide3" show="0"/>
  </p:sldIdLst>
  <p:custShowLst>
    <p:custShow name="all pages" id="0"><p:sldLst>
      <p:sld r:id="rSlide1"/><p:sld r:id="rSlide2"/><p:sld r:id="rSlide3"/>
    </p:sldLst></p:custShow>
  </p:custShowLst>
  <p:extLst><p:ext uri="{{A0B7A7F5-4A9A-4BA0-8F93-5E5D9549F23A}}">
    <p14:sectionLst><p14:section name="all" id="section-1"><p14:sldIdLst>
      <p14:sldId id="256"/><p14:sldId id="257"/><p14:sldId id="258"/>
    </p14:sldIdLst></p14:section></p14:sectionLst>
  </p:ext></p:extLst>
</p:presentation>'''),
        "ppt/_rels/presentation.xml.rels": _xml_bytes(f'''<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="{rel}">
  <Relationship Id="rSlide1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
  <Relationship Id="rSlide2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>
  <Relationship Id="rSlide3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide3.xml"/>
  <Relationship Id="rMaster" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
</Relationships>'''),
        "ppt/slides/slide1.xml": _xml_bytes(f'''<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="{p}" xmlns:r="{r}"><p:cSld name="first"><p:spTree/></p:cSld></p:sld>'''),
        "ppt/slides/slide2.xml": _xml_bytes(f'''<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="{p}" xmlns:r="{r}"><p:cSld name="middle"><p:spTree/></p:cSld></p:sld>'''),
        "ppt/slides/slide3.xml": _xml_bytes(f'''<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="{p}" xmlns:r="{r}"><p:cSld name="last"><p:spTree/></p:cSld></p:sld>'''),
        "ppt/slides/_rels/slide1.xml.rels": _xml_bytes(f'''<Relationships xmlns="{rel}">
  <Relationship Id="rLayout" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="/ppt/media/shared.png"/>
  <Relationship Id="rChart" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>
  <Relationship Id="rNotes" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide1.xml"/>
</Relationships>'''),
        "ppt/slides/_rels/slide2.xml.rels": _xml_bytes(f'''<Relationships xmlns="{rel}">
  <Relationship Id="rLayout" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/unused.png"/>
  <Relationship Id="rChart" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart2.xml"/>
  <Relationship Id="rNotes" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide2.xml"/>
</Relationships>'''),
        "ppt/slides/_rels/slide3.xml.rels": _xml_bytes(f'''<Relationships xmlns="{rel}">
  <Relationship Id="rLayout" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/shared.png"/>
  <Relationship Id="rChart" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>
  <Relationship Id="rNotes" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide3.xml"/>
</Relationships>'''),
        "ppt/slideLayouts/slideLayout1.xml": _xml_bytes(f'''<p:sldLayout xmlns:p="{p}"/>'''),
        "ppt/slideLayouts/_rels/slideLayout1.xml.rels": _xml_bytes(f'''<Relationships xmlns="{rel}">
  <Relationship Id="rMaster" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>'''),
        "ppt/slideMasters/slideMaster1.xml": _xml_bytes(f'''<p:sldMaster xmlns:p="{p}"/>'''),
        "ppt/slideMasters/_rels/slideMaster1.xml.rels": _xml_bytes(f'''<Relationships xmlns="{rel}">
  <Relationship Id="rTheme" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>'''),
        "ppt/theme/theme1.xml": b"<a:theme xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\"/>\n",
        "ppt/notesSlides/notesSlide1.xml": b"<notes marker=\"selected-one\"/>\n",
        "ppt/notesSlides/notesSlide2.xml": b"<notes marker=\"unselected\"/>\n",
        "ppt/notesSlides/notesSlide3.xml": b"<notes marker=\"selected-three\"/>\n",
        "ppt/notesSlides/_rels/notesSlide1.xml.rels": _xml_bytes(f'''<Relationships xmlns="{rel}">
  <Relationship Id="rSlide" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="../slides/slide1.xml"/>
  <Relationship Id="rMaster" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster" Target="../notesMasters/notesMaster1.xml"/>
</Relationships>'''),
        "ppt/notesSlides/_rels/notesSlide2.xml.rels": _xml_bytes(f'''<Relationships xmlns="{rel}">
  <Relationship Id="rSlide" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="../slides/slide2.xml"/>
  <Relationship Id="rMaster" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster" Target="../notesMasters/notesMaster1.xml"/>
</Relationships>'''),
        "ppt/notesSlides/_rels/notesSlide3.xml.rels": _xml_bytes(f'''<Relationships xmlns="{rel}">
  <Relationship Id="rSlide" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="../slides/slide3.xml"/>
  <Relationship Id="rMaster" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster" Target="../notesMasters/notesMaster1.xml"/>
</Relationships>'''),
        "ppt/notesMasters/notesMaster1.xml": b"<notesMaster/>\n",
        "ppt/charts/chart1.xml": b"<chart marker=\"shared-chart\"/>\n",
        "ppt/charts/chart2.xml": b"<chart marker=\"unused-chart\"/>\n",
        "ppt/charts/_rels/chart1.xml.rels": _xml_bytes(f'''<Relationships xmlns="{rel}">
  <Relationship Id="rBook" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/package" Target="../embeddings/chartdata.xlsx"/>
</Relationships>'''),
        "ppt/embeddings/chartdata.xlsx": b"native-chart-workbook-bytes",
        "ppt/media/shared.png": b"shared-image-bytes",
        "ppt/media/unused.png": b"unselected-image-bytes",
        "ppt/media/orphan.png": b"orphan-image-bytes",
    }
    content_type_overrides = []
    for name in parts:
        if name.endswith(".xml"):
            if name == "ppt/presentation.xml":
                kind = "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"
            elif name == "docProps/app.xml":
                kind = "application/vnd.openxmlformats-officedocument.extended-properties+xml"
            elif name.startswith("ppt/slides/") and "/_rels/" not in name:
                kind = "application/vnd.openxmlformats-officedocument.presentationml.slide+xml"
            elif name.startswith("ppt/notesSlides/") and "/_rels/" not in name:
                kind = "application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"
            elif name.startswith("ppt/slideLayouts/") and "/_rels/" not in name:
                kind = "application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"
            elif name.startswith("ppt/slideMasters/") and "/_rels/" not in name:
                kind = "application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"
            elif name.startswith("ppt/notesMasters/"):
                kind = "application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"
            elif name.startswith("ppt/charts/") and "/_rels/" not in name:
                kind = "application/vnd.openxmlformats-officedocument.drawingml.chart+xml"
            else:
                kind = "application/xml"
            content_type_overrides.append(f'<Override PartName="/{name}" ContentType="{kind}"/>')
    defaults = '''<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="png" ContentType="image/png"/>
    <Default Extension="jpeg" ContentType="image/jpeg"/>
    <Default Extension="xlsx" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"/>'''
    parts["[Content_Types].xml"] = _xml_bytes(
        f'<Types xmlns="{NS_CT}">{defaults}{"".join(content_type_overrides)}</Types>'
    )
    return parts


def _write_fixture(path: Path, changes: dict[str, bytes] | None = None) -> dict[str, bytes]:
    parts = _fixture_parts()
    if changes:
        parts.update(changes)
    with zipfile.ZipFile(path, "w") as archive:
        for index, (name, data) in enumerate(parts.items()):
            info = zipfile.ZipInfo(name, date_time=(2020, 1, 2, 3, 4, 6))
            info.compress_type = zipfile.ZIP_STORED if index % 2 == 0 else zipfile.ZIP_DEFLATED
            info.external_attr = 0o100640 << 16
            info.comment = f"entry-{index}".encode()
            archive.writestr(info, data)
    return parts


def _read_parts(path: Path) -> dict[str, bytes]:
    with zipfile.ZipFile(path) as archive:
        return {info.filename: archive.read(info) for info in archive.infolist() if not info.is_dir()}


def _expect_subset_error(function, code: str) -> subset.SubsetError:
    try:
        function()
    except subset.SubsetError as exc:
        assert exc.code == code, str(exc)
        assert str(exc).startswith(code + ":"), str(exc)
        return exc
    raise AssertionError(f"Expected {code}")


def test_selection_subset_and_package_preservation(root: Path) -> None:
    source = root / "source.pptx"
    output = root / "subset.pptx"
    report_path = root / "subset-report.json"
    source_parts = _write_fixture(source)

    original_infolist = zipfile.ZipFile.infolist
    observed_source_info: list[tuple[zipfile.ZipInfo, int]] = []

    def capture_source_info(archive: zipfile.ZipFile):
        rows = original_infolist(archive)
        if str(Path(archive.filename).resolve()) == str(source.resolve()) and archive.mode == "r":
            observed_source_info.extend((info, info.header_offset) for info in rows)
        return rows

    with patch.object(zipfile.ZipFile, "infolist", capture_source_info):
        result = subset.select_slides(source, "1, 3", output, report_path)

    assert observed_source_info, "source ZipInfo rows should be observed"
    assert all(info.header_offset == offset for info, offset in observed_source_info), "source ZipInfo offsets must not be rewritten"

    output_parts = _read_parts(output)
    assert output_parts["ppt/slides/slide1.xml"] == source_parts["ppt/slides/slide1.xml"]
    assert output_parts["ppt/slides/slide3.xml"] == source_parts["ppt/slides/slide3.xml"]
    for part in (
        "ppt/notesSlides/notesSlide1.xml",
        "ppt/notesSlides/notesSlide3.xml",
        "ppt/charts/chart1.xml",
        "ppt/charts/_rels/chart1.xml.rels",
        "ppt/embeddings/chartdata.xlsx",
        "ppt/media/shared.png",
        "ppt/slideLayouts/slideLayout1.xml",
    ):
        assert output_parts[part] == source_parts[part], f"retained bytes changed: {part}"
    app_properties = etree.fromstring(output_parts["docProps/app.xml"])
    app_values = {etree.QName(node).localname: (node.text or "") for node in app_properties}
    assert app_values["Slides"] == "2"
    assert app_values["Notes"] == "2"
    assert app_values["HiddenSlides"] == "1"
    assert not (set(app_values) & subset.APP_STAT_PROPERTIES)
    assert b"UNSELECTED_SLIDE_SECRET" not in output_parts["docProps/app.xml"]
    assert "docProps/thumbnail.jpeg" in output_parts, "the original first-page thumbnail may remain when source page 1 stays first"
    for removed in (
        "ppt/slides/slide2.xml",
        "ppt/slides/_rels/slide2.xml.rels",
        "ppt/notesSlides/notesSlide2.xml",
        "ppt/charts/chart2.xml",
        "ppt/media/unused.png",
        "ppt/media/orphan.png",
    ):
        assert removed not in output_parts

    presentation = etree.fromstring(output_parts["ppt/presentation.xml"])
    kept_rids = [node.get(f"{{{NS_R}}}id") for node in presentation.findall(f"{{{NS_P}}}sldIdLst/{{{NS_P}}}sldId")]
    assert kept_rids == ["rSlide1", "rSlide3"]
    kept_section_ids = presentation.xpath("//*[local-name()='sectionLst']/*[local-name()='section']/*[local-name()='sldIdLst']/*[local-name()='sldId']/@id")
    assert kept_section_ids == ["256", "258"]
    kept_custom_rids = presentation.xpath("./p:custShowLst/p:custShow/p:sldLst/p:sld/@r:id", namespaces={"p": NS_P, "r": NS_R})
    assert kept_custom_rids == ["rSlide1", "rSlide3"]

    output_rels = etree.fromstring(output_parts["ppt/_rels/presentation.xml.rels"])
    presentation_slide_rids = [
        node.get("Id") for node in output_rels.findall(f"{{{NS_REL}}}Relationship")
        if node.get("Type", "").endswith("/slide")
    ]
    assert presentation_slide_rids == ["rSlide1", "rSlide3"]

    content_types = etree.fromstring(output_parts["[Content_Types].xml"])
    override_names = {node.get("PartName") for node in content_types.findall(f"{{{NS_CT}}}Override")}
    assert "/ppt/slides/slide2.xml" not in override_names
    assert "/ppt/charts/chart2.xml" not in override_names

    assert result["source_sha256"] == hashlib.sha256(source.read_bytes()).hexdigest()
    assert result["subset_sha256"] == hashlib.sha256(output.read_bytes()).hexdigest()
    assert result["requested_pages"] == [1, 3]
    assert result["page_mapping"] == [
        {"source_page": 1, "output_page": 1, "source_slide_id": "256", "relationship_id": "rSlide1", "slide_part": "ppt/slides/slide1.xml"},
        {"source_page": 3, "output_page": 2, "source_slide_id": "258", "relationship_id": "rSlide3", "slide_part": "ppt/slides/slide3.xml"},
    ]
    assert result["selected_slide_xml_byte_equal"] is True
    assert result["metadata_updates"]["updated_properties"] == {"Slides": 2, "Notes": 2, "HiddenSlides": 1}
    assert {"HeadingPairs", "TitlesOfParts", "Words", "Paragraphs"} <= set(result["metadata_updates"]["removed_properties"])
    assert result["thumbnail_relationships_removed"] == []
    assert all(row["byte_equal"] and row["source_sha256"] == row["subset_sha256"] for row in result["selected_slide_xml"])
    assert "ppt/slides/slide2.xml" in result["deleted_parts"]
    assert "ppt/media/orphan.png" in result["deleted_parts"]
    assert json.loads(report_path.read_text(encoding="utf-8")) == result

    with zipfile.ZipFile(source) as original, zipfile.ZipFile(output) as selected:
        for name in ("ppt/slides/slide1.xml", "ppt/slides/slide3.xml", "ppt/media/shared.png"):
            old_info = original.getinfo(name)
            new_info = selected.getinfo(name)
            assert new_info.date_time == old_info.date_time
            assert new_info.compress_type == old_info.compress_type
            assert new_info.external_attr == old_info.external_attr
            assert new_info.comment == old_info.comment

    without_cover = root / "subset-without-original-cover.pptx"
    without_cover_result = subset.select_slides(source, "2,3", without_cover)
    without_cover_parts = _read_parts(without_cover)
    assert "docProps/thumbnail.jpeg" not in without_cover_parts
    root_rels = etree.fromstring(without_cover_parts["_rels/.rels"])
    assert not any(node.get("Type", "").endswith("/thumbnail") for node in root_rels)
    assert "docProps/thumbnail.jpeg" in without_cover_result["deleted_parts"]
    assert without_cover_result["thumbnail_relationships_removed"] == [
        {"relationship_id": "rThumb", "target": "docProps/thumbnail.jpeg"}
    ]
    without_cover_app = etree.fromstring(without_cover_parts["docProps/app.xml"])
    without_cover_values = {etree.QName(node).localname: (node.text or "") for node in without_cover_app}
    assert without_cover_values["Slides"] == "2"
    assert without_cover_values["Notes"] == "2"
    assert without_cover_values["HiddenSlides"] == "2"


def test_bad_page_selectors(root: Path) -> None:
    assert subset._parse_selection("1-20,22", 22) == [*range(1, 21), 22]
    assert subset._parse_selection(" 1 - 2, 4 ", 4) == [1, 2, 4]
    source = root / "selectors.pptx"
    _write_fixture(source)
    cases = (
        ("", "PPTX_SUBSET_INVALID_SELECTION"),
        ("0", "PPTX_SUBSET_INVALID_SELECTION"),
        ("4", "PPTX_SUBSET_INVALID_SELECTION"),
        ("3-2", "PPTX_SUBSET_INVALID_SELECTION"),
        ("1,1", "PPTX_SUBSET_INVALID_SELECTION"),
        ("3,2", "PPTX_SUBSET_INVALID_SELECTION"),
        ("1-2,2-3", "PPTX_SUBSET_INVALID_SELECTION"),
        ("1-3,2", "PPTX_SUBSET_INVALID_SELECTION"),
        ("one", "PPTX_SUBSET_INVALID_SELECTION"),
    )
    for index, (selector, code) in enumerate(cases):
        output = root / f"bad-{index}.pptx"
        _expect_subset_error(lambda: subset.select_slides(source, selector, output), code)
        assert not output.exists(), f"invalid selector wrote output: {selector!r}"


def test_existing_outputs_are_protected(root: Path) -> None:
    source = root / "protected-source.pptx"
    _write_fixture(source)
    output = root / "existing.pptx"
    output.write_bytes(b"preserve existing output")
    _expect_subset_error(lambda: subset.select_slides(source, "1", output), "PPTX_SUBSET_OUTPUT_EXISTS")
    assert output.read_bytes() == b"preserve existing output"

    report = root / "existing-report.json"
    report.write_bytes(b"preserve existing report")
    _expect_subset_error(lambda: subset.select_slides(source, "1", root / "fresh.pptx", report), "PPTX_SUBSET_OUTPUT_EXISTS")
    assert not (root / "fresh.pptx").exists()
    assert report.read_bytes() == b"preserve existing report"

    _expect_subset_error(lambda: subset.select_slides(source, "1", source), "PPTX_SUBSET_OUTPUT_PATH_INVALID")

    dangling_target = root / "dangling-target.pptx"
    dangling_output = root / "dangling-output.pptx"
    try:
        dangling_output.symlink_to(dangling_target)
    except (NotImplementedError, OSError):
        pass
    else:
        _expect_subset_error(lambda: subset.select_slides(source, "1", dangling_output), "PPTX_SUBSET_OUTPUT_EXISTS")
        assert dangling_output.is_symlink()
        assert not dangling_target.exists()


def test_stale_relationship_is_rejected(root: Path) -> None:
    parts = _fixture_parts()
    presentation = etree.fromstring(parts["ppt/presentation.xml"])
    slide = presentation.find(f"{{{NS_P}}}sldIdLst/{{{NS_P}}}sldId")
    assert slide is not None
    slide.set(f"{{{NS_R}}}id", "rExpired")
    parts["ppt/presentation.xml"] = etree.tostring(presentation, encoding="UTF-8", xml_declaration=True)
    source = root / "stale.pptx"
    with zipfile.ZipFile(source, "w") as archive:
        for name, data in parts.items():
            archive.writestr(name, data)
    output = root / "stale-output.pptx"
    _expect_subset_error(lambda: subset.select_slides(source, "1", output), "PPTX_SUBSET_STALE_RELATIONSHIP")
    assert not output.exists()


def test_cross_slide_relationship_is_rejected(root: Path) -> None:
    parts = _fixture_parts()
    rels = etree.fromstring(parts["ppt/slides/_rels/slide1.xml.rels"])
    etree.SubElement(
        rels,
        f"{{{NS_REL}}}Relationship",
        Id="rJump",
        Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide",
        Target="slide2.xml",
    )
    parts["ppt/slides/_rels/slide1.xml.rels"] = etree.tostring(rels, encoding="UTF-8", xml_declaration=True)
    source = root / "cross-slide-link.pptx"
    with zipfile.ZipFile(source, "w") as archive:
        for name, data in parts.items():
            archive.writestr(name, data)
    output = root / "cross-slide-output.pptx"
    _expect_subset_error(lambda: subset.select_slides(source, "1", output), "PPTX_SUBSET_CROSS_SLIDE_LINK")
    assert not output.exists()


def run() -> int:
    with tempfile.TemporaryDirectory(prefix="pptx-subset-contract-") as temp:
        root = Path(temp)
        test_selection_subset_and_package_preservation(root)
        test_bad_page_selectors(root)
        test_existing_outputs_are_protected(root)
        test_stale_relationship_is_rejected(root)
        test_cross_slide_relationship_is_rejected(root)
    print("pptx subset contracts: pass (page ordering, OOXML reachability, byte preservation, package metadata, sections/custom shows, stale/cross-slide guards, output protection)")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
