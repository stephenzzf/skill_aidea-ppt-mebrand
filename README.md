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

Recommended prompt pattern:

```text
Use aidea-sop-ppt-mebrand to generate an editable ME2026 PPT from the following content.
First confirm audience, source boundary, slide outline, and non-fabrication limits.
After I confirm, generate the PPTX, run ME2026 QA, and provide the preview + QA ledger.
```

The default workflow is `Intake -> Content Gate -> Generate -> QA -> Preview -> Deliver`.

For an existing image-heavy PPTX, use `targeted-fix / rebuild path` to convert screenshot-like pages into editable text, shapes, tables, and diagrams while retaining only necessary local image assets such as logos, certification badges, platform marks, case photos, or product photos.

For ME-branded output, use the unified `me2026-template`. This path uses extracted Cover / Index / Thank You / Logo / footer assets from the user-provided PPTX, combines them with restrained business-page layout rules and high-end technical consulting page rhythm, and keeps titles, directory items, diagrams, tables, prices, and page numbers editable. It does not use AI-generated image assets.

For ME2026 closing pages, use `addME2026ThankYou()` by default. It is based on the source PPTX final Contact Us / Thank You page, not a reused cover slide. The right-side personal contact QR is intentionally omitted from the public template and replaced with editable placeholder text `黏贴个人联系方式`.

ME2026 helper scripts include a public-safe icon registry based on Lucide. Use registry keys such as `comparison`, `strategy`, `diligence`, `growth`, `media`, `automation`, `conversion`, `retention`, `crm`, and `api` to quickly add small icons that match the ME2026 color system.

ME2026 also includes a white-background consulting layout extension derived from the provided Deloitte `.potx` white pages only. Use `addME2026ConsultingTimeline()`, `addME2026ConsultingIconGrid()`, and `addME2026ConsultingProcessRows()` for sparse timeline, icon grid, and process-row pages. The extracted icon assets are normalized to ME2026 colors; Deloitte dark pages, logos, footer/copyright text, and green/yellow/black palette are not used.

For dense PRD or solution decks, ME2026 layout checks enforce table-to-module spacing and parent-card text containment. Use `ME2026_LAYOUT` spacing constants or the ME2026 helpers instead of hand-tuned tight coordinates.

## Validate

Run all checks:

```bash
npm test
```

Generate one built-in scenario and run the unified QA wrapper:

```bash
npm run generate -- --scenario eclick --out /tmp/feishu-vs-eclick-me2026-test.pptx
npm run qa -- --pptx /tmp/feishu-vs-eclick-me2026-test.pptx --slides 8 --allow-fullslide 1,2,8
```

Useful scenarios:

- `smoke`
- `realistic`
- `teemo`
- `eclick`
- `ai-capability`
- `video-localization`
- `deloitte-white`
- `component-catalog`
- `icon-catalog`

Sync this repository copy to the installed Codex skill:

```bash
npm run sync:installed
npm run check:installed
```

## Public Version Limits

- No private PPT templates or thumbnails are bundled.
- No customer logos, private screenshots, or generated business decks are included.
- The skill provides reusable brand and layout guidance; project-specific proof, metrics, and assets must be supplied by the user.
- `assets/me-2026-app/` contains brand assets extracted from the user-provided ME2026 PPTX for the requested Openclaw/GitHub distribution path. Confirm authorization before redistributing this skill outside that approved context.
- `assets/me-2026-app/deloitte-white-icons/` contains white-page consulting icon geometry extracted from the user-provided Deloitte `.potx` and recolored to ME2026. Confirm third-party redistribution authorization before publishing this asset subset.

## License

No open-source license has been added yet. Treat this repository as shared usage only unless a license is added by the owner.
