#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");
const { spawnSync } = require("child_process");
const { renderPptx } = require("./qa_render.cjs");

const SKILL_DIR = path.resolve(__dirname, "..");
const INSPECT_SCRIPT = path.join(SKILL_DIR, "scripts", "inspect_pptx.py");
const LAYOUT_SCRIPT = path.join(SKILL_DIR, "scripts", "check_me2026_layout_risks.py");
const TRANSLATION_CHECK_SCRIPT = path.join(SKILL_DIR, "scripts", "translation_checks.py");
const ASSET_MANIFEST_SCRIPT = path.join(SKILL_DIR, "scripts", "asset_manifest.py");

function readArg(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith("--")
    ? process.argv[idx + 1]
    : fallback;
}

function readArgs(name) {
  const values = [];
  for (let i = 2; i < process.argv.length; i += 1) {
    if (process.argv[i] === name && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) {
      values.push(process.argv[i + 1]);
      i += 1;
    }
  }
  return values;
}

function hasArg(name) {
  return process.argv.includes(name);
}

function sha256(file) {
  const hash = crypto.createHash("sha256");
  const fd = fs.openSync(file, "r");
  try {
    const buffer = Buffer.alloc(1024 * 1024);
    let read;
    while ((read = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, read));
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest("hex");
}

function runStep(label, command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || SKILL_DIR,
    encoding: "utf8",
    env: options.env || process.env,
    timeout: options.timeout || 5 * 60 * 1000,
    maxBuffer: 16 * 1024 * 1024,
  });
  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  if (!options.quiet) {
    if (stdout.trim()) process.stdout.write(stdout);
    if (stderr.trim()) process.stderr.write(stderr);
  }
  return {
    label,
    command: [command, ...args].join(" "),
    status: result.status,
    ok: !result.error && result.status === 0,
    error: result.error ? result.error.message : result.signal ? `terminated by ${result.signal}` : null,
    stdout,
    stderr,
  };
}

function ensureExistingFile(file, name) {
  if (!file) throw new Error(`${name} path is required`);
  const resolved = path.resolve(file);
  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch {
    throw new Error(`${name} does not exist: ${resolved}`);
  }
  if (!stat.isFile()) throw new Error(`${name} is not a file: ${resolved}`);
  return resolved;
}

function parseIntegerList(value, name) {
  if (!value) return [];
  const result = value.split(",").map((entry) => Number(entry.trim()));
  if (result.some((number) => !Number.isInteger(number) || number < 1)) {
    throw new Error(`${name} must be a comma-separated list of positive slide numbers`);
  }
  return [...new Set(result)].sort((a, b) => a - b);
}

function parsePageRoles(values) {
  const roles = {};
  for (const entry of values) {
    const match = entry.match(/^(\d+):(cover|index|body|closing|appendix|section)$/i);
    if (!match) throw new Error(`Invalid --page-role '${entry}'. Use <slide>:cover|index|body|closing|appendix|section.`);
    roles[Number(match[1])] = match[2].toLowerCase();
  }
  return roles;
}

function relativeEvidencePath(receiptPath, evidencePath) {
  return path.isAbsolute(evidencePath) ? path.resolve(evidencePath) : path.resolve(path.dirname(receiptPath), evidencePath);
}

function checkEvidencePaths(receiptPath, values, label, errors, { requiredSlides = [], requireSlide = false } = {}) {
  if (!Array.isArray(values) || values.length === 0) {
    errors.push(`${label} must contain at least one evidence path`);
    return { resolved: [], bySlide: {} };
  }
  const resolved = [];
  const bySlide = {};
  for (const evidence of values) {
    if (!evidence || typeof evidence !== "object" || Array.isArray(evidence) || typeof evidence.path !== "string" || !evidence.path.trim()) {
      errors.push(`${label} contains an empty or invalid path`);
      continue;
    }
    const fullPath = relativeEvidencePath(receiptPath, evidence.path);
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      errors.push(`${label} evidence file is missing: ${fullPath}`);
      continue;
    }
    if (!/^[a-f0-9]{64}$/i.test(evidence.sha256 || "")) errors.push(`${label} entry must include a SHA-256`);
    else if (sha256(fullPath) !== evidence.sha256.toLowerCase()) errors.push(`${label} evidence hash changed: ${fullPath}`);
    if (requireSlide && (!Number.isInteger(Number(evidence.slide)) || Number(evidence.slide) < 1)) errors.push(`${label} entries must include a positive slide number`);
    const slide = Number(evidence.slide);
    if (Number.isInteger(slide) && slide > 0) (bySlide[slide] ||= []).push(fullPath);
    resolved.push({ path: fullPath, slide: Number.isInteger(slide) && slide > 0 ? slide : null, sha256: evidence.sha256 || null });
  }
  for (const slide of requiredSlides) if (!bySlide[slide]?.length) errors.push(`${label} is missing evidence for slide ${slide}`);
  return { resolved, bySlide };
}

function specificAssetReviewNotes(notes) {
  if (typeof notes !== "string") return false;
  const value = notes.trim();
  if (value.length < 12) return false;
  return !/^(?:ok|pass|passed|good|looks good|n\/a|none|same|通过|良好|无|符合)$/i.test(value);
}

