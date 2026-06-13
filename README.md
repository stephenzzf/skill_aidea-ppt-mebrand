# Aidea SOP PPT ME Brand Skill

Codex skill for generating, repairing, rebuilding, and style-upgrading editable 16:9 PPTX decks in the Aidea SOP / ME / Meet Experience / 觅跃科技 / 飞书深诺 brand system, using the unified ME2026 template.

This public-safe version focuses on reusable brand rules, layout patterns, PPTX helper scripts, and QA checks. It does not include private reference decks, customer assets, internal screenshots, or generated PPTX outputs.

## Install

Download the repository and place it under your Codex skills directory:

```bash
mkdir -p ~/.codex/skills
curl -L https://github.com/stephenzzf/skill_aidea-ppt-mebrand/archive/refs/heads/main.zip -o /tmp/skill_aidea-ppt-mebrand.zip
unzip /tmp/skill_aidea-ppt-mebrand.zip -d /tmp
rm -rf ~/.codex/skills/aidea-sop-ppt-mebrand
mv /tmp/skill_aidea-ppt-mebrand-main ~/.codex/skills/aidea-sop-ppt-mebrand
```

Restart Codex after installation.

## Runtime Requirements

- Node.js
- Python 3
- Node packages: `pptxgenjs`, `lucide`, `sharp`

Install Node dependencies in an environment available to Codex:

```bash
npm install pptxgenjs lucide sharp
```

## Usage

Example prompt:

```text
Use aidea-sop-ppt-mebrand to generate an editable 16:9 ME brand PPT from the following outline.
Keep text editable, use brand footers, Lucide icons, and run the PPTX QA checks.
```

For an existing image-heavy PPTX, use `targeted-fix / rebuild path` to convert screenshot-like pages into editable text, shapes, tables, and diagrams while retaining only necessary local image assets such as logos, certification badges, platform marks, case photos, or product photos.

For ME-branded output, use the unified `me2026-template`. This path uses extracted Cover / Index / Thank You / Logo / footer assets from the user-provided PPTX, combines them with restrained business-page layout rules and high-end technical consulting page rhythm, and keeps titles, directory items, diagrams, tables, prices, and page numbers editable. It does not use AI-generated image assets.

For ME2026 closing pages, use `addME2026ThankYou()` by default. It is based on the source PPTX final Contact Us / Thank You page, not a reused cover slide. The right-side personal contact QR is intentionally omitted from the public template and replaced with editable placeholder text `黏贴个人联系方式`.

ME2026 helper scripts include a public-safe icon registry based on Lucide. Use registry keys such as `comparison`, `strategy`, `diligence`, `growth`, `media`, `automation`, `conversion`, `retention`, `crm`, and `api` to quickly add small icons that match the ME2026 color system.

ME2026 also includes a white-background consulting layout extension derived from the provided Deloitte `.potx` white pages only. Use `addME2026ConsultingTimeline()`, `addME2026ConsultingIconGrid()`, and `addME2026ConsultingProcessRows()` for sparse timeline, icon grid, and process-row pages. The extracted icon assets are normalized to ME2026 colors; Deloitte dark pages, logos, footer/copyright text, and green/yellow/black palette are not used.

For dense PRD or solution decks, ME2026 layout checks enforce table-to-module spacing and parent-card text containment. Use `ME2026_LAYOUT` spacing constants or the ME2026 helpers instead of hand-tuned tight coordinates.

## Validate

Run the ME2026 template smoke deck:

```bash
node scripts/smoke_generate_deck.cjs \
  --scenario me2026 \
  --out /tmp/aidea-sop-ppt-mebrand-me2026-smoke.pptx
python3 scripts/inspect_pptx.py /tmp/aidea-sop-ppt-mebrand-me2026-smoke.pptx \
  --expected-slides 4 \
  --check-no-fullslide-images \
  --allow-fullslide-image-slides 1,2 \
  --check-header-safe-zone \
  --header-safe-y-in 1.55 \
  --check-integer-font-sizes \
  --min-font-size 8 \
  --check-me2026-footer-logo-alignment \
  --check-icon-card-alignment \
  --check-label-text-row-alignment \
  --print-style-summary
python3 scripts/check_me2026_layout_risks.py \
  /tmp/aidea-sop-ppt-mebrand-me2026-smoke.pptx
```

Generate the ME2026 icon catalog:

```bash
node scripts/generate_me2026_icon_catalog.cjs \
  --out /tmp/me2026-icon-catalog.pptx
```

Run the realistic ME2026 simulation:

```bash
node scripts/realistic_me2026_app_test.cjs \
  --out /tmp/aidea-sop-ppt-mebrand-realistic-me2026.pptx
python3 scripts/inspect_pptx.py /tmp/aidea-sop-ppt-mebrand-realistic-me2026.pptx \
  --expected-slides 8 \
  --required-text "黏贴个人联系方式" \
  --check-no-fullslide-images \
  --allow-fullslide-image-slides 1,2,8 \
  --check-header-safe-zone \
  --header-safe-y-in 1.55 \
  --check-integer-font-sizes \
  --min-font-size 8 \
  --check-me2026-footer-logo-alignment \
  --check-icon-card-alignment \
  --print-style-summary
python3 scripts/check_me2026_layout_risks.py \
  /tmp/aidea-sop-ppt-mebrand-realistic-me2026.pptx
```

Run the ME2026 comparison-analysis simulation:

```bash
node scripts/feishu_vs_teemo_me2026_test.cjs \
  --out /tmp/feishu-vs-teemo-me2026-test.pptx
python3 scripts/inspect_pptx.py /tmp/feishu-vs-teemo-me2026-test.pptx \
  --expected-slides 8 \
  --required-text "黏贴个人联系方式" \
  --check-no-fullslide-images \
  --allow-fullslide-image-slides 1,2,8 \
  --check-header-safe-zone \
  --header-safe-y-in 1.55 \
  --check-integer-font-sizes \
  --min-font-size 8 \
  --check-me2026-footer-logo-alignment \
  --check-icon-card-alignment \
  --print-style-summary
```

Run the ME2026 Feishu Shenno vs Eclicktech comparison simulation:

```bash
node scripts/feishu_vs_eclick_me2026_test.cjs \
  --out /tmp/feishu-vs-eclick-me2026-test.pptx
python3 scripts/inspect_pptx.py /tmp/feishu-vs-eclick-me2026-test.pptx \
  --expected-slides 8 \
  --required-text "黏贴个人联系方式" \
  --check-no-fullslide-images \
  --allow-fullslide-image-slides 1,2,8 \
  --check-header-safe-zone \
  --header-safe-y-in 1.55 \
  --check-integer-font-sizes \
  --min-font-size 8 \
  --check-me2026-footer-logo-alignment \
  --check-icon-card-alignment \
  --print-style-summary
```

Run the ME2026 white consulting layout simulation:

```bash
node scripts/deloitte_white_me2026_test.cjs \
  --out /tmp/me2026-deloitte-white-style-test.pptx
python3 scripts/inspect_pptx.py /tmp/me2026-deloitte-white-style-test.pptx \
  --expected-slides 6 \
  --required-text "黏贴个人联系方式" \
  --check-no-fullslide-images \
  --allow-fullslide-image-slides 1,2,6 \
  --check-header-safe-zone \
  --header-safe-y-in 1.55 \
  --check-integer-font-sizes \
  --min-font-size 8 \
  --check-me2026-footer-logo-alignment \
  --check-icon-card-alignment \
  --check-label-text-row-alignment \
  --print-style-summary
```

Run the ME2026 video localization PRD simulation:

```bash
node scripts/video_localization_engine_me2026_test.cjs \
  --out /tmp/video-localization-engine-me2026-test.pptx
python3 scripts/inspect_pptx.py /tmp/video-localization-engine-me2026-test.pptx \
  --expected-slides 16 \
  --required-text "黏贴个人联系方式" \
  --check-no-fullslide-images \
  --allow-fullslide-image-slides 1,2,16 \
  --check-header-safe-zone \
  --header-safe-y-in 1.55 \
  --check-integer-font-sizes \
  --min-font-size 8 \
  --check-me2026-footer-logo-alignment \
  --check-icon-card-alignment \
  --check-label-text-row-alignment \
  --print-style-summary
python3 scripts/check_me2026_layout_risks.py \
  /tmp/video-localization-engine-me2026-test.pptx
```

## Public Version Limits

- No private PPT templates or thumbnails are bundled.
- No customer logos, private screenshots, or generated business decks are included.
- The skill provides reusable brand and layout guidance; project-specific proof, metrics, and assets must be supplied by the user.
- `assets/me-2026-app/` contains brand assets extracted from the user-provided ME2026 PPTX for the requested Openclaw/GitHub distribution path. Confirm authorization before redistributing this skill outside that approved context.
- `assets/me-2026-app/deloitte-white-icons/` contains white-page consulting icon geometry extracted from the user-provided Deloitte `.potx` and recolored to ME2026. Confirm third-party redistribution authorization before publishing this asset subset.

## License

No open-source license has been added yet. Treat this repository as shared usage only unless a license is added by the owner.
