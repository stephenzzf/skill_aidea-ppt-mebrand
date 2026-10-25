const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { pathToFileURL } = require("url");

const RASTERIZE = String.raw`
import json, os, sys
import fitz
from PIL import Image, ImageDraw
fitz.TOOLS.mupdf_display_errors(False)
fitz.TOOLS.mupdf_display_warnings(False)
fitz.TOOLS.reset_mupdf_warnings()
pdf_path, output_dir, expected, contact_path = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
os.makedirs(output_dir, exist_ok=False)
doc = fitz.open(pdf_path)
pages = []
font_names = set()
for index, page in enumerate(doc):
    rect = page.rect
    scale = 1600.0 / max(rect.width, 1.0)
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    page_path = os.path.join(output_dir, f'slide-{index + 1:02d}.png')
    pix.save(page_path)
    pages.append({'slide': index + 1, 'path': page_path, 'width': pix.width, 'height': pix.height, 'bytes': os.path.getsize(page_path)})
    for block in page.get_text('dict').get('blocks', []):
        for line in block.get('lines', []):
            for span in line.get('spans', []):
                if span.get('text', '').strip():
                    font_names.add(span.get('font', ''))
if pages:
    thumbs = []
    for page in pages:
        image = Image.open(page['path']).convert('RGB')
        image.thumbnail((480, 270))
        tile = Image.new('RGB', (500, 300), 'white')
        tile.paste(image, ((500 - image.width) // 2, 8))
        ImageDraw.Draw(tile).text((12, 280), f"Slide {page['slide']}", fill='#222222')
        thumbs.append(tile)
    cols = 3
    rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * 500, rows * 300), '#d9dee5')
    for index, tile in enumerate(thumbs):
        sheet.paste(tile, ((index % cols) * 500, (index // cols) * 300))
    sheet.save(contact_path, quality=88)
print(json.dumps({'page_count': len(doc), 'expected_pages': expected, 'pages': pages, 'contact_sheet': contact_path if pages else None, 'rendered_fonts': sorted(name for name in font_names if name), 'fitz': fitz.VersionBind, 'pillow': Image.__version__ if hasattr(Image, '__version__') else 'available', 'mupdf_warnings': fitz.TOOLS.mupdf_warnings(), 'ok': len(doc) == expected and len(pages) == expected}, ensure_ascii=False))
`;

const COMPARE = String.raw`
import json, sys
from PIL import Image, ImageChops
old_dir, new_dir, slides = sys.argv[1], sys.argv[2], [int(value) for value in sys.argv[3].split(',') if value]
result = []
for slide in slides:
    old = Image.open(f'{old_dir}/slide-{slide:02d}.png').convert('RGB')
    new = Image.open(f'{new_dir}/slide-{slide:02d}.png').convert('RGB')
    same_size = old.size == new.size
    identical = same_size and ImageChops.difference(old, new).getbbox() is None
    result.append({'slide': slide, 'same_size': same_size, 'pixel_identical': identical, 'old_size': old.size, 'new_size': new.size})
print(json.dumps({'comparisons': result, 'ok': all(item['pixel_identical'] for item in result)}, ensure_ascii=False))
`;

