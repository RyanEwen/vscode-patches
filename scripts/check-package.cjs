const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'catalog.json'),'utf8'));
const files=[];
function walk(dir){for(const d of fs.readdirSync(dir,{withFileTypes:true})){if(d.name==='.git'||d.name==='.local'||d.name.startsWith('backup'))continue;const p=path.join(dir,d.name);if(d.isDirectory())walk(p);else files.push(p);}}walk(root);
let syntax=0;
for(const f of files){
 const data=fs.readFileSync(f,'utf8');
 const secretPatterns=[/gh[pousr]_[A-Za-z0-9]{30,}/,/github_pat_[A-Za-z0-9_]{40,}/,/sk-(?:ant|proj)-[A-Za-z0-9_-]{25,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];
 assert(!secretPatterns.some(r=>r.test(data)),'Potential credential in '+path.relative(root,f));
 if(/\.(?:mjs|cjs)$/.test(f)) {execFileSync(process.execPath,['--check',f],{stdio:'pipe'});syntax++;}
 if(f.includes('patcher-snapshots')) {execFileSync(process.execPath,['--input-type=module','--check'],{input:data,stdio:['pipe','pipe','pipe']});syntax++;}
}
assert.equal(new Set(catalog.fixes.map(f=>f.id)).size,catalog.fixes.length);
for(const f of catalog.fixes) assert(fs.existsSync(path.join(root,'docs/fixes',f.id+'.md')),'Missing individual doc '+f.id);
for(const file of files.filter(f=>f.endsWith('.md'))) {
 const content=fs.readFileSync(file,'utf8');
 for(const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
  const link=match[1]; if(/^[a-z]+:|^#/i.test(link))continue;
  const target=decodeURIComponent(link.split('#')[0]);
  assert(fs.existsSync(path.resolve(path.dirname(file),target)),'Broken doc link: '+path.relative(root,file)+' -> '+link);
 }
}
const vm=require('node:vm');
const verifier=fs.readFileSync(path.join(root,'verify-vscode-patches.mjs'),'utf8');
const fixtureLiteral=verifier.match(/const HAS_CONVO_FIXTURE = (`[\s\S]*?`);/)[1];
const fixture=vm.runInNewContext(fixtureLiteral);
let fixtureResult;
vm.runInNewContext(fixture,{require,process:{env:{}},console:{log:value=>fixtureResult=JSON.parse(value)}});
assert(fixtureResult.every(([,actual,expected])=>actual===expected),'Resume fixture regression');
for(const p of catalog.prs){const f=path.join(root,'source-patches',p.repo.split('/')[1],p.number+'.patch');assert(fs.readFileSync(f,'utf8').includes('diff --git'),'Missing patch '+p.url);assert(fs.existsSync(path.join(root,'docs/patches',p.repo.split('/')[1]+'-'+p.number+'.md')));}
const listed=JSON.parse(execFileSync(process.execPath,[path.join(root,'patch-vscode-fixes.mjs'),'--list'],{encoding:'utf8'}));
assert.deepEqual(listed,catalog.fixes.map(({id,target,title})=>({id,target,title})));
console.log(`PASS: ${syntax} JavaScript files/snapshots parse; ${catalog.fixes.length} unique catalog entries; ${catalog.prs.length} source patches and detail pages; known-secret scan clean.`);
