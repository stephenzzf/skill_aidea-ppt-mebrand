#!/usr/bin/env python3
"""Regression tests for Unicode matching and embedded/rendered font evidence."""
from __future__ import annotations

import importlib.util
import tempfile
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch
import zipfile

import fitz

MODULE_PATH = Path(__file__).with_name("font_audit.py")
SPEC = importlib.util.spec_from_file_location("font_audit", MODULE_PATH)
font_audit = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
sys.modules[SPEC.name] = font_audit
SPEC.loader.exec_module(font_audit)


def write_fixture(pptx: Path, requested_font: str, embed_font: bool = True) -> None:
    presentation = (
        '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<p:sldSz cx="12192000" cy="6858000"/><p:embeddedFontLst>'
        + (f'<p:embeddedFont><p:font typeface="{requested_font}"/><p:regular r:id="rFont"/></p:embeddedFont>' if embed_font else "")
        + '</p:embeddedFontLst></p:presentation>'
    )
    relationships = (
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + ('<Relationship Id="rFont" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/font1.fntdata"/>' if embed_font else "")
        + '</Relationships>'
    )
    slide = (
        '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree>'
        '<p:sp><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="1800">'
        f'<a:latin typeface="{requested_font}"/></a:rPr><a:t>Sample text</a:t></a:r></a:p></p:txBody></p:sp>'
        '</p:spTree></p:cSld></p:sld>'
    )
    with zipfile.ZipFile(pptx, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("ppt/presentation.xml", presentation)
        archive.writestr("ppt/_rels/presentation.xml.rels", relationships)
        archive.writestr("ppt/slides/slide1.xml", slide)
        if embed_font:
            archive.writestr("ppt/fonts/font1.fntdata", b"embedded-fixture-font-bytes")


def write_pdf(pdf: Path, actual_font: str) -> None:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Sample text", fontname=actual_font)
    doc.save(pdf)
    doc.close()


class FontAuditTests(unittest.TestCase):
    def test_normalization_preserves_chinese_and_never_matches_empty_keys(self) -> None:
        self.assertEqual(font_audit.comparison_key("等线"), "等线")
        self.assertEqual(font_audit.comparison_key("Poppins-Light"), "poppinslight")
        self.assertFalse(font_audit._names_match("等线", ["Hiragino Maru Gothic Pro"]))
        self.assertFalse(font_audit._names_match("", [""]))

    def test_fontconfig_fallback_does_not_satisfy_unknown_chinese_font(self) -> None:
        with tempfile.TemporaryDirectory(prefix="me-font-audit-") as temp:
            font_file = Path(temp) / "fallback.ttc"
            font_file.write_bytes(b"fixture")

            def fake_run(command, **_kwargs):
                if command[0] == "fc-match":
                    return subprocess.CompletedProcess(command, 0, f"Hiragino Maru Gothic Pro|{font_file}", "")
                if command[0] == "fc-scan":
                    return subprocess.CompletedProcess(command, 0, "Hiragino Maru Gothic Pro\nHiragino Maru Gothic Pro W4\nHiraMaruPro-W4\n", "")
                self.fail(f"Unexpected subprocess: {command}")

            with patch.object(font_audit.subprocess, "run", side_effect=fake_run):
                result = font_audit.fontconfig_match("等线")
            self.assertTrue(result["available"])
            self.assertFalse(result["exact_match"])

    def test_rendered_font_must_cover_the_actual_text_run_not_another_span_on_page(self) -> None:
        with tempfile.TemporaryDirectory(prefix="me-font-span-visibility-") as temp:
            pptx = Path(temp) / "usage.pptx"
            pdf = Path(temp) / "visible.pdf"
            slide = (
                '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
                'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree>'
                '<p:sp><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr><a:latin typeface="Requested Face"/></a:rPr><a:t>Visible body text</a:t></a:r></a:p></p:txBody></p:sp>'
                '</p:spTree></p:cSld></p:sld>'
            )
            with zipfile.ZipFile(pptx, "w") as archive:
                archive.writestr("ppt/slides/slide1.xml", slide)
            pdf.write_bytes(b"fixture PDF evidence is patched")
            with (
                patch.object(font_audit, "fontconfig_match", return_value={
                    "resolved_family": "Requested Face", "font_file": "/requested", "available": True,
                    "metadata_names": ["Requested Face"], "exact_match": True, "error": None,
                }),
                patch.object(font_audit, "_pdf_fonts", return_value={1: {
                    "span_fonts": {"Requested Face", "Fallback Face"},
                    "span_text": ["Other decorative text", "Visible body text"],
                    "font_spans": [
                        {"font": "Requested Face", "text": "Other decorative text"},
                        {"font": "Fallback Face", "text": "Visible body text"},
                    ],
                    "page_text": "Other decorative text\nVisible body text", "descriptors": [],
                }}),
            ):
                result = font_audit.audit(pptx, pdf)
            self.assertFalse(result["fonts"][0]["rendered_pdf_match"])
            self.assertIn("Fallback Face", result["fonts"][0]["rendered_pdf_fonts"])

    def test_every_visible_run_must_match_requested_font(self) -> None:
        with tempfile.TemporaryDirectory(prefix="me-font-all-runs-") as temp:
            pptx = Path(temp) / "usage.pptx"
            pdf = Path(temp) / "visible.pdf"
            slide = (
                '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
                'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree>'
                '<p:sp><p:txBody><a:bodyPr/><a:lstStyle/><a:p>'
                '<a:r><a:rPr><a:latin typeface="Requested Face"/></a:rPr><a:t>First visible run</a:t></a:r>'
                '<a:r><a:rPr><a:latin typeface="Requested Face"/></a:rPr><a:t>Second visible run</a:t></a:r>'
                '</a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>'
            )
            with zipfile.ZipFile(pptx, "w") as archive:
                archive.writestr("ppt/slides/slide1.xml", slide)
            pdf.write_bytes(b"fixture PDF evidence is patched")
            with (
                patch.object(font_audit, "fontconfig_match", return_value={
                    "resolved_family": "Requested Face", "font_file": "/requested", "available": True,
                    "metadata_names": ["Requested Face"], "exact_match": True, "error": None,
                }),
                patch.object(font_audit, "_pdf_fonts", return_value={1: {
                    "span_fonts": {"Requested Face", "Fallback Face"},
                    "span_text": ["First visible run", "Second visible run"],
                    "font_spans": [
                        {"font": "Requested Face", "text": "First visible run"},
                        {"font": "Fallback Face", "text": "Second visible run"},
                    ],
                    "page_text": "First visible runSecond visible run", "descriptors": [],
                }}),
            ):
                result = font_audit.audit(pptx, pdf)
            self.assertFalse(result["ok"], "one matching run must not mask a visible fallback run")
            self.assertFalse(result["fonts"][0]["rendered_pdf_match"])
            self.assertEqual(result["fonts"][0]["mismatched_rendered_run_count"], 1)
            self.assertEqual(result["fonts"][0]["run_count"], 2)

    def test_repeated_text_occurrences_cannot_borrow_a_matching_font(self) -> None:
        with tempfile.TemporaryDirectory(prefix="me-font-repeated-text-") as temp:
            pptx = Path(temp) / "usage.pptx"
            pdf = Path(temp) / "visible.pdf"
            slide = (
                '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
                'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree>'
                '<p:sp><p:txBody><a:bodyPr/><a:lstStyle/><a:p>'
                '<a:r><a:rPr><a:latin typeface="Requested Face"/></a:rPr><a:t>Repeat label</a:t></a:r>'
                '<a:r><a:rPr><a:latin typeface="Requested Face"/></a:rPr><a:t>Repeat label</a:t></a:r>'
                '</a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>'
            )
            with zipfile.ZipFile(pptx, "w") as archive:
                archive.writestr("ppt/slides/slide1.xml", slide)
            pdf.write_bytes(b"fixture PDF evidence is patched")
            with (
                patch.object(font_audit, "fontconfig_match", return_value={
                    "resolved_family": "Requested Face", "font_file": "/requested", "available": True,
                    "metadata_names": ["Requested Face"], "exact_match": True, "error": None,
                }),
                patch.object(font_audit, "_pdf_fonts", return_value={1: {
                    "span_fonts": {"Requested Face", "Fallback Face"},
                    "span_text": ["Repeat label", "Repeat label"],
                    "font_spans": [
                        {"font": "Requested Face", "text": "Repeat label"},
                        {"font": "Fallback Face", "text": "Repeat label"},
                    ],
                    "page_text": "Repeat labelRepeat label", "descriptors": [],
                }}),
            ):
                result = font_audit.audit(pptx, pdf)
            self.assertFalse(result["ok"], "a matching repeated occurrence cannot conceal a fallback occurrence")
            self.assertFalse(result["fonts"][0]["rendered_pdf_match"])
            self.assertGreater(result["fonts"][0]["mismatched_rendered_run_count"], 0)

    def test_mixed_script_pdf_spans_must_match_their_requested_script_faces(self) -> None:
        with tempfile.TemporaryDirectory(prefix="me-font-swapped-scripts-") as temp:
            pptx = Path(temp) / "usage.pptx"
            pdf = Path(temp) / "visible.pdf"
            slide = (
                '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
                'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree>'
                '<p:sp><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r>'
                '<a:rPr><a:latin typeface="Latin Wanted"/><a:ea typeface="CJK Wanted"/></a:rPr>'
                '<a:t>AI你好</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>'
            )
            with zipfile.ZipFile(pptx, "w") as archive:
                archive.writestr("ppt/slides/slide1.xml", slide)
            pdf.write_bytes(b"fixture PDF evidence is patched")
            with (
                patch.object(font_audit, "fontconfig_match", side_effect=lambda requested: {
                    "resolved_family": requested, "font_file": f"/{requested.replace(' ', '-')}",
                    "available": True, "metadata_names": [requested], "exact_match": True, "error": None,
                }),
                patch.object(font_audit, "_pdf_fonts", return_value={1: {
                    "span_fonts": {"Latin Wanted", "CJK Wanted"},
                    "span_text": ["AI", "你好"],
                    "font_spans": [
                        {"font": "CJK Wanted", "text": "AI"},
                        {"font": "Latin Wanted", "text": "你好"},
                    ],
                    "page_text": "AI你好", "descriptors": [],
                }}),
            ):
                result = font_audit.audit(pptx, pdf)
            self.assertFalse(result["ok"], "a mixed-script font set cannot pass when actual faces are assigned to the wrong scripts")
            self.assertEqual({row["requested"] for row in result["fonts"]}, {"Latin Wanted", "CJK Wanted"})
            self.assertTrue(all(not row["rendered_pdf_match"] for row in result["fonts"]))

    def test_every_pdf_span_within_a_script_segment_must_match(self) -> None:
        with tempfile.TemporaryDirectory(prefix="me-font-split-span-") as temp:
            pptx = Path(temp) / "usage.pptx"
            pdf = Path(temp) / "visible.pdf"
            slide = (
                '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
                'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree>'
                '<p:sp><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r>'
                '<a:rPr><a:latin typeface="Requested Face"/></a:rPr><a:t>AIO</a:t>'
                '</a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>'
            )
            with zipfile.ZipFile(pptx, "w") as archive:
                archive.writestr("ppt/slides/slide1.xml", slide)
            pdf.write_bytes(b"fixture PDF evidence is patched")
            with (
                patch.object(font_audit, "fontconfig_match", return_value={
                    "resolved_family": "Requested Face", "font_file": "/requested", "available": True,
                    "metadata_names": ["Requested Face"], "exact_match": True, "error": None,
                }),
                patch.object(font_audit, "_pdf_fonts", return_value={1: {
                    "span_fonts": {"Requested Face", "Fallback Face"},
                    "span_text": ["AI", "O"],
                    "font_spans": [
                        {"font": "Requested Face", "text": "AI"},
                        {"font": "Fallback Face", "text": "O"},
                    ],
                    "page_text": "AIO", "descriptors": [],
                }}),
            ):
                result = font_audit.audit(pptx, pdf)
            self.assertFalse(result["ok"], "one correctly rendered fragment cannot mask a fallback fragment in the same run")
            self.assertFalse(result["fonts"][0]["rendered_pdf_match"])
            self.assertEqual(result["fonts"][0]["mismatched_rendered_run_count"], 1)

    def test_style_variant_is_an_alias_only_when_font_metadata_proves_the_base_family(self) -> None:
        self.assertTrue(font_audit._metadata_alias_match("DengXian", ["DengXian-Bold"], ["DengXian", "等线"]))
        self.assertFalse(font_audit._metadata_alias_match("Arial Black", ["ArialMT"], ["Arial Black", "Arial-Black"]))

    def test_font_script_selection_uses_latin_and_east_asian_faces_for_their_text(self) -> None:
        import xml.etree.ElementTree as ET
        props = ET.fromstring(
            '<a:rPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
            '<a:latin typeface="Montserrat"/><a:ea typeface="Source Han Sans CN"/>'
            '</a:rPr>'
        )
        self.assertEqual(font_audit._font_names_for_text(props, "MarTech"), ["Montserrat"])
        self.assertEqual(font_audit._font_names_for_text(props, "受众"), ["Source Han Sans CN"])
        self.assertEqual(font_audit._font_names_for_text(props, "MarTech受众"), ["Montserrat", "Source Han Sans CN"])

    def test_pdf_page_text_excludes_unrendered_slide_text_from_font_requirements(self) -> None:
        with tempfile.TemporaryDirectory(prefix="me-font-visibility-") as temp:
            pptx = Path(temp) / "usage.pptx"
            pdf = Path(temp) / "visible.pdf"
            slide = (
                '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
                'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree>'
                '<p:sp><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr><a:latin typeface="Unused Layout Face"/></a:rPr><a:t>Hidden template text</a:t></a:r></a:p></p:txBody></p:sp>'
                '<p:sp><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr><a:latin typeface="Visible Missing Face"/></a:rPr><a:t>Visible body text</a:t></a:r></a:p></p:txBody></p:sp>'
                '</p:spTree></p:cSld></p:sld>'
            )
            with zipfile.ZipFile(pptx, "w") as archive:
                archive.writestr("ppt/slides/slide1.xml", slide)
            pdf.write_bytes(b"not parsed; PDF evidence is stubbed below")
            with (
                patch.object(font_audit, "fontconfig_match", return_value={
                    "resolved_family": "Fallback", "font_file": "/fallback", "available": False,
                    "metadata_names": ["Fallback"], "exact_match": False, "error": None,
                }),
                patch.object(font_audit, "_pdf_fonts", return_value={1: {
                    "span_fonts": {"Fallback"}, "span_text": ["Visible body text"],
                    "page_text": "Visible body text", "descriptors": [],
                }}),
            ):
                result = font_audit.audit(pptx, pdf)
            self.assertEqual([row["requested"] for row in result["fonts"]], ["Visible Missing Face"])
            self.assertEqual(result["ignored_unrendered_fonts"][0]["requested"], "Unused Layout Face")
            self.assertFalse(result["ok"], "a genuinely visible missing font must still fail")

    def test_inherited_placeholder_font_and_size_are_resolved_only_from_used_layout(self) -> None:
        with tempfile.TemporaryDirectory(prefix="me-font-inheritance-") as temp:
            pptx = Path(temp) / "inheritance.pptx"
            p = "http://schemas.openxmlformats.org/presentationml/2006/main"
            a = "http://schemas.openxmlformats.org/drawingml/2006/main"
            rel = "http://schemas.openxmlformats.org/package/2006/relationships"
            slide = f'''<p:sld xmlns:p="{p}" xmlns:a="{a}"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="body"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="7"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr/><a:t>Inherited body text</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>'''
            layout = f'''<p:sldLayout xmlns:p="{p}" xmlns:a="{a}"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="3" name="body style"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="7"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle><a:lvl1pPr><a:defRPr sz="2100"><a:latin typeface="Inherited Missing Face"/></a:defRPr></a:lvl1pPr></a:lstStyle><a:p><a:r><a:rPr/><a:t>Template cue</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sldLayout>'''
            unused = f'''<p:sldLayout xmlns:p="{p}" xmlns:a="{a}"><p:cSld><p:spTree><p:sp><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr><a:latin typeface="Unused Layout Face"/></a:rPr><a:t>Unused label</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sldLayout>'''
            rels = f'''<Relationships xmlns="{rel}"><Relationship Id="rLayout" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>'''
            with zipfile.ZipFile(pptx, "w") as archive:
                archive.writestr("ppt/slides/slide1.xml", slide)
                archive.writestr("ppt/slides/_rels/slide1.xml.rels", rels)
                archive.writestr("ppt/slideLayouts/slideLayout1.xml", layout)
                archive.writestr("ppt/slideLayouts/slideLayout2.xml", unused)
            uses, _, _, _ = font_audit._pptx_font_usage(pptx)
            self.assertIn("Inherited Missing Face", uses)
            self.assertNotIn("Unused Layout Face", uses)
            self.assertEqual(uses["Inherited Missing Face"]["runs"][0]["font_size_hundredths_pt"], "2100")

    def test_embedded_font_only_counts_when_rendered_pdf_contains_that_family(self) -> None:
        with tempfile.TemporaryDirectory(prefix="me-font-audit-") as temp:
            root = Path(temp)
            requested_pptx = root / "requested.pptx"
            requested_pdf = root / "rendered.pdf"
            write_fixture(requested_pptx, "等线")
            write_pdf(requested_pdf, "helv")
            result = font_audit.audit(requested_pptx, requested_pdf)
            row = result["fonts"][0]
            self.assertTrue(row["embedded_declared"])
            self.assertTrue(row["embedded_parts"])
            self.assertFalse(row["rendered_pdf_match"])
            self.assertFalse(result["ok"])

    def test_builtin_pdf_face_does_not_prove_embedded_font_was_loaded(self) -> None:
        with tempfile.TemporaryDirectory(prefix="me-font-audit-") as temp:
            root = Path(temp)
            requested_pptx = root / "requested.pptx"
            requested_pdf = root / "rendered.pdf"
            write_fixture(requested_pptx, "Helvetica")
            write_pdf(requested_pdf, "helv")
            with patch.object(font_audit, "fontconfig_match", return_value={
                "resolved_family": "Fallback", "font_file": "/fallback", "available": False,
                "metadata_names": ["Fallback"], "exact_match": False, "error": None,
            }):
                result = font_audit.audit(requested_pptx, requested_pdf)
            self.assertFalse(result["fonts"][0]["rendered_pdf_match"])
            self.assertFalse(result["ok"])

    def test_embedded_pdf_resource_without_matching_text_span_does_not_pass(self) -> None:
        with tempfile.TemporaryDirectory(prefix="me-font-audit-") as temp:
            root = Path(temp)
            requested_pptx = root / "requested.pptx"
            rendered_pdf = root / "rendered.pdf"
            write_fixture(requested_pptx, "Poppins")
            rendered_pdf.write_bytes(b"fixture pdf marker")
            with (
                patch.object(font_audit, "fontconfig_match", return_value={
                    "resolved_family": "Verdana", "font_file": "/fallback", "available": True,
                    "metadata_names": ["Verdana"], "exact_match": False, "error": None,
                }),
                patch.object(font_audit, "_pdf_fonts", return_value={1: {
                    "span_fonts": {"Verdana"},
                    "descriptors": [{"normalized_basefont": "Poppins", "extension": "ttf", "type": "TrueType", "embedded_in_pdf": True, "embedded_bytes": 123}],
                }}),
            ):
                result = font_audit.audit(requested_pptx, rendered_pdf)
            self.assertIn("Poppins", result["fonts"][0]["rendered_pdf_fonts"])
            self.assertNotIn("Poppins", result["fonts"][0]["rendered_pdf_font_slides"])
            self.assertFalse(result["fonts"][0]["rendered_pdf_match"])
            self.assertFalse(result["ok"])

    def test_extractable_matching_pdf_font_confirms_embedded_face(self) -> None:
        with tempfile.TemporaryDirectory(prefix="me-font-audit-") as temp:
            root = Path(temp)
            requested_pptx = root / "requested.pptx"
            rendered_pdf = root / "rendered.pdf"
            write_fixture(requested_pptx, "Helvetica")
            rendered_pdf.write_bytes(b"fixture pdf marker")
            with (
                patch.object(font_audit, "fontconfig_match", return_value={
                    "resolved_family": "Fallback", "font_file": "/fallback", "available": False,
                    "metadata_names": ["Fallback"], "exact_match": False, "error": None,
                }),
                patch.object(font_audit, "_pdf_fonts", return_value={1: {
                    "span_fonts": {"Helvetica"}, "span_text": ["Sample text"],
                    "font_spans": [{"font": "Helvetica", "text": "Sample text"}],
                    "page_text": "Sample text",
                    "descriptors": [{"normalized_basefont": "Helvetica", "extension": "ttf", "type": "TrueType", "embedded_in_pdf": True, "embedded_bytes": 123}],
                }}),
            ):
                result = font_audit.audit(requested_pptx, rendered_pdf)
            self.assertTrue(result["fonts"][0]["rendered_pdf_match"])
            self.assertEqual(result["fonts"][0]["embedded_render_relationship"], "matching_embedded_pdf_font")
            self.assertTrue(result["ok"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
