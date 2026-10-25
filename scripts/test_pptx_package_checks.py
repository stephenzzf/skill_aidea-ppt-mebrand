#!/usr/bin/env python3
"""Behavior tests for package-level PowerPoint compatibility checks."""
from __future__ import annotations

from io import BytesIO
import sys
from pathlib import Path
import unittest
import os
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pptx_package_checks as checks


CT = 'http://schemas.openxmlformats.org/package/2006/content-types'
REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
C = 'http://schemas.openxmlformats.org/drawingml/2006/chart'
A = 'http://schemas.openxmlformats.org/drawingml/2006/main'


def _mini_package(parts: dict[str, bytes | str]) -> zipfile.ZipFile:
    buf = BytesIO()
    package_parts = {
        '[Content_Types].xml': f'''<Types xmlns="{CT}">
          <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
          <Default Extension="xml" ContentType="application/xml"/>
          <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
        </Types>''',
        '_rels/.rels': f'''<Relationships xmlns="{REL}">
          <Relationship Id="rId1" Type="officeDocument" Target="ppt/presentation.xml"/>
        </Relationships>''',
        'ppt/presentation.xml': f'<p:presentation xmlns:p="{P}"/>',
        'ppt/_rels/presentation.xml.rels': f'<Relationships xmlns="{REL}"/>',
    }
    package_parts.update(parts)
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        for name, data in package_parts.items():
            zf.writestr(name, data)
    buf.seek(0)
    return zipfile.ZipFile(buf)


def _error_codes(zf: zipfile.ZipFile) -> set[str]:
    try:
        return {item['code'] for item in checks.check_package(zf)}
    finally:
        zf.close()


def _slide(*ids: int) -> str:
    shapes = ''.join(f'<p:sp><p:nvSpPr><p:cNvPr id="{n}" name="shape-{i}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/></p:sp>' for i, n in enumerate(ids))
    return f'<p:sld xmlns:p="{P}"><p:cSld><p:spTree>{shapes}</p:spTree></p:cSld></p:sld>'


def _slide_with_anchors(cell_anchor: str, body_anchor: str) -> str:
    return f'''<p:sld xmlns:p="{P}" xmlns:a="{A}"><p:cSld><p:spTree>
      <p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="1" name="table"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm/>
        <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
          <a:tbl><a:tr h="1"><a:tc><a:txBody><a:bodyPr anchor="{body_anchor}"/><a:lstStyle/><a:p/></a:txBody><a:tcPr anchor="{cell_anchor}"/></a:tc></a:tr></a:tbl>
        </a:graphicData></a:graphic>
      </p:graphicFrame>
    </p:spTree></p:cSld></p:sld>'''


def _slide_with_text_body(body: str | None) -> str:
    tx_body = f'<p:txBody>{body}</p:txBody>' if body is not None else ''
    return f'''<p:sld xmlns:p="{P}" xmlns:a="{A}"><p:cSld><p:spTree>
      <p:sp><p:nvSpPr><p:cNvPr id="11" name="missing-paragraph"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/>{tx_body}</p:sp>
      <p:sp><p:nvSpPr><p:cNvPr id="12" name="no-text-body"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/></p:sp>
      <p:sp><p:nvSpPr><p:cNvPr id="13" name="valid-paragraph"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr/></a:p></p:txBody></p:sp>
    </p:spTree></p:cSld></p:sld>'''


def _spacing_body(order: tuple[str, ...]) -> str:
    children = []
    for name in order:
        if name == 'lnSpc':
            children.append('<a:lnSpc><a:spcPct val="100000"/></a:lnSpc>')
        elif name in {'spcBef', 'spcAft'}:
            children.append(f'<a:{name}><a:spcPts val="0"/></a:{name}>')
        elif name == 'buNone':
            children.append('<a:buNone/>')
    return f'<p:sp><p:nvSpPr><p:cNvPr id="21" name="spacing"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr>{"".join(children)}</a:pPr><a:r><a:t>Text</a:t></a:r></a:p></p:txBody></p:sp>'


def _slide_with_spacing(order: tuple[str, ...]) -> str:
    return f'<p:sld xmlns:p="{P}" xmlns:a="{A}"><p:cSld><p:spTree>{_spacing_body(order)}</p:spTree></p:cSld></p:sld>'


def _chart(group: str, axes: str) -> str:
    return f'''<c:chartSpace xmlns:c="{C}"><c:chart><c:plotArea>
      <c:{group}><c:axId val="1"/><c:axId val="2"/><c:axId val="3"/></c:{group}>
      {axes}
    </c:plotArea></c:chart></c:chartSpace>'''