function validateAssetReviews({ receiptPath, boundManifest, manifest, visualStatus, visualErrors }) {
  const assets = Array.isArray(manifest?.assets) ? manifest.assets.filter((asset) => asset && typeof asset === "object" && !Array.isArray(asset)) : [];
  const assetById = new Map(assets.filter((asset) => typeof asset.id === "string" && asset.id.trim()).map((asset) => [asset.id, asset]));
  const requiredSemanticIds = assets.filter((asset) => asset.semantic_brief && typeof asset.semantic_brief === "object" && !Array.isArray(asset.semantic_brief)).map((asset) => asset.id).filter((id) => typeof id === "string" && id.trim());
  const records = boundManifest.asset_reviews;
  if (records !== undefined && !Array.isArray(records)) {
    visualErrors.push("review receipt asset_manifest.asset_reviews must be an array");
    return;
  }
  const reviews = Array.isArray(records) ? records : [];
  const byId = new Map();
  for (let index = 0; index < reviews.length; index += 1) {
    const item = reviews[index];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      visualErrors.push(`asset_reviews[${index}] must be an object`);
      continue;
    }
    const assetId = item.asset_id;
    if (typeof assetId !== "string" || !assetId.trim()) {
      visualErrors.push(`asset_reviews[${index}].asset_id must be a non-empty string`);
      continue;
    }
    if (byId.has(assetId)) visualErrors.push(`asset_reviews duplicates asset_id '${assetId}'`);
    else byId.set(assetId, item);
    if (!assetById.has(assetId)) visualErrors.push(`asset_reviews references unknown asset_id '${assetId}'`);

    const statuses = ["relevance", "clarity", "integration"].map((field) => item[field]);
    for (const field of ["relevance", "clarity", "integration"]) {
      if (!["pass", "fail", "not_run"].includes(item[field])) visualErrors.push(`asset_reviews '${assetId}'.${field} must be pass, fail, or not_run`);
    }
    if (statuses.includes("fail")) visualErrors.push(`asset review '${assetId}' contains an explicit fail decision`);
    const hasDecision = statuses.some((status) => status === "pass" || status === "fail");
    const isRequiredSemanticAsset = requiredSemanticIds.includes(assetId);
    if (hasDecision || (visualStatus === "pass" && isRequiredSemanticAsset)) {
      if (!specificAssetReviewNotes(item.notes)) visualErrors.push(`asset review '${assetId}' requires concrete, non-empty notes`);
      checkEvidencePaths(receiptPath, item.evidence_paths, `asset_reviews '${assetId}'.evidence_paths`, visualErrors);
    }
  }

  if (visualStatus !== "pass") return;
  const missing = requiredSemanticIds.filter((id) => !byId.has(id));
  if (missing.length) visualErrors.push(`review receipt asset_manifest.asset_reviews is missing semantic review(s): ${missing.join(", ")}`);
  for (const assetId of requiredSemanticIds) {
    const item = byId.get(assetId);
    if (!item) continue;
    if ([item.relevance, item.clarity, item.integration].some((status) => status !== "pass")) {
      visualErrors.push(`semantic asset review '${assetId}' must pass relevance, clarity, and integration before visual review can pass`);
    }
  }
}

