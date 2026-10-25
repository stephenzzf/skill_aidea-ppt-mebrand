#!/usr/bin/env python3
"""Focused semantic-image review and measured icon-contrast contracts."""
from __future__ import annotations

import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile

try:
    from PIL import Image, ImageDraw
except ImportError:
    Image = None
    ImageDraw = None

ROOT = Path(__file__).resolve().parents[1]
ASSET_SCRIPT = ROOT / "scripts" / "asset_manifest.py"
LAYOUT_SCRIPT = ROOT / "scripts" / "check_me2026_layout_risks.py"
QA_SCRIPT = ROOT / "scripts" / "qa_me2026.cjs"
ASSET_SPEC = importlib.util.spec_from_file_location("asset_manifest", ASSET_SCRIPT)
ASSETS = importlib.util.module_from_spec(ASSET_SPEC)
ASSET_SPEC.loader.exec_module(ASSETS)
EMU = 914400
SLIDE_W = 12192000
SLIDE_H = 6858000


def _off_ext(x: int, y: int, w: int, h: int) -> str:
    return f'<a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{w}" cy="{h}"/></a:xfrm>'


def _parent_shape(shape_id: int, name: str, x: int, y: int, w: int, h: int, geom: str, fill: str) -> str:
    return (
        f'<p:sp><p:nvSpPr><p:cNvPr id="{shape_id}" name="{name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>'
        f'<p:spPr>{_off_ext(x, y, w, h)}<a:prstGeom prst="{geom}"><a:avLst/></a:prstGeom>'
        f'<a:solidFill><a:srgbClr val="{fill}"/></a:solidFill></p:spPr>'
        '<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>'
    )


def _picture(shape_id: int, name: str, rel_id: str, x: int, y: int, w: int, h: int) -> str:
    return (
        f'<p:pic><p:nvPicPr><p:cNvPr id="{shape_id}" name="{name}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>'
        f'<p:blipFill><a:blip r:embed="{rel_id}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>'
        f'<p:spPr>{_off_ext(x, y, w, h)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>'
    )


def _slide_xml(objects: str, *, slide_background: str = "") -> str:
    background = f'<p:bg><p:bgPr><a:solidFill><a:srgbClr val="{slide_background}"/></a:solidFill></p:bgPr></p:bg>' if slide_background else ""
    return (
        '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f'<p:cSld>{background}<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
        f'<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{SLIDE_W}" cy="{SLIDE_H}"/>'
        f'<a:chOff x="0" y="0"/><a:chExt cx="{SLIDE_W}" cy="{SLIDE_H}"/></a:xfrm></p:grpSpPr>'
        f'{objects}</p:spTree></p:cSld></p:sld>'
    )


def _make_pptx(path: Path, objects: str, media: dict[str, bytes], relationships: list[tuple[str, str]], *, slide_background: str = "") -> Path:
    rel_xml = "".join(
        f'<Relationship Id="{rel_id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/{media_name}"/>'
        for rel_id, media_name in relationships
    )
    presentation = (
        '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst>'
        f'<p:sldSz cx="{SLIDE_W}" cy="{SLIDE_H}"/></p:presentation>'
    )
    content_types = (
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="png" ContentType="image/png"/>'
        '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>'
        '<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>'
        '</Types>'
    )
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("ppt/presentation.xml", presentation)
        archive.writestr("ppt/slides/slide1.xml", _slide_xml(objects, slide_background=slide_background))
        archive.writestr("ppt/slides/_rels/slide1.xml.rels", f'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{rel_xml}</Relationships>')
        for media_name, payload in media.items():
            archive.writestr(f"ppt/media/{media_name}", payload)
    return path


