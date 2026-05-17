# Aidea SOP PPT ME Brand Skill

Codex skill for generating editable 16:9 PPTX decks in the Aidea SOP / ME / Meet Experience / 觅跃科技 / 飞书深诺 brand system.

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

## Public Version Limits

- No private PPT templates or thumbnails are bundled.
- No customer logos, private screenshots, or generated business decks are included.
- The skill provides reusable brand and layout guidance; project-specific proof, metrics, and assets must be supplied by the user.

## License

No open-source license has been added yet. Treat this repository as shared usage only unless a license is added by the owner.