def _axes(with_series: bool) -> str:
    axes = [
        '<c:catAx><c:axId val="1"/><c:crossAx val="2"/></c:catAx>',
        '<c:valAx><c:axId val="2"/><c:crossAx val="1"/></c:valAx>',
    ]
    if with_series:
        axes.append('<c:serAx><c:axId val="3"/><c:crossAx val="2"/></c:serAx>')
    return ''.join(axes)


def _embedded_workbook(table_ref: str, autofilter_ref: str | None = None) -> bytes:
    buf = BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        autofilter = f'<autoFilter ref="{autofilter_ref}"/>' if autofilter_ref is not None else ''
        zf.writestr('xl/tables/table1.xml', f'<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ref="{table_ref}">{autofilter}</table>')
    return buf.getvalue()


def _masters_with_theme_targets(notes_target: str, slides_target: str) -> zipfile.ZipFile:
    content_types = f'''<Types xmlns="{CT}">
      <Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="notes-master"/>
      <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="slide-master"/>
      <Override PartName="/ppt/theme/theme1.xml" ContentType="theme"/>
      <Override PartName="/ppt/theme/theme2.xml" ContentType="theme"/>
    </Types>'''
    return _mini_package({
        '[Content_Types].xml': content_types,
        'ppt/notesMasters/notesMaster1.xml': f'<p:notesMaster xmlns:p="{P}"/>',
        'ppt/slideMasters/slideMaster1.xml': f'<p:sldMaster xmlns:p="{P}"/>',
        'ppt/theme/theme1.xml': f'<a:theme xmlns:a="{A}" name="theme1"/>',
        'ppt/theme/theme2.xml': f'<a:theme xmlns:a="{A}" name="theme2"/>',
        'ppt/notesMasters/_rels/notesMaster1.xml.rels': f'''<Relationships xmlns="{REL}">
          <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="{notes_target}"/>
        </Relationships>''',
        'ppt/slideMasters/_rels/slideMaster1.xml.rels': f'''<Relationships xmlns="{REL}">
          <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="{slides_target}"/>
        </Relationships>''',
    })


