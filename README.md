# Aidea SOP PPT ME Brand Skill

Codex skill for generating, repairing, and rebuilding editable 16:9 PPTX decks in the Aidea SOP / ME / Meet Experience / 觅跃科技 / 飞书深诺 brand system.

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

For the ME 2026 APP / WhatsApp industry template, use `me2026-app-template`. This path uses extracted Cover / Index / Thank You / Logo / footer assets from the user-provided PPTX and keeps titles, directory items, diagrams, tables, prices, and page numbers editable. It does not use AI-generated image assets.

For ME 2026 closing pages, use `addME2026ThankYou()` by default. It is based on the source PPTX final Contact Us / Thank You page, not a reused cover slide.

ME 2026 helper scripts include a public-safe icon registry based on Lucide. Use registry keys such as `comparison`, `strategy`, `diligence`, `growth`, `media`, `automation`, `conversion`, `retention`, `crm`, and `api` to quickly add small icons that match the ME2026 color system.

## Validate

Run a smoke deck:

```bash
node scripts/smoke_generate_deck.cjs --out /tmp/aidea-sop-ppt-mebrand-smoke.pptx
python3 scripts/inspect_pptx.py /tmp/aidea-sop-ppt-mebrand-smoke.pptx \
  --expected-slides 3 \
  --required-text "觅跃科技" \
  --required-text "飞书深诺" \
  --check-no-fullslide-images \
  --print-style-summary
```

Generate the ME 2026 icon catalog:

```bash
node scripts/generate_me2026_icon_catalog.cjs \
  --out /tmp/me2026-icon-catalog.pptx
```

Run the ME 2026 APP template smoke deck:

```bash
node scripts/smoke_generate_deck.cjs \
  --scenario me2026-app \
  --out /tmp/aidea-sop-ppt-mebrand-me2026-app-smoke.pptx
python3 scripts/inspect_pptx.py /tmp/aidea-sop-ppt-mebrand-me2026-app-smoke.pptx \
  --expected-slides 4 \
  --check-no-fullslide-images \
  --allow-fullslide-image-slides 1,2 \
  --check-header-safe-zone \
  --header-safe-y-in 1.55 \
  --check-integer-font-sizes \
  --min-font-size 8 \
  --check-me2026-footer-logo-alignment \
  --check-icon-card-alignment \
  --print-style-summary
```

Run the realistic ME 2026 APP simulation:

```bash
node scripts/realistic_me2026_app_test.cjs \
  --out /tmp/aidea-sop-ppt-mebrand-realistic-me2026-app.pptx
python3 scripts/inspect_pptx.py /tmp/aidea-sop-ppt-mebrand-realistic-me2026-app.pptx \
  --expected-slides 8 \
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

Run the ME 2026 comparison-analysis simulation:

```bash
node scripts/feishu_vs_teemo_me2026_test.cjs \
  --out /tmp/feishu-vs-teemo-me2026-test.pptx
python3 scripts/inspect_pptx.py /tmp/feishu-vs-teemo-me2026-test.pptx \
  --expected-slides 8 \
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

Run the ME 2026 Feishu Shenno vs Eclicktech comparison simulation:

```bash
node scripts/feishu_vs_eclick_me2026_test.cjs \
  --out /tmp/feishu-vs-eclick-me2026-test.pptx
python3 scripts/inspect_pptx.py /tmp/feishu-vs-eclick-me2026-test.pptx \
  --expected-slides 8 \
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

## Public Version Limits

- No private PPT templates or thumbnails are bundled.
- No customer logos, private screenshots, or generated business decks are included.
- The skill provides reusable brand and layout guidance; project-specific proof, metrics, and assets must be supplied by the user.
- `assets/me-2026-app/` contains brand assets extracted from the user-provided ME 2026 APP PPTX for the requested Openclaw/GitHub distribution path. Confirm authorization before redistributing this skill outside that approved context.

## License

No open-source license has been added yet. Treat this repository as shared usage only unless a license is added by the owner.
