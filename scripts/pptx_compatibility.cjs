// Narrow fixes for PptxGenJS 4.0.1 serialization defects. This is not a
// general OOXML repair engine; unknown broken references remain QA failures.
const fs = require('fs');
const path = require('path').posix;
const JSZip = require('jszip');

function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
}

function uniqueObjectIds(xml, part, changes) {
  const tags = [...xml.matchAll(/<p:cNvPr\b[^>]*>/g)];
  let next = Math.max(0, ...tags.map(t => Number(attribute(t[0], 'id')) || 0)) + 1;
  const seen = new Set();
  return xml.replace(/<p:cNvPr\b[^>]*>/g, tag => {
    const id = attribute(tag, 'id');
    if (!seen.has(id)) { seen.add(id); return tag; }
    // A connector referencing a duplicate ID is ambiguous. Do not guess its target.
    const connection = new RegExp(`<a:(?:stCxn|endCxn)\\b[^>]*\\bid="${id}"`);
    if (connection.test(xml)) throw new Error(`Ambiguous duplicate object ID ${id} in ${part}`);
    const replacement = String(next++);
    changes.push({ code: 'duplicate-object-id', part, old: id, replacement });
    return tag.replace(/\bid="[^"]*"/, `id="${replacement}"`);
  });
}

function chartAxes(xml, part, changes) {
  const defined = new Set([...xml.matchAll(/<c:(?:catAx|valAx|dateAx|serAx)\b[^>]*>\s*<c:axId\b[^>]*\bval="([^"]+)"/g)].map(m => m[1]));
  return xml.replace(/<c:(barChart|lineChart)\b[^>]*>[\s\S]*?<\/c:\1>/g, block => {
    const ids = [...block.matchAll(/<c:axId\b[^>]*\bval="([^"]+)"[^>]*\/>/g)].map(m => m[1]);
    if (ids.filter(id => defined.has(id)).length !== 2) return block;
    return block.replace(/<c:axId\b[^>]*\bval="([^"]+)"[^>]*\/>/g, (tag, id) => {
      if (defined.has(id)) return tag;
      changes.push({ code: 'orphan-2d-chart-axis', part, axis: id });
      return '';
    });
  });
}