function validateReviewReceipt({ receiptPath, pptx, pptxHash, profile, sourcePath, sourceHash, slides, targetSlides, renderResult, assetManifestPath, assetManifestHash, skipVisualValidation = false }) {
  if (!receiptPath) {
    const message = "No review receipt supplied; content and visual review remain unverified.";
    return { content: { status: "not_run", errors: [message] }, visual: { status: "not_run", errors: [message] }, receipt: null };
  }
  const contentErrors = [];
  const visualErrors = [];
  let receipt;
  try {
    receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
  } catch (error) {
    const message = `Cannot read review receipt: ${error.message}`;
    return { content: { status: "fail", errors: [message] }, visual: { status: "fail", errors: [message] }, receipt: null };
  }

  if (receipt.schema_version !== 1) {
    contentErrors.push("review receipt schema_version must be 1");
    visualErrors.push("review receipt schema_version must be 1");
  }
  if (receipt.profile !== profile) {
    contentErrors.push(`review receipt profile '${receipt.profile}' does not match '${profile}'`);
    visualErrors.push(`review receipt profile '${receipt.profile}' does not match '${profile}'`);
  }
  const reviewer = receipt.review?.reviewer;
  if (typeof reviewer !== "string" || !reviewer.trim()) {
    contentErrors.push("review.reviewer's name is required");
    visualErrors.push("review.reviewer's name is required");
  }
  if (!receipt.review?.reviewed_at || Number.isNaN(Date.parse(receipt.review.reviewed_at))) {
    contentErrors.push("review.reviewed_at must be a valid date");
    visualErrors.push("review.reviewed_at must be a valid date");
  }
  if (receipt.artifact?.sha256 !== pptxHash) {
    contentErrors.push("review receipt artifact.sha256 does not match the current PPTX");
    visualErrors.push("review receipt artifact.sha256 does not match the current PPTX");
  }
  if (!receipt.artifact?.path) {
    contentErrors.push("review receipt artifact.path is required");
    visualErrors.push("review receipt artifact.path is required");
  } else {
    const receiptArtifact = path.isAbsolute(receipt.artifact.path)
      ? path.resolve(receipt.artifact.path)
      : path.resolve(path.dirname(receiptPath), receipt.artifact.path);
    if (receiptArtifact !== pptx) {
      contentErrors.push("review receipt artifact.path does not identify the current PPTX");
      visualErrors.push("review receipt artifact.path does not identify the current PPTX");
    }
  }

  const visual = receipt.visual || {};
  if (assetManifestPath) {
    const boundManifest = receipt.asset_manifest || {};
    if (boundManifest.sha256 !== assetManifestHash) {
      contentErrors.push("review receipt asset_manifest.sha256 does not match the current asset manifest");
      visualErrors.push("review receipt asset_manifest.sha256 does not match the current asset manifest");
    }
    const boundPath = boundManifest.path
      ? (path.isAbsolute(boundManifest.path) ? path.resolve(boundManifest.path) : path.resolve(path.dirname(receiptPath), boundManifest.path))
      : null;
    if (!boundPath || boundPath !== assetManifestPath) {
      contentErrors.push("review receipt asset_manifest.path must identify --asset-manifest");
      visualErrors.push("review receipt asset_manifest.path must identify --asset-manifest");
    }
    const reviewStatus = boundManifest.review_status || "not_run";
    const reviewedAssetIds = Array.isArray(boundManifest.reviewed_asset_ids) ? boundManifest.reviewed_asset_ids : [];
    if (!["pass", "fail", "not_run"].includes(reviewStatus)) {
      visualErrors.push("review receipt asset_manifest.review_status must be pass, fail, or not_run");
    } else if (reviewStatus === "fail") {
      visualErrors.push("review receipt marks asset manifest visual review as fail");
    }
    let currentManifest = null;
    try {
      currentManifest = JSON.parse(fs.readFileSync(assetManifestPath, "utf8"));
    } catch (error) {
      if (visual.status === "pass") visualErrors.push(`cannot read current asset manifest for visual review: ${error.message}`);
    }
    if (visual.status === "pass") {
      if (reviewStatus !== "pass") visualErrors.push("visual review cannot pass until the asset manifest review_status is pass");
      if (currentManifest) {
        const requiredIds = (Array.isArray(currentManifest.assets) ? currentManifest.assets : []).map((asset) => asset?.id).filter((id) => typeof id === "string" && id.trim());
        const missingIds = requiredIds.filter((id) => !reviewedAssetIds.includes(id));
        if (missingIds.length) visualErrors.push(`review receipt asset_manifest.reviewed_asset_ids is missing: ${missingIds.join(", ")}`);
      }
    }
    if (currentManifest && typeof currentManifest === "object" && !Array.isArray(currentManifest)) {
      validateAssetReviews({ receiptPath, boundManifest, manifest: currentManifest, visualStatus: visual.status, visualErrors });
    } else if (boundManifest.asset_reviews !== undefined && !Array.isArray(boundManifest.asset_reviews)) {
      visualErrors.push("review receipt asset_manifest.asset_reviews must be an array");
    }
  } else if (receipt.asset_manifest?.sha256) {
    contentErrors.push("review receipt binds an asset manifest but this QA run did not supply --asset-manifest");
    visualErrors.push("review receipt binds an asset manifest but this QA run did not supply --asset-manifest");
  }

  const content = receipt.content || {};
  if (!["pass", "fail", "not_run"].includes(content.status)) contentErrors.push("content.status must be pass, fail, or not_run");
  if (content.status === "pass") {
    if (typeof content.summary !== "string" || !content.summary.trim()) contentErrors.push("content.summary is required");
    checkEvidencePaths(receiptPath, content.evidence_paths, "content.evidence_paths", contentErrors);
  }

  const reviewPages = profile === "targeted-fix"
    ? [...new Set(targetSlides.flatMap((slide) => [slide - 1, slide, slide + 1]).filter((slide) => slide >= 1 && slide <= slides))].sort((a, b) => a - b)
    : Array.from({ length: slides }, (_, index) => index + 1);
  if (profile !== "new") {
    if (!sourcePath || !sourceHash) contentErrors.push(`${profile} requires --source-pptx`);
    if (receipt.source?.sha256 !== sourceHash) contentErrors.push("review receipt source.sha256 does not match --source-pptx");
    const receiptSource = receipt.source?.path
      ? (path.isAbsolute(receipt.source.path) ? path.resolve(receipt.source.path) : path.resolve(path.dirname(receiptPath), receipt.source.path))
      : null;
    if (!receiptSource || receiptSource !== sourcePath) contentErrors.push("review receipt source.path must identify --source-pptx");
    const requiredSourceSlides = ["targeted-fix", "translate"].includes(profile) ? reviewPages : [];
    const sourceEvidence = checkEvidencePaths(receiptPath, receipt.source_evidence_paths, "source_evidence_paths", contentErrors, { requiredSlides: requiredSourceSlides, requireSlide: true });
    if (profile === "rebuild" && sourceEvidence.resolved.length === 0) contentErrors.push("rebuild requires at least one page-level source evidence item");
  }

  // Even when previews are intentionally skipped, bind the content decision to
  // the current artifact/source. Visual evidence remains not_run until a fresh
  // render exists, so a stale receipt cannot be mistaken for current evidence.
  if (skipVisualValidation) {
    const contentStatus = contentErrors.length ? "fail" : content.status;
    return {
      content: { status: contentStatus, errors: contentErrors },
      visual: { status: visualErrors.length ? "fail" : "not_run", errors: visualErrors.length ? visualErrors : ["Rendering and per-page visual evidence were not checked (--no-preview)."] },
      receipt: { reviewer, reviewedAt: receipt.review.reviewed_at, requiredPages: reviewPages },
    };
  }

  if (!["pass", "fail", "not_run"].includes(visual.status)) visualErrors.push("visual.status must be pass, fail, or not_run");
  const allPages = Array.from({ length: slides }, (_, index) => index + 1);
  if (visual.status === "not_run" && visualErrors.length === 0) {
    return {
      content: { status: contentErrors.length ? "fail" : content.status, errors: contentErrors },
      visual: { status: "not_run", errors: ["Visual review is explicitly marked not_run in the receipt."] },
      receipt: { reviewer, reviewedAt: receipt.review.reviewed_at, requiredPages: allPages },
    };
  }
  if (visual.status !== "pass" && visual.status !== "fail") visualErrors.push("visual.status must be pass, fail, or not_run");
  if (!renderResult?.renderer_signature) visualErrors.push("current render and renderer signature are required for visual review");
  else if (visual.renderer_signature !== renderResult.renderer_signature) visualErrors.push("visual.renderer_signature does not match the current rendering environment");
  const pagesBySlide = {};
  if (!Array.isArray(visual.pages)) visualErrors.push("visual.pages must be an array of per-slide review records");
  for (const record of Array.isArray(visual.pages) ? visual.pages : []) {
    const slide = Number(record?.slide);
    if (!Number.isInteger(slide) || slide < 1 || slide > slides) {
      visualErrors.push("visual.pages contains an invalid slide number");
      continue;
    }
    if (pagesBySlide[slide]) visualErrors.push(`visual.pages duplicates slide ${slide}`);
    pagesBySlide[slide] = record;
  }
  for (const slide of allPages) {
    const record = pagesBySlide[slide];
    if (!record) {
      visualErrors.push(`visual.pages is missing slide ${slide}`);
      continue;
    }
    const expectedReviewStatus = profile === "targeted-fix" && !reviewPages.includes(slide) ? "preserved" : "reviewed";
    if (record.review_status !== expectedReviewStatus) visualErrors.push(`visual.pages slide ${slide} must have review_status '${expectedReviewStatus}'`);
    const renderedPage = renderResult?.page_images?.find((page) => page.slide === slide);
    if (!renderedPage || record.rendered_page_sha256 !== renderedPage.sha256) visualErrors.push(`visual.pages slide ${slide} rendered_page_sha256 is missing or stale`);
    const visualEvidence = checkEvidencePaths(receiptPath, record.evidence_paths, `visual.pages[${slide}].evidence_paths`, visualErrors);
    if (!visualEvidence.resolved.some((entry) => entry.sha256 === renderedPage?.sha256)) visualErrors.push(`visual.pages slide ${slide} must include the exact rendered PNG as review evidence`);
    if (profile === "translate") {
      const sourcePage = renderResult?.source_render?.pages?.find((page) => page.slide === slide);
      if (!sourcePage || record.source_page_sha256 !== sourcePage.sha256) visualErrors.push(`translation source page ${slide} hash is missing or stale`);
      const sourceEvidence = checkEvidencePaths(receiptPath, record.source_evidence_paths, `visual.pages[${slide}].source_evidence_paths`, visualErrors);
      if (!sourceEvidence.resolved.some((entry) => entry.sha256 === sourcePage?.sha256)) visualErrors.push(`translation slide ${slide} must include the exact current source PNG`);
    }
    if (expectedReviewStatus === "preserved") {
      const sourcePage = renderResult?.source_render?.pages?.find((page) => page.slide === slide);
      const preservation = renderResult?.preservation?.find((page) => page.slide === slide);
      if (!sourcePage || record.source_page_sha256 !== sourcePage.sha256) visualErrors.push(`visual.pages slide ${slide} source_page_sha256 is missing or stale`);
      if (!preservation?.pixel_identical) visualErrors.push(`visual.pages slide ${slide} was not preserved pixel-identically from the source`);
      const sourceEvidence = checkEvidencePaths(receiptPath, record.source_evidence_paths, `visual.pages[${slide}].source_evidence_paths`, visualErrors);
      if (!sourceEvidence.resolved.some((entry) => entry.sha256 === sourcePage?.sha256)) visualErrors.push(`visual.pages slide ${slide} must include the exact source PNG as preservation evidence`);
    }
  }

  if (profile === "targeted-fix") {
    const receiptTargets = Array.isArray(receipt.target_slides) ? receipt.target_slides.map(Number) : [];
    const missingTargets = targetSlides.filter((slide) => !receiptTargets.includes(slide));
    if (missingTargets.length) visualErrors.push(`review receipt target_slides is missing: ${missingTargets.join(",")}`);
    checkEvidencePaths(receiptPath, receipt.target_evidence_paths, "target_evidence_paths", visualErrors, { requiredSlides: targetSlides, requireSlide: true });
    checkEvidencePaths(receiptPath, receipt.crop_evidence_paths, "crop_evidence_paths", visualErrors, { requiredSlides: targetSlides, requireSlide: true });
  }
  return {
    content: { status: contentErrors.length ? "fail" : content.status, errors: contentErrors },
    visual: { status: visualErrors.length ? "fail" : visual.status, errors: visualErrors },
    receipt: { reviewer, reviewedAt: receipt.review.reviewed_at, requiredPages: profile === "targeted-fix" ? allPages : reviewPages },
  };
}

