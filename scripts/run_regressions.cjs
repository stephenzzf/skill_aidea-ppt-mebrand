#!/usr/bin/env node
// Automated generation/render checks only. This runner never signs review receipts.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'me2026-regression-'));
const {ME2026_ICON_LIBRARY} = require('./brand_ppt_helpers.cjs');
const cases = [['smoke',5],['realistic',8],['teemo',8],['eclick',8],['ai-capability',10],['video-localization',16],['component-catalog',6],['icon-catalog',Math.ceil(Object.keys(ME2026_ICON_LIBRARY).length/20)]];
const report = {schema_version:1, scope:'automated generation, structure, editability and rendering; content and visual acceptance remain separate', output, started_at:new Date().toISOString(), cases:[]};
let failed = false;
function run(name,args,dir) {
 const start = Date.now();
 const result = spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024});
 fs.writeFileSync(path.join(dir,`${name}.log`),(result.stdout||'')+(result.stderr||''));
 return {exit_code:result.status,signal:result.signal,error:result.error?.message,elapsed_ms:Date.now()-start};
}
for (const [scenario,count] of cases) {
 const dir=path.join(output,scenario);fs.mkdirSync(dir);
 const pptx=path.join(dir,'deck.pptx');
 const generation=run('generate',['scripts/generate_me2026_deck.cjs','--scenario',scenario,'--out',pptx],dir);
 const entry={scenario,expected_slides:count,generation};
 if(generation.exit_code!==0 || generation.signal || generation.error){failed=true;report.cases.push(entry);continue;}
 const args=['scripts/qa_me2026.cjs','--pptx',pptx,'--ledger',path.join(dir,'qa.json'),'--preview-dir',path.join(dir,'preview'),'--write-review-template',path.join(dir,'review-template.json')];
 args.push('--slides',String(count));
 if(scenario!=='icon-catalog') args.push('--allow-fullslide',`1,2,${count}`,'--page-role','1:cover','--page-role','2:index','--page-role',`${count}:closing`,'--required-text','黏贴个人联系方式');
 // The icon catalog is a body-only appendix, with no closing contact page.
 if(scenario==='icon-catalog') args.push('--required-text','ME2026');
 entry.qa=run('qa',args,dir);
 const ledger=path.join(dir,'qa.json');
 let result;
 if(fs.existsSync(ledger)){entry.ledger=ledger;result=JSON.parse(fs.readFileSync(ledger,'utf8'));entry.categories=result.categories;}
 entry.automated_ok=[0,2].includes(entry.qa.exit_code)&&!entry.qa.signal&&!entry.qa.error&&['structure','editability','render'].every(key=>result?.categories?.[key]?.status==='pass');
 if(!entry.automated_ok) failed=true;
 report.cases.push(entry);
 console.log(`${scenario}: generate=${generation.exit_code}, qa=${entry.qa.exit_code} (2 = review incomplete)`);
 fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(report,null,2)+'\n');
}
report.finished_at=new Date().toISOString();report.automated_status=failed?'fail':'pass';report.final_acceptance='not_run';
fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(report,null,2)+'\n');
console.log(`Regression evidence: ${output}`);
process.exitCode=failed?1:0;
