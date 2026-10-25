#!/usr/bin/env python3
"""Focused, executable OOXML regressions for object geometry and contrast checks."""
from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
INSPECT = ROOT / "scripts" / "inspect_pptx.py"
LAYOUT = ROOT / "scripts" / "check_me2026_layout_risks.py"
WIDTH, HEIGHT = 12191695, 6858000


def off_ext(x: int, y: int, w: int, h: int, name: str = "xfrm") -> str:
    return f'<a:{name}><a:off x="{x}" y="{y}"/><a:ext cx="{w}" cy="{h}"/></a:{name}>'


def shape(x: int, y: int, w: int, h: int, text: str = "") -> str:
    body = f'<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="1400"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr><a:t>{text}</a:t></a:r></a:p></p:txBody>' if text else '<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody>'
    return (
        '<p:sp><p:nvSpPr><p:cNvPr id="2" name="shape"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>'
        f'<p:spPr>{off_ext(x,y,w,h)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
        '<a:noFill/></p:spPr>' + body + '</p:sp>'
    )


def picture(x: int, y: int, w: int, h: int, object_id: int = 3) -> str:
    return (
        f'<p:pic><p:nvPicPr><p:cNvPr id="{object_id}" name="picture"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>'
        f'<p:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>'
        f'<p:spPr>{off_ext(x,y,w,h)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>'
    )


def graphic_frame(x: int, y: int, w: int, h: int, graphic: str, object_id: int = 4) -> str:
    data = '<a:tbl><a:tblPr/><a:tblGrid/><a:tr h="100"><a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="1200"/><a:t>Cell</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc></a:tr></a:tbl>' if graphic == 'table' else '<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"/>'
    return (
        f'<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="{object_id}" name="frame"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>'
        f'<p:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{w}" cy="{h}"/></p:xfrm><a:graphic><a:graphicData uri="{graphic}">{data}</a:graphicData></a:graphic></p:graphicFrame>'
    )


def group(x: int, y: int, w: int, h: int, child_x: int, child_y: int, child_w: int, child_h: int, children: str, object_id: int) -> str:
    return (
        f'<p:grpSp><p:nvGrpSpPr><p:cNvPr id="{object_id}" name="group"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
        f'<p:grpSpPr><a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{w}" cy="{h}"/>'
        f'<a:chOff x="{child_x}" y="{child_y}"/><a:chExt cx="{child_w}" cy="{child_h}"/></a:xfrm></p:grpSpPr>{children}</p:grpSp>'
    )


def slide_xml(objects: str) -> str:
    return (
        '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
        f'<p:grpSpPr><a:xfrm>{off_ext(0,0,WIDTH,HEIGHT)}<a:chOff x="0" y="0"/><a:chExt cx="{WIDTH}" cy="{HEIGHT}"/></a:xfrm></p:grpSpPr>'
        + objects + '</p:spTree></p:cSld></p:sld>'
    )


def make_pptx(path: Path, objects: str, background: str = '') -> Path:
    presentation = (
        '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
        f'<p:sldSz cx="{WIDTH}" cy="{HEIGHT}"/></p:presentation>'
    )
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('ppt/presentation.xml', presentation)
        archive.writestr('ppt/slides/slide1.xml', slide_xml(background + objects))
    return path