function readJsonReport(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return { parseError: error.message };
  }
}

function statusCategory(status, details = []) {
  return { status, details };
}

function usage() {
  console.error("Usage: node scripts/qa_me2026.cjs --pptx <file> --slides <n> [--profile new|rebuild|targeted-fix|translate] [--translation-mapping <json>] [--translation-report <json>] [--translation-adaptations <json>] [--asset-manifest <json>] [--allow-fullslide 1,2] [--source-pptx <file>] [--target-slides 3,4] [--review-receipt <json>] [--write-review-template <json>] [--page-role <slide>:cover|index|body|closing|appendix|section ...]");
}

function writeReviewTemplate(templatePath, { pptx, pptxHash, profile, slides, sourcePath, sourceHash, targetSlides, assetManifestPath, assetManifestHash }) {
  const requiredPages = profile === "targeted-fix"
    ? [...new Set(targetSlides.flatMap((slide) => [slide - 1, slide, slide + 1]).filter((slide) => slide >= 1 && slide <= slides))].sort((a, b) => a - b)
    : Array.from({ length: slides }, (_, index) => index + 1);
  let semanticAssetReviews = [];
  if (assetManifestPath) {
    try {
      const manifest = JSON.parse(fs.readFileSync(assetManifestPath, "utf8"));
      semanticAssetReviews = (Array.isArray(manifest.assets) ? manifest.assets : [])
        .filter((asset) => asset && typeof asset === "object" && !Array.isArray(asset) && typeof asset.id === "string" && asset.id.trim() && asset.semantic_brief && typeof asset.semantic_brief === "object" && !Array.isArray(asset.semantic_brief))
        .map((asset) => ({ asset_id: asset.id, relevance: "not_run", clarity: "not_run", integration: "not_run", notes: "", evidence_paths: [] }));
    } catch {
      // The manifest checker reports parse failures separately; an unreadable
      // manifest must not make the generated receipt template claim a review.
    }
  }
  const template = {
    schema_version: 1,
    profile,
    review: { reviewer: "", reviewed_at: "" },
    artifact: { path: pptx, sha256: pptxHash },
    asset_manifest: assetManifestPath ? { path: assetManifestPath, sha256: assetManifestHash, review_status: "not_run", reviewed_asset_ids: [], asset_reviews: semanticAssetReviews } : null,
    source: sourcePath ? { path: sourcePath, sha256: sourceHash } : null,
    target_slides: targetSlides,
    content: { status: "not_run", summary: "", evidence_paths: [] },
    visual: {
      status: "not_run",
      renderer_signature: "",
      pages: Array.from({ length: slides }, (_, index) => {
        const slide = index + 1;
        const reviewPages = profile === "targeted-fix"
          ? new Set(targetSlides.flatMap((target) => [target - 1, target, target + 1]))
          : new Set(requiredPages);
        return {
          slide,
          review_status: profile === "targeted-fix" && !reviewPages.has(slide) ? "preserved" : "reviewed",
          rendered_page_sha256: "",
          evidence_paths: [],
          ...(profile === "targeted-fix" && !reviewPages.has(slide) ? { source_page_sha256: "", source_evidence_paths: [] } : {}),
        };
      }),
    },
    source_evidence_paths: [],
    target_evidence_paths: [],
    crop_evidence_paths: [],
    instructions: "Fill review and evidence fields after review by the explicitly named reviewer. When an asset manifest is bound, review every listed image and its intended slide placement. For each semantic asset, assess relevance to the page claim, visual clarity, and integration with the page; attach hash-bound evidence and concrete notes. Keep generated statuses=not_run until a human reviewer checks the bound artifact, source, and manifest; this template never records a pass automatically.",
  };
  fs.mkdirSync(path.dirname(path.resolve(templatePath)), { recursive: true });
  fs.writeFileSync(path.resolve(templatePath), `${JSON.stringify(template, null, 2)}\n`, { flag: "wx" });
  return path.resolve(templatePath);
}

if (hasArg("--help") || hasArg("-h")) {
  usage();
  process.exit(0);
}

