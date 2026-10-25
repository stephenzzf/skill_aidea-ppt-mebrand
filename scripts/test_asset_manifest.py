#!/usr/bin/env python3
import importlib.util
import html
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
    from PIL import Image
except ImportError:
    Image = None


SCRIPT = Path(__file__).with_name("asset_manifest.py")
SPEC = importlib.util.spec_from_file_location("asset_manifest", SCRIPT)
ASSETS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ASSETS)
SKILL_DIR = SCRIPT.parent.parent


def minimal_pptx(path: Path, image_bytes: bytes, *, picture_boxes=None, text_objects=None, graphic_frames=None) -> None:
    if picture_boxes is None:
        picture_boxes = [{"x": 1828800, "y": 1828800, "w": 3657600, "h": 2743200, "crop": {"left": 1000, "top": 0, "right": 0, "bottom": 0}}]
    if text_objects is None:
        text_objects = [{"id": 2, "name": "Editable title", "x": 914400, "y": 914400, "w": 4572000, "h": 457200, "text": "Finding title"}]
    if graphic_frames is None:
        graphic_frames = []

    text_xml = []
    for shape in text_objects:
        text_xml.append(f'''<p:sp><p:nvSpPr><p:cNvPr id="{shape["id"]}" name="{html.escape(shape["name"], quote=True)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="{shape["x"]}" y="{shape["y"]}"/><a:ext cx="{shape["w"]}" cy="{shape["h"]}"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr/><a:t>{html.escape(shape["text"])}</a:t></a:r></a:p></p:txBody></p:sp>''')

    picture_xml = []
    rels_xml = []
    for index, picture in enumerate(picture_boxes):
        shape_id = 20 + index
        rel_id = f"rId{2 + index}"
        crop = picture.get("crop", {})
        picture_xml.append(f'''<p:pic><p:nvPicPr><p:cNvPr id="{shape_id}" name="Raster image {index + 1}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="{rel_id}"/><a:srcRect l="{crop.get("left", 0)}" t="{crop.get("top", 0)}" r="{crop.get("right", 0)}" b="{crop.get("bottom", 0)}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="{picture["x"]}" y="{picture["y"]}"/><a:ext cx="{picture["w"]}" cy="{picture["h"]}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>''')
        rels_xml.append(f'<Relationship Id="{rel_id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/hero.png"/>')

    frame_xml = []
    for frame in graphic_frames:
        if frame["type"] == "table":
            uri = "http://schemas.openxmlformats.org/drawingml/2006/table"
            content = "<a:tbl/>"
        elif frame["type"] == "chart":
            uri = "http://schemas.openxmlformats.org/drawingml/2006/chart"
            content = '<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"/>'
        else:
            raise ValueError(f"unsupported graphic frame type: {frame['type']}")
        frame_xml.append(f'''<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="{frame["id"]}" name="{html.escape(frame["name"], quote=True)}"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="{frame["x"]}" y="{frame["y"]}"/><a:ext cx="{frame["w"]}" cy="{frame["h"]}"/></p:xfrm><a:graphic><a:graphicData uri="{uri}">{content}</a:graphicData></a:graphic></p:graphicFrame>''')

    slide = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:cSld><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
{''.join(text_xml)}{''.join(picture_xml)}{''.join(frame_xml)}
</p:spTree></p:cSld></p:sld>'''
    rels = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{''.join(rels_xml)}</Relationships>'''
    presentation = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldIdLst><p:sldId id="256" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/></p:presentation>'''
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as deck:
        deck.writestr("[Content_Types].xml", '''<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>''')
        deck.writestr("ppt/presentation.xml", presentation)
        deck.writestr("ppt/slides/slide1.xml", slide)
        deck.writestr("ppt/slides/_rels/slide1.xml.rels", rels)
        deck.writestr("ppt/media/hero.png", image_bytes)


@unittest.skipIf(Image is None, "Pillow is required for PNG alpha fixtures")
class AssetManifestTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="me2026-asset-manifest-")
        self.root = Path(self.temp.name)
        self.assets_dir = self.root / "assets"
        self.assets_dir.mkdir()
        self.pptx = self.root / "fixture.pptx"
        self.manifest_file = self.root / "assets.json"
        self.image = self.assets_dir / "hero.png"
        rgba = Image.new("RGBA", (2, 2), (0, 0, 0, 0))
        rgba.putpixel((0, 0), (255, 255, 255, 255))
        rgba.save(self.image)
        self.image_bytes = self.image.read_bytes()
        minimal_pptx(self.pptx, self.image_bytes)
        digest = ASSETS.local_sha256(self.image)
        self.manifest = {
            "schema_version": 1,
            "assets": [{
                "id": "hero",
                "kind": "illustration",
                "origin": {"type": "generated", "host": "codex", "prompt": "Original abstract illustration"},
                "file": "assets/hero.png",
                "sha256": digest,
                "slide": 1,
                "placement": "illustration",
                "transparency_required": True,
                "placement_box": {"x": 2, "y": 2, "w": 4, "h": 3},
                "crop": {"left": 1000, "top": 0, "right": 0, "bottom": 0},
            }],
            "required_editable": [{"slide": 1, "objects": [{"id": "Editable title", "type": "text", "text": "Finding title"}]}],
        }
        self.write_manifest()

    def tearDown(self):
        self.temp.cleanup()

    def write_manifest(self):
        self.manifest_file.write_text(json.dumps(self.manifest), encoding="utf-8")

    def test_valid_manifest_matches_embedded_media_crop_and_named_text(self):
        report = ASSETS.validate_manifest(str(self.pptx), str(self.manifest_file))
        self.assertEqual(report["status"], "pass", report["errors"])
        self.assertEqual(report["assets"][0]["embedded_slides"], [1])
        self.assertTrue(report["assets"][0]["alpha_transparency"])
        self.assertEqual(report["required_editable"][0]["errors"], [])
        self.assertEqual(len(report["sha256"]), 64)

    def test_missing_manifest_returns_structured_failure_without_traceback(self):
        missing = self.root / "missing-manifest.json"
        report = ASSETS.validate_manifest(str(self.pptx), str(missing))
        self.assertEqual(report["status"], "fail")
        self.assertIsNone(report["sha256"])
        self.assertIn("cannot read asset manifest", report["errors"][0])
        run = subprocess.run([
            sys.executable, str(SCRIPT), "--pptx", str(self.pptx), "--manifest", str(missing),
        ], capture_output=True, text=True, check=False)
        self.assertEqual(run.returncode, 1)
        self.assertEqual(run.stderr, "")
        self.assertEqual(json.loads(run.stdout)["status"], "fail")

    def test_shape_name_overrides_logical_id_and_id_remains_optional(self):
        obj = self.manifest["required_editable"][0]["objects"][0]
        obj["id"] = "body-title-v1"
        obj["shape_name"] = "Editable title"
        self.write_manifest()
        report = ASSETS.validate_manifest(str(self.pptx), str(self.manifest_file))
        self.assertEqual(report["status"], "pass", report["errors"])

        obj.pop("id")
        self.write_manifest()
        report = ASSETS.validate_manifest(str(self.pptx), str(self.manifest_file))
        self.assertEqual(report["status"], "pass", report["errors"])

    def test_shape_name_conflict_is_checked_against_actual_pptx_name(self):
        obj = self.manifest["required_editable"][0]["objects"][0]
        obj["id"] = "not-the-pptx-name"
        obj["shape_name"] = "Editable title"
        self.write_manifest()
        report = ASSETS.validate_manifest(str(self.pptx), str(self.manifest_file))
        self.assertEqual(report["status"], "pass", report["errors"])

        obj["shape_name"] = "Wrong PPTX name"
        self.write_manifest()
        report = ASSETS.validate_manifest(str(self.pptx), str(self.manifest_file))
        self.assertEqual(report["status"], "fail")
        self.assertIn("Wrong PPTX name", "\n".join(report["errors"]))

    def test_changed_local_hash_and_wrong_slide_are_detected(self):
        self.manifest["assets"][0]["sha256"] = "0" * 64
        self.manifest["assets"][0]["slide"] = 2
        self.write_manifest()
        report = ASSETS.validate_manifest(str(self.pptx), str(self.manifest_file))
        joined = "\n".join(report["errors"])
        self.assertIn("file hash is stale", joined)
        self.assertIn("slide must be between 1 and 1", joined)
        self.assertIn("is not embedded in the current PPTX", joined)

    def test_missing_prompt_source_and_stale_crop_are_detected(self):
        self.manifest["assets"][0]["origin"] = {"type": "generated", "host": "unknown"}
        self.manifest["assets"][0]["crop"]["left"] = 5000
        self.write_manifest()
        report = ASSETS.validate_manifest(str(self.pptx), str(self.manifest_file))
        joined = "\n".join(report["errors"])
        self.assertIn("generated origin requires a prompt", joined)
        self.assertIn("crop values do not match", joined)

    def test_unknown_generation_host_is_allowed_when_prompt_is_recorded(self):
        self.manifest["assets"][0]["origin"] = {"type": "generated", "prompt": "Original abstract illustration"}
        self.write_manifest()
        report = ASSETS.validate_manifest(str(self.pptx), str(self.manifest_file))
        self.assertEqual(report["status"], "pass", report["errors"])
        self.assertIn("asset 'hero' host is unknown", report["warnings"])

    def test_white_image_does_not_satisfy_real_alpha_requirement(self):
        opaque = Image.new("RGBA", (2, 2), (255, 255, 255, 255))
        opaque.save(self.image)
        self.manifest["assets"][0]["sha256"] = ASSETS.local_sha256(self.image)
        minimal_pptx(self.pptx, self.image.read_bytes())
        self.write_manifest()
        report = ASSETS.validate_manifest(str(self.pptx), str(self.manifest_file))
        self.assertIn("image pixels have no non-opaque alpha", "\n".join(report["errors"]))

    def test_unused_palette_transparency_entry_does_not_count_as_transparent_pixels(self):
        indexed = Image.new("P", (1, 1), 0)
        indexed.putpalette([0, 0, 0, 255, 255, 255] + [0, 0, 0] * 254)
        indexed.info["transparency"] = bytes([255, 0])
        indexed.save(self.image, format="PNG")
        self.manifest["assets"][0]["sha256"] = ASSETS.local_sha256(self.image)
        minimal_pptx(self.pptx, self.image.read_bytes())
        self.write_manifest()
        report = ASSETS.validate_manifest(str(self.pptx), str(self.manifest_file))
        self.assertIs(report["assets"][0]["alpha_transparency"], False)
        self.assertIn("image pixels have no non-opaque alpha", "\n".join(report["errors"]))

    def test_used_palette_transparency_entry_counts_as_real_transparency(self):
        indexed = Image.new("P", (1, 1), 1)
        indexed.putpalette([0, 0, 0, 255, 255, 255] + [0, 0, 0] * 254)
        indexed.info["transparency"] = bytes([255, 0])
        indexed.save(self.image, format="PNG")
        self.manifest["assets"][0]["sha256"] = ASSETS.local_sha256(self.image)
        minimal_pptx(self.pptx, self.image.read_bytes())
        self.write_manifest()
        report = ASSETS.validate_manifest(str(self.pptx), str(self.manifest_file))
        self.assertEqual(report["status"], "pass", report["errors"])
        self.assertIs(report["assets"][0]["alpha_transparency"], True)

    def test_wrong_editable_shape_name_does_not_pass_with_page_text(self):
        self.manifest["required_editable"][0]["objects"][0]["id"] = "An arbitrary title"
        self.write_manifest()
        report = ASSETS.validate_manifest(str(self.pptx), str(self.manifest_file))
        self.assertIn("no editable text object named", "\n".join(report["errors"]))

    def test_invalid_editability_count_and_transparency_contract_fail(self):
        self.manifest["assets"][0]["transparency_required"] = "false"
        self.manifest["required_editable"][0]["objects"][0]["min_count"] = 0
        self.write_manifest()
        report = ASSETS.validate_manifest(str(self.pptx), str(self.manifest_file))
        joined = "\n".join(report["errors"])
        self.assertIn("transparency_required must be a boolean", joined)
        self.assertIn("min_count must be a positive integer", joined)

    def test_missing_origin_url_and_path_escape_fail(self):
        asset = self.manifest["assets"][0]
        asset["origin"] = {"type": "url"}
        asset["file"] = "../outside.png"
        self.write_manifest()
        report = ASSETS.validate_manifest(str(self.pptx), str(self.manifest_file))
        joined = "\n".join(report["errors"])
        self.assertIn("URL origin requires a url", joined)
        self.assertIn("must stay within the manifest directory", joined)

    def test_qa_entry_binds_manifest_and_keeps_asset_review_unrun(self):
        node = shutil.which("node")
        self.assertIsNotNone(node, "Node.js is required for QA-entry integration")
        ledger = self.root / "qa-ledger.json"
        template = self.root / "review-template.json"
        preview_dir = self.root / "qa-output"
        env = os.environ.copy()
        env["AIDEA_PPT_PYTHON"] = sys.executable
        run = subprocess.run([
            node, str(SKILL_DIR / "scripts" / "qa_me2026.cjs"),
            "--pptx", str(self.pptx), "--slides", "1", "--required-text", "Finding title",
            "--asset-manifest", str(self.manifest_file), "--page-role", "1:section", "--no-preview",
            "--preview-dir", str(preview_dir), "--ledger", str(ledger), "--write-review-template", str(template),
        ], cwd=SKILL_DIR, env=env, capture_output=True, text=True, check=False)
        self.assertTrue(ledger.is_file(), run.stdout + run.stderr)
        report = json.loads(ledger.read_text(encoding="utf-8"))
        receipt = json.loads(template.read_text(encoding="utf-8"))
        self.assertEqual(report["asset_manifest"]["status"], "pass", report["asset_manifest"])
        self.assertEqual(report["page_roles"]["1"], "section")
        self.assertEqual(report["categories"]["editability"]["status"], "pass", report["categories"]["editability"])
        self.assertEqual(receipt["asset_manifest"]["review_status"], "not_run")
        self.assertEqual(receipt["asset_manifest"]["reviewed_asset_ids"], [])
        self.assertEqual(report["categories"]["render"]["status"], "not_run")
        self.assertEqual(run.returncode, 2, "without render and manual review, QA must remain partial")

    def test_qa_rejects_receipt_bound_to_old_manifest(self):
        node = shutil.which("node")
        self.assertIsNotNone(node, "Node.js is required for QA-entry integration")
        artifact_sha = ASSETS.local_sha256(self.pptx)
        evidence = self.root / "review-evidence.txt"
        evidence.write_text("content evidence", encoding="utf-8")
        receipt = {
            "schema_version": 1,
            "profile": "new",
            "review": {"reviewer": "test fixture", "reviewed_at": "2026-10-24T00:00:00Z"},
            "artifact": {"path": str(self.pptx), "sha256": artifact_sha},
            "asset_manifest": {"path": str(self.manifest_file), "sha256": "0" * 64, "review_status": "not_run", "reviewed_asset_ids": []},
            "content": {"status": "pass", "summary": "fixture evidence", "evidence_paths": [{"path": str(evidence), "sha256": ASSETS.local_sha256(evidence)}]},
            "visual": {"status": "not_run", "renderer_signature": "", "pages": []},
        }
        receipt_path = self.root / "stale-review.json"
        receipt_path.write_text(json.dumps(receipt), encoding="utf-8")
        ledger = self.root / "stale-qa-ledger.json"
        env = os.environ.copy()
        env["AIDEA_PPT_PYTHON"] = sys.executable
        run = subprocess.run([
            node, str(SKILL_DIR / "scripts" / "qa_me2026.cjs"),
            "--pptx", str(self.pptx), "--slides", "1", "--required-text", "Finding title",
            "--asset-manifest", str(self.manifest_file), "--page-role", "1:section", "--no-preview",
            "--preview-dir", str(self.root / "stale-output"), "--ledger", str(ledger), "--review-receipt", str(receipt_path),
        ], cwd=SKILL_DIR, env=env, capture_output=True, text=True, check=False)
        report = json.loads(ledger.read_text(encoding="utf-8"))
        self.assertEqual(report["categories"]["content"]["status"], "fail", report["categories"]["content"])
        self.assertTrue(any("asset_manifest.sha256" in error for error in report["review_receipt"]["content_errors"]))
        self.assertNotEqual(run.returncode, 0)

    def run_qa_fixture(self, *, pptx=None, manifest=None, extra_args=None, role="body", required_text="Finding title"):
        node = shutil.which("node")
        self.assertIsNotNone(node, "Node.js is required for QA-entry integration")
        ledger = self.root / f"qa-{len(list(self.root.glob('qa-*.json')))}.json"
        env = os.environ.copy()
        env["AIDEA_PPT_PYTHON"] = sys.executable
        args = [
            node, str(SKILL_DIR / "scripts" / "qa_me2026.cjs"),
            "--pptx", str(pptx or self.pptx), "--slides", "1", "--no-preview",
            "--preview-dir", str(self.root / f"preview-{ledger.stem}"), "--ledger", str(ledger),
            "--profile", "new",
            "--page-role", f"1:{role}",
        ]
        if required_text:
            args.extend(["--required-text", required_text])
        if manifest:
            args.extend(["--asset-manifest", str(manifest)])
        args.extend(extra_args or [])
        run = subprocess.run(args, cwd=SKILL_DIR, env=env, capture_output=True, text=True, check=False)
        self.assertTrue(ledger.is_file(), run.stdout + run.stderr)
        return run, json.loads(ledger.read_text(encoding="utf-8"))

    def test_fullslide_image_with_long_title_fails_body_editability_even_when_allowlisted(self):
        long_title = "A deliberately long editable title that clears the forty character threshold"
        minimal_pptx(self.pptx, self.image_bytes, picture_boxes=[{
            "x": 0, "y": 0, "w": 12192000, "h": 6858000,
        }], text_objects=[{
            "id": 2, "name": "Long title", "x": 914400, "y": 1828800,
            "w": 10000000, "h": 700000, "text": long_title,
        }])
        node = shutil.which("node")
        self.assertIsNotNone(node, "Node.js is required for QA-entry integration")
        ledger = self.root / "long-title-body-ledger.json"
        env = os.environ.copy()
        env["AIDEA_PPT_PYTHON"] = sys.executable
        run = subprocess.run([
            node, str(SKILL_DIR / "scripts" / "qa_me2026.cjs"),
            "--pptx", str(self.pptx), "--slides", "1", "--profile", "rebuild",
            "--source-pptx", str(self.pptx), "--allow-fullslide", "1",
            "--page-role", "1:body", "--no-preview", "--preview-dir", str(self.root / "long-title-preview"),
            "--ledger", str(ledger),
        ], cwd=SKILL_DIR, env=env, capture_output=True, text=True, check=False)
        self.assertTrue(ledger.is_file(), run.stdout + run.stderr)
        report = json.loads(ledger.read_text(encoding="utf-8"))
        inspect = json.loads(Path(report["reports"]["inspect"]).read_text(encoding="utf-8"))
        self.assertEqual(inspect["slides"][0]["counts"]["body_text_chars"], len(long_title))
        self.assertEqual(inspect["slides"][0]["editability"]["substantive_body_text_chars"], 0)
        self.assertTrue(inspect["slides"][0]["editability"]["body_image_only_suspected"])
        self.assertEqual(report["categories"]["structure"]["status"], "pass", report["categories"]["structure"])
        self.assertEqual(report["categories"]["editability"]["status"], "fail", report["categories"]["editability"])
        self.assertTrue(any("without substantive editable body text, table, or chart" in detail for detail in report["categories"]["editability"]["details"]))
        self.assertNotEqual(run.returncode, 0)

    def test_cover_section_and_closing_allow_image_led_pages(self):
        for role in ("cover", "section", "closing"):
            with self.subTest(role=role):
                minimal_pptx(self.pptx, self.image_bytes, picture_boxes=[{
                    "x": 0, "y": 0, "w": 12192000, "h": 6858000,
                }], text_objects=[{
                    "id": 2, "name": "Long title", "x": 914400, "y": 1828800,
                    "w": 10000000, "h": 700000, "text": "Role title",
                }])
                run, report = self.run_qa_fixture(pptx=self.pptx, role=role, required_text="Role title")
                self.assertEqual(report["categories"]["structure"]["status"], "pass", report["categories"]["structure"])
                self.assertEqual(report["categories"]["editability"]["status"], "pass", report["categories"]["editability"])
                self.assertEqual(run.returncode, 2, "render and manual visual review are not part of this fixture")

    def test_two_half_page_images_fail_missing_required_native_body_contract(self):
        half_width = 12192000 // 2
        minimal_pptx(self.pptx, self.image_bytes, picture_boxes=[
            {"x": 0, "y": 0, "w": half_width, "h": 6858000},
            {"x": half_width, "y": 0, "w": half_width, "h": 6858000},
        ], text_objects=[
            {"id": 2, "name": "Editable title", "x": 914400, "y": 914400, "w": 4572000, "h": 457200, "text": "Finding title"},
            {"id": 3, "name": "Editable intro", "x": 914400, "y": 1828800, "w": 10000000, "h": 914400, "text": "The body contains a substantial native introduction, but the detailed process remains embedded in the paired raster images."},
        ])
        digest = ASSETS.local_sha256(self.image)
        self.manifest["assets"] = [{
            "id": "hero", "kind": "background",
            "origin": {"type": "generated", "host": "unknown", "prompt": "Decorative process background"},
            "file": "assets/hero.png", "sha256": digest, "slide": 1, "placement": "background",
            "placement_box": {"x": 0, "y": 0, "w": half_width / ASSETS.EMU, "h": 7.5},
            "crop": {"left": 0, "top": 0, "right": 0, "bottom": 0},
        }]
        self.manifest["required_editable"] = [{"slide": 1, "objects": [{"id": "Editable process steps", "type": "text", "text": "Step 1"}]}]
        self.write_manifest()
        run, report = self.run_qa_fixture(manifest=self.manifest_file, extra_args=["--allow-fullslide", "1"])
        self.assertEqual(report["asset_manifest"]["status"], "fail", report["asset_manifest"])
        self.assertEqual(report["categories"]["editability"]["status"], "fail", report["categories"]["editability"])
        self.assertTrue(any("no editable text object named 'Editable process steps'" in detail for detail in report["categories"]["editability"]["details"]))
        self.assertNotEqual(run.returncode, 0)

    def test_background_with_native_body_table_and_chart_passes_editability(self):
        long_body = "The business workflow remains native and editable, with its evidence, decision criteria, and next action represented in separate document objects."
        minimal_pptx(self.pptx, self.image_bytes, picture_boxes=[{
            "x": 0, "y": 0, "w": 12192000, "h": 6858000,
        }], text_objects=[
            {"id": 2, "name": "Editable title", "x": 914400, "y": 914400, "w": 4572000, "h": 457200, "text": "Finding title"},
            {"id": 3, "name": "Editable body", "x": 914400, "y": 1828800, "w": 10000000, "h": 914400, "text": long_body},
        ], graphic_frames=[
            {"id": 4, "name": "Evidence table", "type": "table", "x": 914400, "y": 3200000, "w": 4572000, "h": 914400},
            {"id": 5, "name": "Trend chart", "type": "chart", "x": 6000000, "y": 3200000, "w": 4572000, "h": 914400},
        ])
        digest = ASSETS.local_sha256(self.image)
        self.manifest["assets"] = [{
            "id": "hero", "kind": "background",
            "origin": {"type": "generated", "host": "unknown", "prompt": "Whitepaper chapter background"},
            "file": "assets/hero.png", "sha256": digest, "slide": 1, "placement": "background",
            "placement_box": {"x": 0, "y": 0, "w": 12192000 / ASSETS.EMU, "h": 7.5},
            "crop": {"left": 0, "top": 0, "right": 0, "bottom": 0},
        }]
        self.manifest["required_editable"] = [{"slide": 1, "objects": [
            {"id": "Editable body", "type": "text", "text": "business workflow remains native"},
            {"id": "Evidence table", "type": "table"},
            {"id": "Trend chart", "type": "chart"},
        ]}]
        self.write_manifest()
        run, report = self.run_qa_fixture(manifest=self.manifest_file, extra_args=["--allow-fullslide", "1"])
        self.assertEqual(report["asset_manifest"]["status"], "pass", report["asset_manifest"])
        self.assertEqual(report["categories"]["editability"]["status"], "pass", report["categories"]["editability"])
        self.assertEqual(report["categories"]["render"]["status"], "not_run")
        self.assertEqual(run.returncode, 2, "without rendering and manual visual review, overall QA must remain partial")


if __name__ == "__main__":
    unittest.main()