function commandExists(name) {
  const result = spawnSync("which", [name], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env || process.env,
    encoding: "utf8",
    timeout: options.timeout || 5 * 60 * 1000,
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    status: result.status,
    error: result.error ? result.error.message : result.signal ? `terminated by ${result.signal}` : null,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function xmlEscape(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function discoverOfficeFontDirs() {
  const home = os.homedir();
  const appRoots = ["/Applications", path.join(home, "Applications")];
  const dirs = [];
  for (const appRoot of appRoots) {
    if (!fs.existsSync(appRoot)) continue;
    let entries = [];
    try { entries = fs.readdirSync(appRoot); } catch { continue; }
    for (const entry of entries) {
      if (!/^Microsoft (?:PowerPoint|Word|Excel).*\.app$/i.test(entry)) continue;
      const officeFonts = path.join(appRoot, entry, "Contents", "Resources", "DFonts");
      if (fs.existsSync(officeFonts) && fs.statSync(officeFonts).isDirectory()) dirs.push(officeFonts);
    }
  }
  const rank = (directory) => (/Microsoft PowerPoint/i.test(directory) ? 0 : /Microsoft Word/i.test(directory) ? 1 : 2);
  return [...new Set(dirs)].sort((left, right) => rank(left) - rank(right));
}

function privateFontConfig(taskDir, env = process.env) {
  const configPath = path.join(taskDir, "fonts.conf");
  const cacheDir = path.join(taskDir, "font-cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  const home = os.homedir();
  const officeFontDirs = discoverOfficeFontDirs();
  const explicitFontDirs = String(env.AIDEA_PPT_FONT_DIRS || "")
    .split(path.delimiter)
    .map((directory) => directory.trim())
    .filter(Boolean);
  const candidates = [
    ...officeFontDirs,
    ...explicitFontDirs,
    "/System/Library/Fonts",
    "/Library/Fonts",
    path.join(home, "Library", "Fonts"),
    "/usr/share/fonts",
    "/usr/local/share/fonts",
    path.join(home, ".local", "share", "fonts"),
    path.join(home, ".fonts"),
  ];
  const fontDirs = candidates.filter((directory, index) => fs.existsSync(directory) && candidates.indexOf(directory) === index);
  const dirsXml = fontDirs.map((directory) => `<dir>${xmlEscape(directory)}</dir>`).join("");
  const xml = `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig>${dirsXml}<cachedir>${xmlEscape(cacheDir)}</cachedir></fontconfig>`;
  fs.writeFileSync(configPath, xml, { flag: "wx" });
  return { configPath, cacheDir, fontDirs, officeFontDirs, explicitFontDirs: explicitFontDirs.filter((directory) => fontDirs.includes(directory)) };
}

function parseJson(stdout, label) {
  try {
    return JSON.parse(stdout.trim());
  } catch (error) {
    throw new Error(`${label} returned invalid JSON: ${error.message}; stdout=${stdout.slice(0, 1000)}`);
  }
}

function auditFonts(python, pptx, pdf, env, label) {
  const args = [path.join(__dirname, "font_audit.py"), pptx];
  if (pdf) args.push("--pdf", pdf);
  const auditRun = run(python, args, { env });
  if (auditRun.status !== 0 && !auditRun.stdout.trim()) {
    throw new Error(`${label} font audit failed: ${auditRun.stderr || auditRun.error || `exit ${auditRun.status}`}`);
  }
  const report = parseJson(auditRun.stdout, `${label} font audit`);
  if (!report.ok && auditRun.stderr) report.audit_stderr = auditRun.stderr.trim();
  return report;
}

function sha256(file) {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function renderSinglePptx({ pptx, expectedSlides, taskDir, python, soffice, env, label, prefix }) {
  const pdfDir = path.join(taskDir, `${prefix}-pdf`);
  const profileDir = path.join(taskDir, `${prefix}-libreoffice-profile`);
  const pagesDir = path.join(taskDir, `${prefix}-pages`);
  fs.mkdirSync(pdfDir, { recursive: false });
  fs.mkdirSync(profileDir, { recursive: false });
  const pdfPath = path.join(pdfDir, `${path.basename(pptx, path.extname(pptx))}.pdf`);
  const loProfileUri = pathToFileURL(profileDir).href;
  const convert = run(soffice, ["--headless", `-env:UserInstallation=${loProfileUri}`, "--convert-to", "pdf", "--outdir", pdfDir, pptx], { env });
  if (convert.status !== 0) throw new Error(`${label} LibreOffice conversion failed: ${convert.stderr || convert.error || `exit ${convert.status}`}`);
  if (!fs.existsSync(pdfPath) || !fs.statSync(pdfPath).isFile() || fs.statSync(pdfPath).size === 0) throw new Error(`${label} LibreOffice reported success without producing a PDF`);
  const contactSheet = path.join(taskDir, `${prefix}-contact-sheet.jpg`);
  const raster = run(python, ["-c", RASTERIZE, pdfPath, pagesDir, String(expectedSlides), contactSheet], { env });
  if (raster.status !== 0) throw new Error(`${label} PDF rasterization failed: ${raster.stderr || raster.error || `exit ${raster.status}`}`);
  const rasterReport = parseJson(raster.stdout, `${label} PDF rasterizer`);
  return {
    pdfPath,
    pdfSha256: sha256(pdfPath),
    rasterReport,
    convert,
    raster,
    pagesDir,
  };
}

function renderPptx({ pptx, sourcePptx = null, expectedSlides, taskDir, previewDir, targetSlides = [], preserveUntouched = false }) {
  const result = {
    command: "LibreOffice PPTX → PDF → per-slide PNG",
    ok: false,
    error: null,
    errors: [],
    python: null,
    libreoffice: null,
    fontconfig: null,
    font_audit: null,
    pdf_path: null,
    pdf_sha256: null,
    pdf_pages: 0,
    page_images: [],
    contact_sheet: null,
    previewDir,
    source_render: null,
    preservation: [],
    renderer_signature: null,
    render_logs: [],
    warnings: [],
  };
  try {
    const python = process.env.AIDEA_PPT_PYTHON || commandExists("python3");
    if (!python) throw new Error("python3 is unavailable for PDF page rendering");
    const soffice = process.env.AIDEA_PPT_SOFFICE || commandExists("soffice");
    if (!soffice) throw new Error("LibreOffice soffice is unavailable");
    const fontConfig = privateFontConfig(taskDir);
    const env = {
      ...process.env,
      FONTCONFIG_FILE: fontConfig.configPath,
      XDG_CACHE_HOME: taskDir,
    };
    result.python = run(python, ["--version"], { env }).stdout.trim();
    result.libreoffice = run(soffice, ["--version"], { env }).stdout.trim() || run(soffice, ["--version"], { env }).stderr.trim();
    result.fontconfig = { file: fontConfig.configPath, cache: fontConfig.cacheDir, search_dirs: fontConfig.fontDirs, office_dirs: fontConfig.officeFontDirs };

    result.font_audit = auditFonts(python, pptx, null, env, "Output environment");

    const output = renderSinglePptx({ pptx, expectedSlides, taskDir, python, soffice, env, label: "Output", prefix: "output" });
    result.pdf_path = output.pdfPath;
    result.pdf_sha256 = output.pdfSha256;
    result.font_audit_environment = result.font_audit;
    result.font_audit = auditFonts(python, pptx, output.pdfPath, env, "Output rendered PDF");
    if (!result.font_audit.ok) {
      const missing = result.font_audit.fonts
        .filter((font) => !font.rendered_pdf_match)
        .map((font) => `${font.requested} → ${(font.rendered_pdf_fonts || []).join(", ") || "not found in rendered PDF"}`);
      result.errors.push(`Requested fonts are not confirmed in rendered PDF: ${missing.join("; ")}`);
    }
    result.render_logs.push({ label: "output", convert_stdout: output.convert.stdout, convert_stderr: output.convert.stderr, raster_stdout: output.raster.stdout, raster_stderr: output.raster.stderr });
    const rasterReport = output.rasterReport;
    if (rasterReport.mupdf_warnings) result.warnings.push({ label: "output-pdf", source: "mupdf", text: rasterReport.mupdf_warnings });
    result.pdf_pages = rasterReport.page_count;
    result.page_images = rasterReport.pages.map((page) => ({ ...page, sha256: sha256(page.path) }));
    result.contact_sheet = rasterReport.contact_sheet;
    result.rendered_fonts = rasterReport.rendered_fonts;
    result.python_libraries = { pymupdf: rasterReport.fitz, pillow: rasterReport.pillow };
    if (!rasterReport.ok) result.errors.push(`Rendered page count mismatch: ${rasterReport.page_count}/${expectedSlides}`);
    if (!Array.isArray(result.page_images) || result.page_images.length !== expectedSlides) result.errors.push("One or more expected PNG page previews are missing");

    if (sourcePptx) {
      const sourceFontEnvironment = auditFonts(python, sourcePptx, null, env, "Source environment");
      const sourceSlides = getPptxSlideCount(sourcePptx);
      const source = renderSinglePptx({ pptx: sourcePptx, expectedSlides: sourceSlides, taskDir, python, soffice, env, label: "Source", prefix: "source" });
      result.source_font_audit_environment = sourceFontEnvironment;
      result.source_font_audit = auditFonts(python, sourcePptx, source.pdfPath, env, "Source rendered PDF");
      if (!result.source_font_audit.ok) result.errors.push("Source requested fonts are not confirmed in rendered PDF");
      if (source.rasterReport.mupdf_warnings) result.warnings.push({ label: "source-pdf", source: "mupdf", text: source.rasterReport.mupdf_warnings });
      result.source_render = {
        pptx: sourcePptx,
        sha256: sha256(sourcePptx),
        pdf_path: source.pdfPath,
        pdf_sha256: source.pdfSha256,
        page_count: source.rasterReport.page_count,
        pages: source.rasterReport.pages.map((page) => ({ ...page, sha256: sha256(page.path) })),
      };
      result.render_logs.push({ label: "source", convert_stdout: source.convert.stdout, convert_stderr: source.convert.stderr, raster_stdout: source.raster.stdout, raster_stderr: source.raster.stderr });
      if (source.rasterReport.page_count !== sourceSlides) result.errors.push(`Source page count mismatch: ${source.rasterReport.page_count}/${sourceSlides}`);
      const targetSet = new Set(targetSlides);
      const reviewSet = new Set(targetSlides.flatMap((slide) => [slide - 1, slide, slide + 1]));
      const untouched = preserveUntouched
        ? Array.from({ length: expectedSlides }, (_, index) => index + 1).filter((slide) => !reviewSet.has(slide))
        : [];
      const comparison = run(python, ["-c", COMPARE, source.pagesDir, output.pagesDir, untouched.join(",")], { env });
      if (untouched.length) {
        if (comparison.status !== 0) throw new Error(`Could not compare untouched pages to source: ${comparison.stderr || comparison.error}`);
        const compareReport = parseJson(comparison.stdout, "untouched page comparison");
        result.preservation = compareReport.comparisons;
        for (const item of result.preservation) {
          if (!item.pixel_identical) result.errors.push(`Untouched slide ${item.slide} differs from the source rendering`);
        }
      }
      for (const slide of reviewSet) {
        if (slide < 1 || slide > expectedSlides) continue;
        if (!result.page_images.some((page) => page.slide === slide)) result.errors.push(`Required review page ${slide} is not rendered`);
      }
    }

    const signaturePayload = {
      platform: `${process.platform}-${process.arch}`,
      python: result.python,
      pymupdf: rasterReport.fitz,
      pillow: rasterReport.pillow,
      libreoffice: result.libreoffice,
      fontconfig_dirs: fontConfig.fontDirs,
      fonts: result.font_audit.fonts.map((font) => ({ requested: font.requested, resolved: font.resolved_family, file: font.font_file, exact_match: font.exact_match, rendered_pdf_match: font.rendered_pdf_match })),
      source_fonts: result.source_font_audit?.fonts?.map((font) => ({ requested: font.requested, resolved: font.resolved_family, file: font.font_file, exact_match: font.exact_match, rendered_pdf_match: font.rendered_pdf_match })) || [],
    };
    const crypto = require("crypto");
    result.renderer_signature = crypto.createHash("sha256").update(JSON.stringify(signaturePayload)).digest("hex");
    result.renderer_signature_data = signaturePayload;
    result.previewDir = output.pagesDir;
    result.ok = result.errors.length === 0 && rasterReport.ok;
    return result;
  } catch (error) {
    result.error = error.message;
    result.errors.push(error.message);
    return result;
  }
}

function getPptxSlideCount(pptx) {
  const python = process.env.AIDEA_PPT_PYTHON || commandExists("python3");
  if (!python) return 0;
  const code = "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); print(sum(1 for n in z.namelist() if n.startswith('ppt/slides/slide') and n.endswith('.xml') and '/_rels/' not in n))";
  const result = run(python, ["-c", code, pptx]);
  return result.status === 0 ? Number(result.stdout.trim()) || 0 : 0;
}

module.exports = { renderPptx, privateFontConfig, discoverOfficeFontDirs };
