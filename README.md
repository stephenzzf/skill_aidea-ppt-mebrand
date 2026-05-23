# Aidea SOP PPT ME Brand Skill

AgentSkills-compatible skill for generating, repairing, and rebuilding editable 16:9 PPTX decks in the Aidea SOP / ME / Meet Experience / 觅跃科技 / 飞书深诺 brand system.

This public-safe version includes reusable brand rules, layout patterns, PPTX helper scripts, and QA checks. It does not include private reference decks, customer assets, internal screenshots, or generated business PPTX outputs.

## Install

This repository is a standard skill folder: the repository root contains `SKILL.md`, `references/`, `scripts/`, and optional agent metadata.

### Codex

```bash
mkdir -p ~/.codex/skills
git clone https://github.com/stephenzzf/skill_aidea-ppt-mebrand.git \
  ~/.codex/skills/aidea-sop-ppt-mebrand
cd ~/.codex/skills/aidea-sop-ppt-mebrand
npm install
npm test
```

Restart Codex after installation.

### Claude Code

```bash
mkdir -p ~/.claude/skills
git clone https://github.com/stephenzzf/skill_aidea-ppt-mebrand.git \
  ~/.claude/skills/aidea-sop-ppt-mebrand
cd ~/.claude/skills/aidea-sop-ppt-mebrand
npm install
npm test
```

Claude Code should resolve bundled files through `${CLAUDE_SKILL_DIR}` when the skill is active.

### OpenClaw

```bash
openclaw skills install git:stephenzzf/skill_aidea-ppt-mebrand@main \
  --as aidea-sop-ppt-mebrand
```

Then install Node dependencies in the installed skill directory and restart or refresh the agent session so OpenClaw rebuilds its skill snapshot. OpenClaw installations should resolve bundled files through `{baseDir}`.

### Generic AgentSkills Runner

Clone this repository into any supported skill root, then run:

```bash
cd /path/to/aidea-sop-ppt-mebrand
npm install
npm test
```

## Runtime Requirements

- Node.js 18+
- Python 3
- Node packages pinned in `package-lock.json`: `pptxgenjs`, `lucide`, `sharp`

If dependencies are installed outside the skill directory, expose them with one of:

```bash
export AIDEA_PPT_NODE_MODULES=/path/to/node_modules
export NODE_PATH=/path/to/node_modules
export CODEX_NODE_MODULES=/path/to/node_modules
```

## Usage

Example prompt:

```text
Use aidea-sop-ppt-mebrand to generate an editable 16:9 ME brand PPT from the following outline.
Keep text editable, use brand footers, Lucide icons, and run the PPTX QA checks.
```

For an existing image-heavy PPTX, use `targeted-fix / rebuild path` to convert screenshot-like pages into editable text, shapes, tables, and diagrams while retaining only necessary local image assets such as logos, certification badges, platform marks, case photos, or product photos.

## Validate

```bash
npm run check
npm run smoke
npm run inspect:smoke
npm test
```

`npm test` generates smoke and forward-test PPTX files under `/tmp`, then validates them with `scripts/inspect_pptx.py`.

## Public Version Limits

- No private PPT templates or thumbnails are bundled.
- No customer logos, private screenshots, or generated business decks are included.
- The skill provides reusable brand and layout guidance; project-specific proof, metrics, and assets must be supplied by the user.

## License

No open-source license has been added yet. Treat this repository as shared usage only unless a license is added by the owner.