def _glyph_png(color: str, *, second_color: str | None = None) -> bytes:
    image = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    first = tuple(int(color[index:index + 2], 16) for index in (0, 2, 4)) + (255,)
    draw.line((9, 25, 20, 36, 39, 12), fill=first, width=7)
    if second_color:
        second = tuple(int(second_color[index:index + 2], 16) for index in (0, 2, 4)) + (255,)
        draw.rectangle((6, 6, 17, 16), fill=second)
    from io import BytesIO
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _run_layout(pptx: Path, report_path: Path):
    run = subprocess.run(
        [sys.executable, str(LAYOUT_SCRIPT), str(pptx), "--json-report", str(report_path)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    return run, json.loads(report_path.read_text(encoding="utf-8"))


@unittest.skipIf(Image is None, "Pillow is required to create deterministic PNG glyph fixtures")
class SemanticIconQaTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="me2026-semantic-icon-qa-")
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def test_asset_manifest_validates_semantic_brief_schema_and_keeps_legacy_manifest_valid(self):
        asset_dir = self.root / "assets"
        asset_dir.mkdir()
        image_path = asset_dir / "hero.png"
        image_path.write_bytes(_glyph_png("155EEF"))
        pptx = _make_pptx(
            self.root / "semantic.pptx",
            _picture(2, "Hero image", "rId2", 2 * EMU, 2 * EMU, EMU, EMU),
            {"hero.png": image_path.read_bytes()},
            [("rId2", "hero.png")],
        )
        base_asset = {
            "id": "hero",
            "kind": "illustration",
            "origin": {"type": "user", "source": "test fixture"},
            "file": "assets/hero.png",
            "sha256": ASSETS.local_sha256(image_path),
            "slide": 1,
            "placement": "illustration",
        }
        manifest_path = self.root / "asset-manifest.json"
        valid_brief = {
            "page_claim": "Approved content moves through retrieval and review",
            "subject": "An internal knowledge assistant",
            "action": "Retrieve approved files and draft a cited answer",
            "inputs": "Versioned company documents",
            "outputs": "A cited answer for an employee",
            "required_cues": ["approved source", "retrieval", "cited answer"],
        }

        def validate(asset):
            manifest_path.write_text(json.dumps({"schema_version": 1, "assets": [asset], "required_editable": []}), encoding="utf-8")
            return ASSETS.validate_manifest(str(pptx), str(manifest_path))

        self.assertEqual(validate({**base_asset, "semantic_brief": valid_brief})["status"], "pass")
        legacy = validate(dict(base_asset))
        self.assertEqual(legacy["status"], "pass", legacy["errors"])
        for brief, expected_error in (
            ({**valid_brief, "subject": "  "}, "semantic_brief.subject"),
            ({**valid_brief, "outputs": 4}, "semantic_brief.outputs"),
            ({**valid_brief, "required_cues": []}, "required_cues must be a non-empty array"),
            ({**valid_brief, "required_cues": ["source", "  "]}, "required_cues[1]"),
        ):
            with self.subTest(expected_error=expected_error):
                report = validate({**base_asset, "semantic_brief": brief})
                self.assertEqual(report["status"], "fail")
                self.assertIn(expected_error, "\n".join(report["errors"]))
        wrong_kind = validate({**base_asset, "kind": "background", "placement": "background", "semantic_brief": valid_brief})
        self.assertIn("only supported for kind=illustration", "\n".join(wrong_kind["errors"]))

    def test_review_receipt_requires_hash_bound_human_review_only_for_semantic_assets(self):
        node = shutil.which("node")
        self.assertIsNotNone(node, "Node.js is required for QA receipt contract integration")
        asset_dir = self.root / "assets"
        asset_dir.mkdir()
        image_path = asset_dir / "hero.png"
        image_path.write_bytes(_glyph_png("155EEF"))
        title = (
            '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Fixture title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>'
            f'<p:spPr>{_off_ext(EMU, EMU, 4 * EMU, EMU // 2)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>'
            '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="2400"/><a:t>Fixture title</a:t></a:r></a:p></p:txBody></p:sp>'
        )
        body = (
            '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Fixture body"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>'
            f'<p:spPr>{_off_ext(EMU, 2 * EMU, 8 * EMU, EMU)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>'
            '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="1600"/><a:t>Business information remains editable in this QA fixture.</a:t></a:r></a:p></p:txBody></p:sp>'
        )
        pptx = _make_pptx(self.root / "review.pptx", title + body + _picture(4, "Hero image", "rId2", 7 * EMU, 2 * EMU, EMU, EMU), {"hero.png": image_path.read_bytes()}, [("rId2", "hero.png")])
        semantic_brief = {
            "page_claim": "Approved content moves through retrieval and review",
            "subject": "An internal knowledge assistant",
            "action": "Retrieve approved files and draft a cited answer",
            "inputs": "Versioned company documents",
            "outputs": "A cited answer for an employee",
            "required_cues": ["approved source", "retrieval", "cited answer"],
        }
        manifest_path = self.root / "asset-manifest.json"
        manifest = {
            "schema_version": 1,
            "assets": [{
                "id": "hero",
                "kind": "illustration",
                "origin": {"type": "user", "source": "QA fixture"},
                "file": "assets/hero.png",
                "sha256": ASSETS.local_sha256(image_path),
                "slide": 1,
                "placement": "illustration",
                "semantic_brief": semantic_brief,
            }],
            "required_editable": [],
        }
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        evidence = self.root / "semantic-review.md"
        evidence.write_text("The illustration links approved company documents to a cited employee answer and leaves the page claim readable.", encoding="utf-8")
        evidence_hash = ASSETS.local_sha256(evidence)
        output = self.root / "preview"
        output.mkdir()
        template_path = self.root / "review-template.json"
        first_ledger = self.root / "template-ledger.json"
        env = os.environ.copy()
        env["AIDEA_PPT_PYTHON"] = sys.executable
        env["CODEX_NODE_MODULES"] = env.get("CODEX_NODE_MODULES", "")
        template_run = subprocess.run([
            node, str(QA_SCRIPT), "--pptx", str(pptx), "--slides", "1", "--profile", "new",
            "--required-text", "Fixture title", "--asset-manifest", str(manifest_path), "--no-preview",
            "--page-role", "1:section", "--preview-dir", str(output), "--ledger", str(first_ledger),
            "--write-review-template", str(template_path),
        ], cwd=ROOT, env=env, capture_output=True, text=True, check=False)
        self.assertTrue(template_path.is_file(), template_run.stdout + template_run.stderr)
        template = json.loads(template_path.read_text(encoding="utf-8"))
        self.assertEqual(template["asset_manifest"]["asset_reviews"], [{
            "asset_id": "hero", "relevance": "not_run", "clarity": "not_run", "integration": "not_run", "notes": "", "evidence_paths": [],
        }])

        def run_receipt(name, *, semantic=True, reviews=None):
            if not semantic:
                manifest["assets"][0].pop("semantic_brief", None)
                manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
            else:
                manifest["assets"][0]["semantic_brief"] = semantic_brief
                manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
            manifest_hash = ASSETS.local_sha256(manifest_path)
            receipt = {
                "schema_version": 1,
                "profile": "new",
                "review": {"reviewer": "QA fixture reviewer", "reviewed_at": "2026-10-25T00:00:00Z"},
                "artifact": {"path": str(pptx), "sha256": ASSETS.local_sha256(pptx)},
                "asset_manifest": {
                    "path": str(manifest_path), "sha256": manifest_hash, "review_status": "pass", "reviewed_asset_ids": ["hero"],
                    **({"asset_reviews": reviews} if reviews is not None else {}),
                },
                "content": {"status": "not_run", "summary": "", "evidence_paths": []},
                "visual": {"status": "pass", "renderer_signature": "fixture", "pages": []},
            }
            receipt_path = self.root / f"{name}-receipt.json"
            receipt_path.write_text(json.dumps(receipt), encoding="utf-8")
            ledger_path = self.root / f"{name}-ledger.json"
            preview_dir = self.root / f"{name}-preview"
            preview_dir.mkdir()
            run = subprocess.run([
                node, str(QA_SCRIPT), "--pptx", str(pptx), "--slides", "1", "--profile", "new",
                "--required-text", "Fixture title", "--asset-manifest", str(manifest_path), "--review-receipt", str(receipt_path),
                "--no-preview", "--page-role", "1:section", "--preview-dir", str(preview_dir), "--ledger", str(ledger_path),
            ], cwd=ROOT, env=env, capture_output=True, text=True, check=False)
            self.assertTrue(ledger_path.is_file(), run.stdout + run.stderr)
            return run, json.loads(ledger_path.read_text(encoding="utf-8"))

        missing_run, missing = run_receipt("missing-semantic-review", reviews=[])
        self.assertNotEqual(missing_run.returncode, 0)
        self.assertEqual(missing["review_receipt"]["status"], "fail")
        self.assertTrue(any("missing semantic review" in error for error in missing["review_receipt"]["visual_errors"]))

        failed_reviews = [{
            "asset_id": "hero", "relevance": "fail", "clarity": "pass", "integration": "pass",
            "notes": "The illustration conflicts with the stated page claim and depicts a different workflow.",
            "evidence_paths": [{"path": str(evidence), "sha256": evidence_hash}],
        }]
        failed_run, failed = run_receipt("failed-semantic-review", reviews=failed_reviews)
        self.assertNotEqual(failed_run.returncode, 0)
        self.assertTrue(any("explicit fail decision" in error for error in failed["review_receipt"]["visual_errors"]))

        passing_reviews = [{
            "asset_id": "hero", "relevance": "pass", "clarity": "pass", "integration": "pass",
            "notes": "The asset shows approved documents feeding retrieval and a cited employee answer, matching the page claim.",
            "evidence_paths": [{"path": str(evidence), "sha256": evidence_hash}],
        }]
        passing_run, passing = run_receipt("passing-semantic-review", reviews=passing_reviews)
        self.assertEqual(passing["review_receipt"]["status"], "partial", "the receipt itself is accepted while render evidence remains skipped")
        self.assertFalse(any("asset review" in error or "semantic review" in error for error in passing["review_receipt"]["visual_errors"]))
        self.assertEqual(passing["categories"]["visual"]["status"], "not_run")
        self.assertNotEqual(passing_run.returncode, 0, "no-preview must never complete the visual category")

        legacy_run, legacy = run_receipt("legacy-manifest", semantic=False, reviews=None)
        self.assertFalse(any("asset" in error.lower() for error in legacy["review_receipt"]["visual_errors"]))
        self.assertEqual(legacy["categories"]["visual"]["status"], "not_run")
        self.assertNotEqual(legacy_run.returncode, 0, "no-preview still leaves the visual category incomplete")

    def test_actual_glyph_rgb_and_parent_shape_backgrounds_drive_icon_contrast(self):
        cases = (
            ("low", ["E7E3AA", "9DBAE2"], ["ellipse", "roundRect"], ["F0F5FF", "F0F5FF"], "000000", 2),
            ("high", ["155EEF", "6B16B9"], ["ellipse", "roundRect"], ["F0F5FF", "F6F0FF"], "000000", 0),
        )
        for name, colors, geoms, fills, page_background, expected_low in cases:
            with self.subTest(contrast=name):
                objects = []
                media = {}
                rels = []
                for index, (color, geom, fill) in enumerate(zip(colors, geoms, fills)):
                    x = (index + 1) * 2 * EMU
                    objects.append(_parent_shape(10 + index, f"parent-{index}", x, EMU, EMU, EMU, geom, fill))
                    media_name = f"icon-{index}.png"
                    rel_id = f"rId{index + 1}"
                    media[media_name] = _glyph_png(color)
                    rels.append((rel_id, media_name))
                    objects.append(_picture(20 + index, f"ME2026_ICON:glyph-{index}", rel_id, x + EMU // 4, EMU + EMU // 4, EMU // 2, EMU // 2))

                # A full-frame decorative raster and an unrelated small photo
                # must not inflate the measured icon denominator.
                media["decoration.png"] = _glyph_png("FFFFFF")
                media["photo.png"] = _glyph_png("123456")
                rels.extend([("rId3", "decoration.png"), ("rId4", "photo.png")])
                objects.insert(0, _picture(5, "Decorative background", "rId3", 0, 0, SLIDE_W, SLIDE_H))
                objects.append(_picture(6, "Photo 6", "rId4", 8 * EMU, EMU, EMU // 3, EMU // 3))
                pptx = _make_pptx(self.root / f"{name}-icons.pptx", "".join(objects), media, rels, slide_background=page_background)
                run, report = _run_layout(pptx, self.root / f"{name}-icons.json")
                summary = report["summary"]
                self.assertEqual(summary["icon_contrast_eligible"], 2)
                self.assertEqual(summary["icon_contrast_checked"], 2)
                self.assertEqual(summary["icon_contrast_low_contrast"], expected_low)
                self.assertEqual(summary["icon_contrast_unknown"], 0)
                self.assertEqual(run.returncode, 1 if expected_low else 0, run.stdout + run.stderr)
                self.assertEqual(report["slides"][0]["icon_contrast"]["checked"], 2)

    def test_unknown_background_or_multicolor_glyph_is_unknown_not_a_pass(self):
        media = {"unknown-bg.png": _glyph_png("155EEF"), "multicolor.png": _glyph_png("155EEF", second_color="7B2CBF")}
        rels = [("rId1", "unknown-bg.png"), ("rId2", "multicolor.png")]
        objects = (
            _picture(2, "ME2026_ICON:unknown-bg", "rId1", EMU, EMU, EMU // 2, EMU // 2)
            + _parent_shape(3, "parent", 3 * EMU, EMU, EMU, EMU, "roundRect", "F0F5FF")
            + _picture(4, "ME2026_ICON:multicolor", "rId2", 3 * EMU + EMU // 4, EMU + EMU // 4, EMU // 2, EMU // 2)
        )
        pptx = _make_pptx(self.root / "unknown-icons.pptx", objects, media, rels)
        run, report = _run_layout(pptx, self.root / "unknown-icons.json")
        summary = report["summary"]
        self.assertEqual(summary["icon_contrast_eligible"], 2)
        self.assertEqual(summary["icon_contrast_checked"], 0)
        self.assertEqual(summary["icon_contrast_unknown"], 2)
        self.assertEqual(summary["icon_contrast_low_contrast"], 0)
        self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
        self.assertTrue(any(warning["code"] == "icon-contrast-no-coverage" for warning in report["warnings"]))
        self.assertTrue(any("no explicit slide background" in reason for reason in report["slides"][0]["icon_contrast"]["unknown_reasons"]))
        self.assertTrue(any("multicolor" in reason for reason in report["slides"][0]["icon_contrast"]["unknown_reasons"]))


if __name__ == "__main__":
    unittest.main()