class PackageCheckTests(unittest.TestCase):
    def test_accepts_valid_package_with_custom_masters(self):
        content_types = f'''<Types xmlns="{CT}">
          <Override PartName="/ppt/presentation.xml" ContentType="presentation"/>
          <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="master"/>
          <Override PartName="/ppt/slideMasters/custom.xml" ContentType="master"/>
        </Types>'''
        zf = _mini_package({
            '[Content_Types].xml': content_types,
            'ppt/slideMasters/slideMaster1.xml': '<p:sldMaster xmlns:p="' + P + '"/>',
            'ppt/slideMasters/custom.xml': '<p:sldMaster xmlns:p="' + P + '"/>',
            'ppt/slides/slide1.xml': _slide(1, 2),
            'ppt/slides/_rels/slide1.xml.rels': f'''<Relationships xmlns="{REL}">
              <Relationship Id="rId1" Type="image" Target="https://example.com/image.png" TargetMode="External"/>
            </Relationships>''',
        })
        self.assertEqual(_error_codes(zf), set())

    def test_accepts_presentation_child_order_with_optional_and_unknown_children(self):
        children = (
            'sldMasterIdLst', 'notesMasterIdLst', 'handoutMasterIdLst', 'sldIdLst',
            'sldSz', 'notesSz', 'defaultTextStyle', 'extLst',
        )
        child_xml = ''.join(f'<p:{name}/>' for name in children)
        child_xml = child_xml.replace('<p:notesMasterIdLst/>', '<x:vendorExtension/><p:notesMasterIdLst/>')
        presentation = f'<p:presentation xmlns:p="{P}" xmlns:x="urn:vendor">{child_xml}</p:presentation>'
        zf = _mini_package({'ppt/presentation.xml': presentation})
        self.assertNotIn('presentation-child-order', _error_codes(zf))

    def test_detects_misordered_presentation_child(self):
        presentation = f'''<p:presentation xmlns:p="{P}">
          <p:sldMasterIdLst/><p:sldIdLst/><p:notesMasterIdLst/><p:sldSz/>
        </p:presentation>'''
        zf = _mini_package({'ppt/presentation.xml': presentation})
        errors = checks.check_package(zf)
        zf.close()
        order_error = next(item for item in errors if item['code'] == 'presentation-child-order')
        self.assertEqual(order_error['part'], 'ppt/presentation.xml')
        self.assertIn('sldIdLst before notesMasterIdLst', order_error['message'])

    def test_detects_invalid_mid_anchor_in_table_and_body_properties(self):
        zf = _mini_package({'ppt/slides/slide7.xml': _slide_with_anchors('mid', 'mid')})
        errors = checks.check_package(zf)
        zf.close()
        invalid = [item for item in errors if item['code'] == 'invalid-text-anchor']
        self.assertEqual(len(invalid), 2)
        self.assertEqual({item['element'] for item in invalid}, {'a:tcPr', 'a:bodyPr'})
        self.assertTrue(all(item['part'] == 'ppt/slides/slide7.xml' and item['slide'] == 7 for item in invalid))

    def test_accepts_center_anchor_ctr_in_table_and_body_properties(self):
        zf = _mini_package({'ppt/slides/slide7.xml': _slide_with_anchors('ctr', 'ctr')})
        self.assertNotIn('invalid-text-anchor', _error_codes(zf))

    def test_accepts_remaining_standard_text_anchor_tokens(self):
        for value in ('t', 'b', 'just', 'dist'):
            with self.subTest(value=value):
                zf = _mini_package({'ppt/slides/slide7.xml': _slide_with_anchors(value, value)})
                self.assertNotIn('invalid-text-anchor', _error_codes(zf))

    def test_detects_text_body_without_direct_paragraph_and_reports_shape(self):
        zf = _mini_package({'ppt/slides/slide9.xml': _slide_with_text_body('<a:bodyPr/><a:lstStyle/>')})
        errors = checks.check_package(zf)
        zf.close()
        findings = [item for item in errors if item['code'] == 'text-body-paragraph-missing']
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0]['part'], 'ppt/slides/slide9.xml')
        self.assertEqual(findings[0]['slide'], 9)
        self.assertEqual(findings[0]['shape_id'], '11')
        self.assertEqual(findings[0]['shape_name'], 'missing-paragraph')

    def test_accepts_shapes_without_text_body_and_text_bodies_with_paragraphs(self):
        zf = _mini_package({'ppt/slides/slide1.xml': _slide_with_text_body(None)})
        self.assertNotIn('text-body-paragraph-missing', _error_codes(zf))

    def test_detects_paragraph_spacing_elements_in_invalid_relative_order(self):
        zf = _mini_package({'ppt/slides/slide11.xml': _slide_with_spacing(('spcBef', 'spcAft', 'lnSpc'))})
        errors = checks.check_package(zf)
        zf.close()
        findings = [item for item in errors if item['code'] == 'paragraph-spacing-order']
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0]['actual_order'], ['spcBef', 'spcAft', 'lnSpc'])
        self.assertEqual(findings[0]['slide'], 11)
        self.assertEqual(findings[0]['shape_id'], '21')

    def test_accepts_spacing_relative_order_and_legal_source_defaults(self):
        for order in (
            ('lnSpc', 'spcBef', 'spcAft'),
            ('lnSpc', 'buNone', 'spcBef', 'spcAft'),
            ('spcAft',),
            (),
        ):
            with self.subTest(order=order):
                zf = _mini_package({'ppt/notesSlides/notesSlide1.xml': _slide_with_spacing(order)})
                self.assertNotIn('paragraph-spacing-order', _error_codes(zf))

    def test_detects_notes_and_slide_masters_sharing_theme(self):
        zf = _masters_with_theme_targets('../theme/theme1.xml', '../theme/theme1.xml')
        errors = checks.check_package(zf)
        zf.close()
        shared = [item for item in errors if item['code'] == 'shared-notes-theme']
        self.assertEqual(len(shared), 1)
        self.assertEqual(shared[0]['target'], 'ppt/theme/theme1.xml')
        self.assertEqual(shared[0]['related_part'], 'ppt/slideMasters/slideMaster1.xml')
        self.assertIn('Mac PowerPoint compatibility risk', shared[0]['message'])

    def test_accepts_notes_and_slide_masters_with_independent_themes(self):
        zf = _masters_with_theme_targets('../theme/theme1.xml', '../theme/theme2.xml')
        self.assertNotIn('shared-notes-theme', _error_codes(zf))

    def test_detects_ghost_content_type_override(self):
        zf = _mini_package({'[Content_Types].xml': f'''<Types xmlns="{CT}">
          <Override PartName="/ppt/slideMasters/slideMaster2.xml" ContentType="master"/>
        </Types>'''})
        self.assertIn('missing-content-type-part', _error_codes(zf))

    def test_detects_relationship_target_and_duplicate_id(self):
        zf = _mini_package({'ppt/slides/_rels/slide1.xml.rels': f'''<Relationships xmlns="{REL}">
          <Relationship Id="rId1" Type="image" Target="../media/missing.png"/>
          <Relationship Id="rId1" Type="chart" Target="../charts/chart1.xml"/>
        </Relationships>'''})
        codes = _error_codes(zf)
        self.assertIn('duplicate-relationship-id', codes)
        self.assertIn('missing-relationship-target', codes)

    def test_detects_duplicate_nonvisual_ids_within_part(self):
        zf = _mini_package({'ppt/slides/slide1.xml': _slide(1, 2, 2)})
        self.assertIn('duplicate-nonvisual-id', _error_codes(zf))

    def test_detects_orphan_axis_but_accepts_defined_3d_axis(self):
        two_d = _chart('barChart', _axes(with_series=False))
        zf = _mini_package({'ppt/charts/chart1.xml': two_d})
        self.assertIn('chart-axis-reference-missing', _error_codes(zf))
        valid_3d = _chart('bar3DChart', _axes(with_series=True))
        zf = _mini_package({'ppt/charts/chart1.xml': valid_3d})
        self.assertNotIn('chart-axis-reference-missing', _error_codes(zf))

    def test_axis_ids_are_scoped_to_each_chart_part(self):
        valid = _chart('barChart', _axes(with_series=False))
        zf = _mini_package({
            'ppt/charts/chart1.xml': valid.replace('<c:axId val="3"/>', ''),
            'ppt/charts/chart2.xml': valid.replace('<c:axId val="3"/>', ''),
        })
        codes = _error_codes(zf)
        self.assertNotIn('duplicate-chart-axis-id', codes)
        self.assertNotIn('chart-axis-reference-missing', codes)

    def test_accepts_secondary_axes_and_does_not_force_axes_on_pie(self):
        secondary = _chart('barChart', '''
          <c:lineChart><c:axId val="3"/><c:axId val="4"/></c:lineChart>
          <c:catAx><c:axId val="1"/><c:crossAx val="2"/></c:catAx>
          <c:valAx><c:axId val="2"/><c:crossAx val="1"/></c:valAx>
          <c:catAx><c:axId val="3"/><c:crossAx val="4"/></c:catAx>
          <c:valAx><c:axId val="4"/><c:crossAx val="3"/></c:valAx>''')
        zf = _mini_package({'ppt/charts/chart1.xml': secondary})
        self.assertNotIn('chart-axis-reference-missing', _error_codes(zf))
        pie = f'<c:chartSpace xmlns:c="{C}"><c:chart><c:plotArea><c:pieChart/></c:plotArea></c:chart></c:chartSpace>'
        zf = _mini_package({'ppt/charts/chart1.xml': pie})
        self.assertNotIn('chart-axis-reference-missing', _error_codes(zf))

    def test_detects_bad_embedded_table_range(self):
        zf = _mini_package({'ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx': _embedded_workbook("A1:B3'")})
        self.assertIn('embedded-table-range-invalid', _error_codes(zf))

    def test_detects_bad_embedded_table_autofilter_range(self):
        zf = _mini_package({'ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx': _embedded_workbook('A1:B3', "A1:B3'")})
        self.assertIn('embedded-autofilter-range-invalid', _error_codes(zf))

    def test_accepts_valid_embedded_table_range(self):
        zf = _mini_package({'ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx': _embedded_workbook('$A$1:$B$3')})
        self.assertEqual(_error_codes(zf), set())

    def test_original_repair_case_exposes_multiple_independent_defects(self):
        fixture = os.environ.get('AIDEA_PPT_COMPAT_FIXTURE')
        if not fixture:
            self.skipTest('Optional private repair fixture is not configured (AIDEA_PPT_COMPAT_FIXTURE).')
        candidate = Path(fixture)
        if not candidate.is_file():
            self.skipTest('PowerPoint repair-case artifact is not present in this environment.')
        with zipfile.ZipFile(candidate) as zf:
            codes = {item['code'] for item in checks.check_package(zf)}
        self.assertIn('missing-content-type-part', codes)
        self.assertIn('chart-axis-reference-missing', codes)
        self.assertIn('duplicate-nonvisual-id', codes)
        self.assertIn('embedded-table-range-invalid', codes)


if __name__ == '__main__':
    unittest.main(verbosity=2)