async function separateNotesTheme(zip, changes) {
  const slideThemes = new Set();
  const resolve = (part, target) => target.startsWith('/')
    ? path.normalize(target.slice(1))
    : path.normalize(path.join(path.dirname(path.dirname(part)), target));
  for (const part of Object.keys(zip.files).filter(n => /^ppt\/slideMasters\/_rels\/.*\.rels$/.test(n))) {
    const xml = await zip.file(part).async('string');
    for (const match of xml.matchAll(/<Relationship\b[^>]*\/>/g)) {
      if (attribute(match[0], 'Type')?.endsWith('/theme')) slideThemes.add(resolve(part, attribute(match[0], 'Target')));
    }
  }
  for (const part of Object.keys(zip.files).filter(n => /^ppt\/notesMasters\/_rels\/.*\.rels$/.test(n))) {
    const xml = await zip.file(part).async('string');
    let updated = xml;
    for (const match of xml.matchAll(/<Relationship\b[^>]*\/>/g)) {
      if (!attribute(match[0], 'Type')?.endsWith('/theme')) continue;
      const shared = resolve(part, attribute(match[0], 'Target'));
      if (!slideThemes.has(shared) || !zip.file(shared)) continue;
      let number = 2;
      while (zip.file(`ppt/theme/theme${number}.xml`)) number++;
      const target = `ppt/theme/theme${number}.xml`;
      zip.file(target, await zip.file(shared).async('nodebuffer'));
      const relative = path.relative(path.dirname(path.dirname(part)), target);
      updated = updated.replace(match[0], match[0].replace(/\bTarget="[^"]*"/, `Target="${relative}"`));
      const ct = await zip.file('[Content_Types].xml').async('string');
      zip.file('[Content_Types].xml', ct.replace('</Types>', `<Override PartName="/${target}" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/></Types>`));
      changes.push({ code: 'shared-notes-theme', part, source: shared, replacement: target });
    }
    if (updated !== xml) zip.file(part, updated);
  }
}

async function workbookRanges(data, part, changes, compression) {
  const book = await JSZip.loadAsync(data);
  let changed = false;
  for (const name of Object.keys(book.files).filter(n => /^xl\/tables\/[^/]+\.xml$/.test(n))) {
    const xml = await book.file(name).async('string');
    // Correct only the known trailing apostrophe defect, never arbitrary bad refs.
    const updated = xml.replace(/\bref="(\$?[A-Z]+\$?[1-9]\d*(?::\$?[A-Z]+\$?[1-9]\d*)?)'"/g, (tag, range) => {
      changes.push({ code: 'xlsx-table-range', part: `${part}!/${name}`, old: `${range}'`, replacement: range });
      changed = true;
      return `ref="${range}"`;
    });
    if (updated !== xml) book.file(name, updated);
  }
  return changed ? book.generateAsync({ type: 'nodebuffer', compression }) : data;
}

async function normalizePptx(data, { compression = false } = {}) {
  const zip = await JSZip.loadAsync(data);
  const changes = [], compressionName = compression ? 'DEFLATE' : 'STORE';
  const contentTypes = zip.file('[Content_Types].xml');
  if (!contentTypes) throw new Error('PPTX is missing [Content_Types].xml');
  const xml = await contentTypes.async('string');
  const updated = xml.replace(/<Override\b[^>]*\/>/g, tag => {
    const name = attribute(tag, 'PartName');
    if (!/^\/ppt\/slideMasters\/slideMaster\d+\.xml$/.test(name || '') || zip.file(name.slice(1))) return tag;
    changes.push({ code: 'phantom-master-override', part: '[Content_Types].xml', target: name });
    return '';
  });
  if (xml !== updated) zip.file('[Content_Types].xml', updated);
  await separateNotesTheme(zip, changes);
  for (const part of Object.keys(zip.files).filter(n => /^ppt\/.*\.xml$/.test(n))) {
    let text = await zip.file(part).async('string');
    const original = text;
    text = uniqueObjectIds(text, part, changes);
    text = text.replace(/<a:(?:tcPr|bodyPr)\b[^>]*\banchor="mid"[^>]*>/g, tag => {
      changes.push({ code: 'invalid-text-anchor', part, old: 'mid', replacement: 'ctr' });
      return tag.replace('anchor="mid"', 'anchor="ctr"');
    });
    if (part === 'ppt/presentation.xml') {
      // CT_Presentation orders notesMasterIdLst before sldIdLst (ECMA-376).
      const notes = text.match(/<p:notesMasterIdLst\b[^>]*>[\s\S]*?<\/p:notesMasterIdLst>/)?.[0];
      if (notes && text.indexOf('<p:sldIdLst') >= 0 && text.indexOf(notes) > text.indexOf('<p:sldIdLst')) {
        text = text.replace(notes, '').replace(/<p:(?:handoutMasterIdLst|sldIdLst|sldSz)\b/, `${notes}$&`);
        changes.push({ code: 'presentation-child-order', part });
      }
    }
    if (/^ppt\/charts\/chart\d+\.xml$/.test(part)) text = chartAxes(text, part, changes);
    if (text !== original) zip.file(part, text);
  }
  for (const part of Object.keys(zip.files).filter(n => /^ppt\/embeddings\/.*\.xlsx$/.test(n))) {
    const original = await zip.file(part).async('nodebuffer');
    const fixed = await workbookRanges(original, part, changes, compressionName);
    if (fixed !== original) zip.file(part, fixed);
  }
  return { data: changes.length ? await zip.generateAsync({ type: 'nodebuffer', compression: compressionName }) : data, changes };
}

function outputBuffer(data, type) {
  switch (type) {
    case 'STREAM': case 'nodebuffer': return data;
    case 'arraybuffer': return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    case 'uint8array': return new Uint8Array(data);
    case 'base64': return data.toString('base64');
    case 'binarystring': case 'string': return data.toString('binary');
    case 'blob': case undefined: case null: return new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
    default: throw new Error(`Unsupported PPTX output type: ${type}`);
  }
}

function installCompatibility(pptx) {
  // Pinned PptxGenJS routes write(), writeFile() and stream() through this one
  // instance boundary. Do not modify bundled or globally installed dependencies.
  const exportPresentation = pptx.exportPresentation.bind(pptx);
  pptx.exportPresentation = async (props = {}) => {
    const raw = await exportPresentation({ ...props, outputType: 'nodebuffer' });
    const result = await normalizePptx(raw, { compression: props.compression });
    pptx.meCompatibilityReport = { schema_version: 1, changes: result.changes };
    return outputBuffer(result.data, props.outputType);
  };
  return pptx;
}

module.exports = { normalizePptx, installCompatibility };

if (require.main === module) {
  (async () => {
    const [input, output] = process.argv.slice(2);
    if (!input || !output || input === output) throw new Error('Usage: pptx_compatibility.cjs input.pptx separate-output.pptx');
    const result = await normalizePptx(fs.readFileSync(input));
    fs.writeFileSync(output, result.data, { flag: 'wx' });
    console.log(JSON.stringify({ output, changes: result.changes }, null, 2));
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}