let taskDir;
let ledgerPath;
let exitCode = 2;
try {
  const pptx = ensureExistingFile(readArg("--pptx"), "PPTX");
  const slides = Number(readArg("--slides") || readArg("--expected-slides"));
  if (!Number.isInteger(slides) || slides < 1) throw new Error("--slides must be a positive integer");
  const profile = readArg("--profile", "new");
  if (!["new", "rebuild", "targeted-fix", "translate"].includes(profile)) throw new Error("--profile must be new, rebuild, targeted-fix, or translate");

  const sourceArg = readArg("--source-pptx");
  const sourcePath = sourceArg ? ensureExistingFile(sourceArg, "Source PPTX") : null;
  if (profile !== "new" && !sourcePath) throw new Error(`${profile} requires --source-pptx`);
  const sourceHash = sourcePath ? sha256(sourcePath) : null;
  const translationMapping = profile === "translate" ? ensureExistingFile(readArg("--translation-mapping"), "Translation mapping") : null;
  const translationApplyReport = profile === "translate" ? ensureExistingFile(readArg("--translation-report"), "Translation apply report") : null;
  const translationAdaptations = profile === "translate" && readArg("--translation-adaptations") ? ensureExistingFile(readArg("--translation-adaptations"), "Translation adaptation journal") : null;
  const translationMappingHash = translationMapping ? sha256(translationMapping) : null;
  const translationApplyReportHash = translationApplyReport ? sha256(translationApplyReport) : null;
  const translationAdaptationsHash = translationAdaptations ? sha256(translationAdaptations) : null;
  const assetManifestPath = readArg("--asset-manifest") ? ensureExistingFile(readArg("--asset-manifest"), "Asset manifest") : null;
  const assetManifestHash = assetManifestPath ? sha256(assetManifestPath) : null;
  const targetSlides = parseIntegerList(readArg("--target-slides"), "--target-slides");
  if (profile === "targeted-fix" && targetSlides.length === 0) throw new Error("targeted-fix requires --target-slides");
  for (const slide of targetSlides) if (slide > slides) throw new Error(`target slide ${slide} exceeds the output slide count ${slides}`);

  const requiredTexts = readArgs("--required-text");
  if (!requiredTexts.length && profile === "new") requiredTexts.push("黏贴个人联系方式");
  const allowSlides = parseIntegerList(readArg("--allow-fullslide"), "--allow-fullslide");
  for (const slide of allowSlides) if (slide > slides) throw new Error(`allowlisted slide ${slide} exceeds the output slide count ${slides}`);
  const pageRoles = parsePageRoles(readArgs("--page-role"));
  for (const slide of Object.keys(pageRoles).map(Number)) if (slide > slides) throw new Error(`page role slide ${slide} exceeds the output slide count ${slides}`);
  const imageOnlyExceptionRoles = new Set(["cover", "section", "closing"]);
  const roleExceptionSlides = Object.entries(pageRoles)
    .filter(([, role]) => imageOnlyExceptionRoles.has(role))
    .map(([slide]) => Number(slide));
  const fullslideAllowedSlides = [...new Set([...allowSlides, ...roleExceptionSlides])].sort((a, b) => a - b);

  const baseDir = path.resolve(readArg("--preview-dir", path.join(os.tmpdir(), "me2026-previews")));
  fs.mkdirSync(baseDir, { recursive: true });
  const safeStem = path.basename(pptx, path.extname(pptx)).replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 48) || "deck";
  taskDir = fs.mkdtempSync(path.join(baseDir, `.me2026-qa-${safeStem}-`));
  const requestedLedger = readArg("--ledger");
  ledgerPath = requestedLedger ? path.resolve(requestedLedger) : path.join(taskDir, "qa-ledger.json");
  if (path.resolve(ledgerPath) === pptx || (sourcePath && path.resolve(ledgerPath) === sourcePath)) throw new Error("QA ledger cannot overwrite the input or source PPTX");

  const pptxHash = sha256(pptx);
  const templatePath = readArg("--write-review-template");
  const reviewTemplatePath = templatePath
    ? writeReviewTemplate(templatePath, { pptx, pptxHash, profile, slides, sourcePath, sourceHash, targetSlides, assetManifestPath, assetManifestHash })
    : null;
  const receiptPathArg = readArg("--review-receipt");
  const receiptPath = receiptPathArg ? ensureExistingFile(receiptPathArg, "Review receipt") : null;
  if (reviewTemplatePath && receiptPath && path.resolve(reviewTemplatePath) === receiptPath) throw new Error("Review template cannot overwrite the supplied review receipt");

  const inspectReportPath = path.join(taskDir, "inspect-report.json");
  const layoutReportPath = path.join(taskDir, "layout-report.json");
  const inspectArgs = [
    INSPECT_SCRIPT,
    pptx,
    "--expected-slides", String(slides),
    "--check-package-compatibility",
    "--check-no-fullslide-images",
    "--check-integer-font-sizes", "--min-font-size", "8",
    "--check-me2026-footer-logo-alignment",
    "--check-icon-card-alignment",
    "--check-label-text-row-alignment",
    "--print-style-summary",
    "--json-report", inspectReportPath,
  ];
  // Faithful source routes use the source layout, not the new-deck header grid.
  if (profile === "new") inspectArgs.push("--check-header-safe-zone", "--header-safe-y-in", "1.55");
  if (fullslideAllowedSlides.length) inspectArgs.push("--allow-fullslide-image-slides", fullslideAllowedSlides.join(","));
  // A full-slide decorative-image allowance and the body-editability contract
  // are separate. Only page roles that permit image-led pages are exempt.
  inspectArgs.push("--allow-body-image-only-slides", roleExceptionSlides.join(","));
  for (const text of requiredTexts) inspectArgs.push("--required-text", text);

  const steps = [];
  const pythonCommand = process.env.AIDEA_PPT_PYTHON || "python3";
  const inspectStep = runStep("inspect", pythonCommand, inspectArgs, { quiet: true });
  steps.push(inspectStep);
  const layoutStep = runStep("layout-risk", pythonCommand, [LAYOUT_SCRIPT, pptx, "--json-report", layoutReportPath], { quiet: true });
  steps.push(layoutStep);
  const inspectReport = fs.existsSync(inspectReportPath) ? readJsonReport(inspectReportPath) : null;
  const layoutReport = fs.existsSync(layoutReportPath) ? readJsonReport(layoutReportPath) : null;

  const assetManifestReportPath = assetManifestPath ? path.join(taskDir, "asset-manifest-report.json") : null;
  let assetManifestReport = null;
  if (assetManifestPath) {
    const assetStep = runStep("asset-manifest", pythonCommand, [ASSET_MANIFEST_SCRIPT, "--pptx", pptx, "--manifest", assetManifestPath], { quiet: true });
    steps.push(assetStep);
    try {
      assetManifestReport = JSON.parse(assetStep.stdout.trim());
      fs.writeFileSync(assetManifestReportPath, `${JSON.stringify(assetManifestReport, null, 2)}\n`, { flag: "wx" });
    } catch (error) {
      assetManifestReport = { schema_version: 1, status: "fail", errors: [`asset manifest checker failed: ${error.message}; ${assetStep.stderr}`], assets: [], required_editable: [] };
    }
  }

  let translationReport = null;
  if (profile === "translate") {
    const translationArgs = [TRANSLATION_CHECK_SCRIPT, "--source-pptx", sourcePath, "--pptx", pptx, "--mapping", translationMapping, "--report", translationApplyReport];
    if (translationAdaptations) translationArgs.push("--translation-adaptations", translationAdaptations);
    const step = runStep("translation-reconciliation", pythonCommand, translationArgs, { quiet: true });
    steps.push(step);
    try { translationReport = JSON.parse(step.stdout.trim()); }
    catch (error) { translationReport = { status: "fail", errors: [`Translation checker did not return valid JSON: ${error.message}; ${step.stderr}`], checks: {} }; }
    if (!step.ok && translationReport.status !== "fail") translationReport = { ...translationReport, status: "fail", errors: [...(translationReport.errors || []), "Translation checker exited abnormally"] };
  }

  const structureErrors = [];
  const inspectFindings = Array.isArray(inspectReport?.errors) ? inspectReport.errors : [];
  const inspectStructureFindings = inspectFindings.filter((finding) => finding?.code !== "body-image-only");
  if (inspectStep.error) structureErrors.push(`inspect failed: ${inspectStep.error}`);
  if (!inspectStep.ok && (!inspectReport || inspectStructureFindings.length > 0 || inspectFindings.length === 0)) {
    structureErrors.push(`inspect exited ${inspectStep.status ?? "without a status"}`);
  }
  if (!layoutStep.ok) structureErrors.push(`layout-risk exited ${layoutStep.status ?? layoutStep.error}`);
  if (!inspectReport || inspectReport.schema_version !== 1) structureErrors.push("inspect JSON report missing or has an unsupported schema");
  if (!layoutReport || layoutReport.schema_version !== 1) structureErrors.push("layout JSON report missing or has an unsupported schema");
  if (inspectStructureFindings.length) structureErrors.push("inspect reported one or more structural errors");
  if (inspectReport && inspectReport.ok === false && inspectFindings.length === 0) structureErrors.push("inspect reported failure without structured findings");
  if (inspectReport?.summary?.out_of_bounds_count > 0) structureErrors.push(`${inspectReport.summary.out_of_bounds_count} object(s) extend beyond the slide canvas`);
  if (inspectReport?.summary?.unresolved_geometry_count > 0) structureErrors.push(`${inspectReport.summary.unresolved_geometry_count} object(s) have unresolved geometry`);
  const assetStructureErrors = [];
  const assetContentErrors = [];
  const assetEditabilityErrors = [];
  if (assetManifestPath) {
    if (!assetManifestReport || assetManifestReport.schema_version !== 1) assetStructureErrors.push("asset manifest report missing or has an unsupported schema");
    for (const asset of assetManifestReport?.assets || []) {
      for (const message of asset.errors || []) {
        if (/origin\.|requires a prompt|requires a url|requires a source description|must be an object/i.test(message)) assetContentErrors.push(message);
        else assetStructureErrors.push(message);
      }
    }
    for (const page of assetManifestReport?.required_editable || []) assetEditabilityErrors.push(...(page.errors || []));
    if (assetManifestReport?.sha256 && assetManifestReport.sha256 !== assetManifestHash) assetStructureErrors.push("asset manifest changed while QA was running; rerun with the current manifest");
    for (const message of assetManifestReport?.errors || []) {
      // Asset-specific errors are already classified above. Preserve schema
      // and parser errors as structural failures.
      if (!assetManifestReport.assets?.some((asset) => asset.errors?.includes(message))
          && !assetManifestReport.required_editable?.some((page) => page.errors?.includes(message))) {
        assetStructureErrors.push(message);
      }
    }
    structureErrors.push(...assetStructureErrors);
  }
  if (layoutReport && layoutReport.ok === false) structureErrors.push("layout-risk reported one or more layout errors");
  if (inspectReport?.slides?.length !== slides) structureErrors.push(`inspect reported ${inspectReport?.slides?.length ?? 0} slide records; expected ${slides}`);
  if (translationReport && Object.entries(translationReport.checks || {}).some(([key, value]) => ["package_members_and_part_payloads", "ooxml_structure_geometry_formatting", "embedded_workbook"].includes(key) && value === "fail")) structureErrors.push(...(translationReport.errors || ["Translation structure reconciliation failed"]));
  const structure = statusCategory(structureErrors.length ? "fail" : "pass", structureErrors);

  const editabilityErrors = [...assetEditabilityErrors];
  const editabilityWarnings = [];
  const inspectSlides = Array.isArray(inspectReport?.slides) ? inspectReport.slides : [];
  if (inspectSlides.length) {
    for (const slideReport of inspectSlides) {
      const slide = Number(slideReport.slide);
      const role = pageRoles[slide] || "body";
      const editability = slideReport.editability || {};
      const bodyTextChars = Number(slideReport.counts?.body_text_chars ?? 0);
      const editableObjects = Number(editability.editable_shape_objects ?? 0)
        + Number(editability.native_tables ?? 0)
        + Number(editability.native_charts ?? 0);
      // Full-slide background exceptions affect only the picture scan. The
      // page still needs its role's editable content (for example, index rows).
      const requiresEditableContent = !["cover", "section", "closing"].includes(role);
      if (requiresEditableContent && bodyTextChars <= 0 && editableObjects <= 0) {
        editabilityErrors.push(`slide ${slide} (${role}) has no editable body text, shapes, table, or chart`);
      }
      if (editability.body_image_only_suspected && !["cover", "section", "closing"].includes(role)) {
        const bodyCoverage = Number(editability.body_image_coverage ?? coverage);
        const bodyTextChars = Number(editability.substantive_body_text_chars ?? 0);
        editabilityErrors.push(`slide ${slide} (${role}) has a raster-dominated body (${bodyCoverage.toFixed(3)} coverage) without substantive editable body text, table, or chart (${bodyTextChars} body-text characters)`);
      }
      const coverage = Number(slideReport.image_union?.coverage_ratio ?? 0);
      if (coverage >= 0.6 && !editability.body_image_only_suspected) {
        editabilityWarnings.push(`slide ${slide} has high raster coverage (${coverage.toFixed(3)}); review whether image exceptions match its page role`);
      }
    }
  } else {
    editabilityErrors.push("per-slide editability report unavailable");
  }
  if (translationReport?.checks?.ooxml_structure_geometry_formatting === "fail") editabilityErrors.push("Translation changed non-text object structure, geometry or formatting");
  const editability = statusCategory(editabilityErrors.length ? "fail" : "pass", editabilityErrors);
  editability.warnings = editabilityWarnings;

  let render = statusCategory("not_run", ["Rendering skipped by --no-preview."]);
  let renderResult = null;
  if (!hasArg("--no-preview")) {
    renderResult = renderPptx({
      pptx,
      sourcePptx: profile === "new" ? null : sourcePath,
      expectedSlides: slides,
      taskDir,
      previewDir: path.join(taskDir, "pages"),
      targetSlides,
      preserveUntouched: profile === "targeted-fix",
    });
    steps.push({ label: "render", command: renderResult.command, status: renderResult.ok ? 0 : 1, ok: renderResult.ok, error: renderResult.error || null });
    const renderErrors = [...(renderResult.errors || [])];
    if (!renderResult.ok) renderErrors.push(renderResult.error || "LibreOffice render failed");
    render = statusCategory(renderErrors.length ? "fail" : "pass", renderErrors);
  }

  const receiptResult = receiptPath
    ? validateReviewReceipt({ receiptPath, pptx, pptxHash, profile, sourcePath, sourceHash, slides, targetSlides, renderResult, assetManifestPath, assetManifestHash, skipVisualValidation: hasArg("--no-preview") })
    : { content: { status: "not_run", errors: ["No content review receipt supplied."] }, visual: { status: "not_run", errors: [hasArg("--no-preview") ? "Rendering and per-page visual evidence were skipped (--no-preview)." : "No visual review receipt supplied."] }, receipt: null };

  const content = statusCategory(receiptResult.content.status, [...receiptResult.content.errors, ...assetContentErrors]);
  if (assetContentErrors.length) content.status = "fail";
  let languageReviewStatus = "not_run";
  if (profile === "translate") {
    if (translationReport?.status !== "pass") {
      content.status = "fail";
      content.details.push(...(translationReport?.errors || ["Translation reconciliation is missing"]));
    }
    const receipt = receiptPath ? readJsonReport(receiptPath) : {};
    const translation = receipt.translation || {};
    const language = translation.language || {};
    const languageErrors = [];
    if (translation.mapping_sha256 && translation.mapping_sha256 !== translationMappingHash) languageErrors.push("translation receipt mapping hash is stale");
    if (translation.report_sha256 && translation.report_sha256 !== translationApplyReportHash) languageErrors.push("translation receipt apply-report hash is stale");
    if (translation.adaptations_sha256 && translation.adaptations_sha256 !== translationAdaptationsHash) languageErrors.push("translation receipt adaptation-journal hash is stale");
    if (language.status === "pass") {
      if (translation.mapping_sha256 !== translationMappingHash || translation.report_sha256 !== translationApplyReportHash || (translationAdaptations && translation.adaptations_sha256 !== translationAdaptationsHash)) languageErrors.push("translation review must bind the current mapping, apply report and adaptation journal");
      if (!language.reviewer?.trim() || !language.summary?.trim()) languageErrors.push("independent language reviewer and summary are required");
      const mapping = readJsonReport(translationMapping);
      const translator = typeof mapping.translator === "string" ? mapping.translator.trim() : "";
      const reviewer = typeof language.reviewer === "string" ? language.reviewer.trim() : "";
      if (!translator) languageErrors.push("translation mapping requires a non-empty translator identity for independent review");
      if (translator && reviewer.toLowerCase() === translator.toLowerCase()) languageErrors.push("language reviewer must be different from the translator");
      checkEvidencePaths(receiptPath, language.evidence_paths, "translation.language.evidence_paths", languageErrors);
    } else if (language.status === "fail") languageErrors.push("independent language review failed");
    else if (language.status && language.status !== "not_run") languageErrors.push("translation language status must be pass, fail, or not_run");
    languageReviewStatus = languageErrors.length ? "fail" : language.status || "not_run";
    if (languageErrors.length) { content.status = "fail"; content.details.push(...languageErrors); }
    else if (languageReviewStatus !== "pass" && content.status !== "fail") { content.status = "not_run"; content.details.push("Independent language review has not been completed."); }
    if (sha256(translationMapping) !== translationMappingHash || sha256(translationApplyReport) !== translationApplyReportHash) { content.status = "fail"; content.details.push("Translation evidence changed during QA"); }
  }
  const visual = statusCategory(receiptResult.visual.status, receiptResult.visual.errors);
  if (profile === "translate") {
    const imageReview = receiptPath ? readJsonReport(receiptPath).translation?.image_review : null;
    const mediaParts = translationReport?.inventory?.media_parts || [];
    const imageErrors = [];
    if (imageReview?.status === "pass") {
      if (imageReview.source_sha256 !== sourceHash) imageErrors.push("translation image review source hash is missing or stale");
      const items = Array.isArray(imageReview.items) ? imageReview.items : [];
      const seen = new Set();
      for (const item of items) {
        if (!mediaParts.includes(item.part) || seen.has(item.part)) imageErrors.push(`invalid or duplicate translation image disposition: ${item.part}`);
        seen.add(item.part);
        if (!["no_translation_needed", "preserve_brand"].includes(item.disposition)) imageErrors.push(`unresolved raster text or invalid image disposition: ${item.part}`);
        if (typeof item.reason !== "string" || !item.reason.trim()) imageErrors.push(`translation image disposition requires a review reason: ${item.part}`);
      }
      const missing = mediaParts.filter(part => !seen.has(part));
      if (missing.length) imageErrors.push(`translation image review is missing ${missing.length} source media parts`);
    } else if (imageReview?.status === "fail") imageErrors.push("translation image/raster-text review failed");
    else if (imageReview?.status && imageReview.status !== "not_run") imageErrors.push("translation image review status must be pass, fail, or not_run");
    if (imageErrors.length) { content.status = "fail"; content.details.push(...imageErrors); visual.status = "fail"; visual.details.push(...imageErrors); }
    else if (mediaParts.length && imageReview?.status !== "pass") {
      if (content.status !== "fail") content.status = "not_run";
      content.details.push("Source media require reviewed translation/raster-text dispositions.");
      if (visual.status !== "fail") visual.status = "not_run";
      visual.details.push("Translation image/raster-text review has not been completed.");
    }
  }
  if (render.status !== "pass" && visual.status === "pass") {
    visual.status = "fail";
    visual.details.push("Visual review cannot pass when the current artifact did not render successfully.");
  }

  const categories = { content, structure, editability, render, visual };
  const statuses = Object.values(categories).map((category) => category.status);
  const overall = statuses.includes("fail") ? "fail" : statuses.every((status) => status === "pass") ? "pass" : "partial";

  const assetsDir = path.join(SKILL_DIR, "assets", "me-2026-app");
  const brandAssetHashes = {};
  for (const name of fs.readdirSync(assetsDir).sort()) {
    const file = path.join(assetsDir, name);
    if (fs.statSync(file).isFile()) brandAssetHashes[name] = sha256(file);
  }
  const ledger = {
    schema_version: 2,
    profile,
    generated_at: new Date().toISOString(),
    overall,
    artifact: { path: pptx, sha256: pptxHash, size_bytes: fs.statSync(pptx).size },
    source: sourcePath ? { path: sourcePath, sha256: sourceHash, size_bytes: fs.statSync(sourcePath).size } : null,
    translation: profile === "translate" ? {
      mapping: { path: translationMapping, sha256: translationMappingHash },
      apply_report: { path: translationApplyReport, sha256: translationApplyReportHash },
      adaptations: translationAdaptations ? { path: translationAdaptations, sha256: translationAdaptationsHash } : null,
      reconciliation: translationReport,
      language_review: languageReviewStatus,
    } : null,
    expected_slides: slides,
    allow_fullslide_slides: fullslideAllowedSlides,
    explicit_allow_fullslide_slides: allowSlides,
    role_allow_fullslide_slides: roleExceptionSlides,
    allow_body_image_only_slides: roleExceptionSlides,
    page_roles: pageRoles,
    target_slides: targetSlides,
    required_texts: requiredTexts,
    categories,
    asset_manifest: assetManifestPath ? {
      path: assetManifestPath,
      sha256: assetManifestHash,
      status: assetManifestReport?.status || "fail",
      report: assetManifestReportPath,
      report_sha256: assetManifestReportPath && fs.existsSync(assetManifestReportPath) ? sha256(assetManifestReportPath) : null,
      review_status: receiptPath ? (readJsonReport(receiptPath).asset_manifest?.review_status || "not_run") : "not_run",
      reviewed_asset_ids: receiptPath && Array.isArray(readJsonReport(receiptPath).asset_manifest?.reviewed_asset_ids) ? readJsonReport(receiptPath).asset_manifest.reviewed_asset_ids : [],
      asset_reviews: receiptPath && Array.isArray(readJsonReport(receiptPath).asset_manifest?.asset_reviews) ? readJsonReport(receiptPath).asset_manifest.asset_reviews : [],
      details: assetManifestReport?.errors || ["asset manifest report missing"],
    } : { status: "not_run", path: null, sha256: null, report: null },
    review_receipt: { path: receiptPath, status: [receiptResult.content.status, receiptResult.visual.status].includes("fail") ? "fail" : receiptResult.content.status === "pass" && receiptResult.visual.status === "pass" ? "pass" : "partial", reviewer: receiptResult.receipt?.reviewer || null, reviewed_at: receiptResult.receipt?.reviewedAt || null, content_errors: receiptResult.content.errors, visual_errors: receiptResult.visual.errors },
    review_template: reviewTemplatePath,
    contrast: {
      summary: layoutReport?.summary ? {
        checked: layoutReport.summary.contrast_checked,
        eligible: layoutReport.summary.contrast_eligible,
        coverage_ratio: layoutReport.summary.contrast_coverage_ratio,
        unknown: layoutReport.summary.contrast_unknown,
        low_contrast: layoutReport.summary.contrast_low_contrast,
        status: layoutReport.summary.contrast_checked > 0 && layoutReport.summary.contrast_unknown === 0 ? "measured" : "requires_visual_review",
      } : { status: "not_run" },
      warnings: layoutReport?.warnings || [],
    },
    icon_contrast: layoutReport?.summary ? {
      checked: layoutReport.summary.icon_contrast_checked,
      eligible: layoutReport.summary.icon_contrast_eligible,
      coverage_ratio: layoutReport.summary.icon_contrast_coverage_ratio,
      unknown: layoutReport.summary.icon_contrast_unknown,
      low_contrast: layoutReport.summary.icon_contrast_low_contrast,
      status: layoutReport.summary.icon_contrast_low_contrast > 0
        ? "fail"
        : layoutReport.summary.icon_contrast_eligible > 0 && layoutReport.summary.icon_contrast_unknown === 0
          ? "measured"
          : layoutReport.summary.icon_contrast_eligible > 0
            ? "requires_visual_review"
            : "not_run",
    } : { status: "not_run" },
    reports: {
      inspect: inspectReportPath,
      inspect_sha256: fs.existsSync(inspectReportPath) ? sha256(inspectReportPath) : null,
      layout: layoutReportPath,
      layout_sha256: fs.existsSync(layoutReportPath) ? sha256(layoutReportPath) : null,
    },
    rendering: renderResult,
    environment: {
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      python: renderResult?.python || null,
      python_libraries: renderResult?.python_libraries || null,
      libreoffice: renderResult?.libreoffice || null,
      fontconfig: renderResult?.fontconfig || null,
      configured_dependencies: {
        jszip_expected: readPackageDependency("jszip"),
        jszip_actual: readInstalledPackageVersion("jszip"),
        pptxgenjs_expected: readPackageDependency("pptxgenjs"),
        pptxgenjs_actual: readInstalledPackageVersion("pptxgenjs"),
        lucide_expected: readPackageDependency("lucide"),
        lucide_actual: readInstalledPackageVersion("lucide"),
        sharp_expected: readPackageDependency("sharp"),
        sharp_actual: readInstalledPackageVersion("sharp"),
        node_modules: process.env.CODEX_NODE_MODULES || null,
      },
    },
    brand_asset_sha256: brandAssetHashes,
    steps: steps.map((step) => ({ label: step.label, ok: step.ok, status: step.status, command: step.command, error: step.error })),
    task_output_dir: taskDir,
  };

  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  try {
    fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, { flag: "wx" });
  } catch (error) {
    throw new Error(`Could not create ledger without overwriting an existing file: ${ledgerPath} (${error.message})`);
  }

  if (overall === "pass") {
    exitCode = 0;
    console.log("PASS: ME2026 QA passed all required categories.");
  } else if (overall === "fail") {
    exitCode = 1;
    console.error("FAIL: ME2026 QA has one or more failed categories.");
  } else {
    exitCode = 2;
    console.error("PARTIAL: ME2026 QA is incomplete; required evidence is missing or rendering was skipped.");
  }
  console.log(`QA ledger: ${ledgerPath}`);
  if (reviewTemplatePath) console.log(`Review template (all statuses not_run): ${reviewTemplatePath}`);
  if (renderResult?.previewDir) console.log(`Rendered pages: ${renderResult.previewDir}`);
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  if (ledgerPath) console.error(`QA ledger not written: ${ledgerPath}`);
  exitCode = 1;
}

process.exit(exitCode);

function readPackageDependency(name) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, "package.json"), "utf8"));
    return packageJson.dependencies?.[name] || null;
  } catch {
    return null;
  }
}

function readInstalledPackageVersion(name) {
  const roots = [process.env.CODEX_NODE_MODULES, path.join(SKILL_DIR, "node_modules")].filter(Boolean);
  for (const root of roots) {
    const candidates = [path.join(root, name, "package.json")];
    for (const packageFile of candidates) {
      try {
        return JSON.parse(fs.readFileSync(packageFile, "utf8")).version || null;
      } catch {
        // Try the next configured runtime root.
      }
    }
  }
  return null;
}