def run_json(script: Path, pptx: Path, report: Path, *args: str) -> tuple[subprocess.CompletedProcess[str], dict]:
    proc = subprocess.run(
        [sys.executable, str(script), str(pptx), *args, '--json-report', str(report)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    return proc, json.loads(report.read_text(encoding='utf-8'))


class PptxGeometryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix='me2026-pptx-check-')
        self.root = Path(self.temp.name)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def test_nested_group_coordinate_transforms_compose(self) -> None:
        from xml.etree import ElementTree as ET
        sys.path.insert(0, str(ROOT / 'scripts'))
        from pptx_geometry import collect_visual_objects

        leaf = shape(20, 20, 20, 20, 'Nested')
        inner = group(50, 40, 100, 80, 0, 0, 200, 160, leaf, 3)
        outer = group(1000, 1000, 400, 200, 0, 0, 400, 200, inner, 2)
        objects = collect_visual_objects(ET.fromstring(slide_xml(outer)))
        nested_shape = next(obj for obj in objects if obj.kind == 'shape')
        self.assertEqual(nested_shape.box, (1060, 1050, 10, 10))
        self.assertEqual(nested_shape.depth, 2)
        self.assertIsNone(nested_shape.unresolved_reason)

    def test_native_table_and_chart_frames_outside_canvas_fail_inspection(self) -> None:
        for kind in ('table', 'chart'):
            with self.subTest(graphic=kind):
                pptx = make_pptx(self.root / f'off-canvas-{kind}.pptx', graphic_frame(WIDTH + 100, 100, 800000, 500000, kind))
                proc, report = run_json(INSPECT, pptx, self.root / f'{kind}.json', '--expected-slides', '1')
                self.assertEqual(proc.returncode, 1, proc.stdout + proc.stderr)
                self.assertEqual(report['schema_version'], 1)
                self.assertEqual(len(report['slides'][0]['out_of_bounds']), 1)
                self.assertEqual(report['slides'][0]['out_of_bounds'][0]['graphic_kind'], kind)
                self.assertTrue(any(error['code'] == 'out-of-bounds' and error['slide'] == 1 for error in report['errors']))

    def test_two_half_page_images_fail_editable_body_inspection(self) -> None:
        objects = picture(0, 0, WIDTH // 2, HEIGHT, 3) + picture(WIDTH // 2, 0, WIDTH - WIDTH // 2, HEIGHT, 4)
        pptx = make_pptx(self.root / 'tiled-raster-body.pptx', objects)
        proc, report = run_json(INSPECT, pptx, self.root / 'tiled-raster.json', '--expected-slides', '1', '--check-no-fullslide-images')
        self.assertEqual(proc.returncode, 1, proc.stdout + proc.stderr)
        self.assertEqual(report['slides'][0]['counts']['body_text_chars'], 0)
        self.assertGreaterEqual(report['slides'][0]['image_union']['coverage_ratio'], 0.999)
        self.assertTrue(any(error['code'] == 'body-image-only' for error in report['errors']))

    def test_small_logo_and_local_photo_are_not_called_fullslide_or_raster_deck(self) -> None:
        objects = picture(300000, 300000, 250000, 250000, 3) + picture(1000000, 1500000, 3500000, 2800000, 4) + shape(6000000, 2000000, 2000000, 400000, 'Editable body text')
        pptx = make_pptx(self.root / 'logo-photo-editable.pptx', objects)
        proc, report = run_json(INSPECT, pptx, self.root / 'logo-photo.json', '--expected-slides', '1', '--check-no-fullslide-images')
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        self.assertEqual(report['slides'][0]['counts']['pictures'], 2)
        self.assertFalse(report['slides'][0]['editability']['body_image_only_suspected'])

    def test_cover_background_remains_allowable(self) -> None:
        pptx = make_pptx(self.root / 'cover-background.pptx', picture(0, 0, WIDTH, HEIGHT, 3))
        proc, report = run_json(INSPECT, pptx, self.root / 'cover.json', '--expected-slides', '1', '--check-no-fullslide-images', '--allow-fullslide-image-slides', '1')
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        self.assertEqual(report['slides'][0]['image_union']['coverage_ratio'], 1.0)

    def test_parent_fill_is_used_for_contrast_and_zero_coverage_stays_unknown(self) -> None:
        from xml.etree import ElementTree as ET
        # Filled black parent before white editable text; the child must inherit that explicit background.
        parent = (
            '<p:sp><p:nvSpPr><p:cNvPr id="2" name="background"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>'
            f'<p:spPr>{off_ext(1000000,1000000,4000000,1500000)}<a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>'
            '<a:solidFill><a:srgbClr val="000000"/></a:solidFill></p:spPr>'
            '<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>'
        )
        text = shape(1200000, 1200000, 3000000, 300000, 'Clear')
        pptx = make_pptx(self.root / 'parent-contrast.pptx', text, parent)
        proc, report = run_json(LAYOUT, pptx, self.root / 'parent-contrast.json')
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        contrast = report['slides'][0]['contrast']
        self.assertGreaterEqual(contrast['checked'], 1)
        self.assertEqual(contrast['coverage_ratio'], 1.0)
        self.assertEqual(contrast['low_contrast'], 0)

        # The textbox extends 0.1in past its blue filled parent. The rendered
        # glyphs may still sit inside the blue cell, but geometry alone cannot
        # prove their entire background; do not compare against the white page.
        blue_parent = parent.replace('val="000000"', 'val="1161F7"')
        edge_text = shape(1200000, 1200000, 3894400, 300000, 'Centered')
        edge_pptx = make_pptx(self.root / 'partial-parent.pptx', edge_text, blue_parent)
        edge_proc, edge_report = run_json(LAYOUT, edge_pptx, self.root / 'partial-parent.json')
        # The geometric containment rule independently reports the overflow;
        # contrast itself must stay unknown rather than inventing white fill.
        self.assertEqual(edge_proc.returncode, 1, edge_proc.stdout + edge_proc.stderr)
        edge_contrast = edge_report['slides'][0]['contrast']
        self.assertEqual(edge_contrast['checked'], 0)
        self.assertEqual(edge_contrast['eligible'], 1)
        self.assertEqual(edge_contrast['coverage_ratio'], 0.0)
        self.assertTrue(any(
            'partially overlaps a filled shape' in reason
            for reason in edge_contrast['unknown_reasons']
        ))
        self.assertEqual(edge_contrast['low_contrast'], 0)

        # With no explicit run or background colors, the result is unknown, not a pass.
        no_color = text.replace('<a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>', '')
        unknown_pptx = make_pptx(self.root / 'unknown-contrast.pptx', no_color)
        unknown_proc, unknown = run_json(LAYOUT, unknown_pptx, self.root / 'unknown-contrast.json')
        self.assertEqual(unknown_proc.returncode, 0, unknown_proc.stdout + unknown_proc.stderr)
        unknown_contrast = unknown['slides'][0]['contrast']
        self.assertEqual(unknown_contrast['checked'], 0)
        self.assertEqual(unknown_contrast['eligible'], 1)
        self.assertEqual(unknown_contrast['coverage_ratio'], 0.0)
        self.assertTrue(any(warning['code'] == 'contrast-no-coverage' for warning in unknown['warnings']))


if __name__ == '__main__':
    unittest.main(verbosity=2)
