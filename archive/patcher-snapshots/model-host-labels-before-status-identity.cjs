'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const marker = '/* codex-model-host-labels-v1 */';
const appRoot = path.join(process.env.LOCALAPPDATA, 'Programs', 'Microsoft VS Code', 'a44adf7f53', 'resources', 'app');
const relativeFiles = ['out/vs/sessions/sessions.desktop.main.js', 'out/vs/workbench/workbench.desktop.main.js'];
const backupDir = path.join(__dirname, 'backup-a44adf7f53');
const manifestFile = path.join(backupDir, 'manifest.json');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const checksum = data => crypto.createHash('sha256').update(data).digest('base64').replace(/=+$/, '');
function replaceOnce(text, from, to) {
  if (text.split(from).length !== 2) throw new Error('Expected exactly one patch anchor: ' + from.slice(0, 90));
  return text.replace(from, to);
}
function transformBundle(source) {
  if (source.includes(marker)) throw new Error('Bundle already contains the patch.');
  const from = 'sourcePresentation:l}:r;t.push({identifier:a,metadata:c,provider:u,hidden:this.languageModelsService.isModelHidden(a)})';
  const to = 'sourcePresentation:l}:{...r};' + marker + '{const H=c.targetChatSessionType;if(H&&(H.startsWith("agent-host-")||H.startsWith("remote-"))){const L=u.vendor.displayName+(H.startsWith("agent-host-")?" [Local]":"");u.group={...u.group,name:c.modelGroup?u.group.name+" — "+L:L};u.sessionType=H}}t.push({identifier:a,metadata:c,provider:u,hidden:this.languageModelsService.isModelHidden(a)})';
  source = replaceOnce(source, from, to);
  return replaceOnce(source,
    'getProviderGroupId(e){return`${e.group.vendor}-${e.group.name}-${e.sourceId??"configured"}`}',
    'getProviderGroupId(e){return`${e.group.vendor}-${e.group.name}-${e.sourceId??"configured"}${e.sessionType?`-${e.sessionType}`:""}`}');
}
function atomicWrite(file, data) {
  const temp = file + '.model-host-labels.tmp';
  fs.writeFileSync(temp, data, { flag: 'wx' });
  try { fs.renameSync(temp, file); } catch (error) { fs.unlinkSync(temp); throw error; }
}
function verifyManifest(manifest, expected) {
  if (manifest.appRoot !== appRoot) throw new Error('Backup belongs to another installation.');
  for (const entry of manifest.files) {
    if (![...relativeFiles, 'product.json'].includes(entry.relative)) throw new Error('Unexpected backup path.');
    const data = fs.readFileSync(path.join(appRoot, entry.relative));
    if (sha(data) !== entry[expected]) throw new Error('File changed since patching; refusing to overwrite: ' + entry.relative);
  }
}
function main(mode) {
  if (!['--check', '--apply', '--undo'].includes(mode)) throw new Error('Usage: node patch.cjs --check | --apply | --undo');
  if (fs.existsSync(manifestFile)) {
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    if (manifest.state === 'applied') {
      verifyManifest(manifest, 'patchedHash');
      if (mode !== '--undo') { console.log('Patch is installed and all file hashes match.'); return; }
      const originals = manifest.files.map(entry => ({ entry, data: fs.readFileSync(path.join(backupDir, entry.relative)) }));
      for (const { entry, data } of originals) if (sha(data) !== entry.originalHash) throw new Error('Backup hash mismatch.');
      for (const { entry, data } of originals) atomicWrite(path.join(appRoot, entry.relative), data);
      manifest.state = 'restored';
      atomicWrite(manifestFile, JSON.stringify(manifest, null, 2));
      console.log('Original files restored. Reload VS Code to activate.');
      return;
    }
    verifyManifest(manifest, 'originalHash');
  }
  if (mode === '--undo') throw new Error('No applied patch to undo.');
  const version = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8')).version;
  if (version !== '1.136.1') throw new Error('This patch is only for VS Code 1.136.1 build a44adf7f53.');
  const productBefore = fs.readFileSync(path.join(appRoot, 'product.json'));
  let productText = productBefore.toString('utf8');
  const product = JSON.parse(productText);
  const changes = relativeFiles.map(relative => {
    const before = fs.readFileSync(path.join(appRoot, relative));
    const after = Buffer.from(transformBundle(before.toString('utf8')));
    const syntax = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: after, encoding: 'utf8' });
    if (syntax.status !== 0) throw new Error('Patched bundle failed syntax check: ' + syntax.stderr);
    const key = relative.slice(4);
    const oldValue = product.checksums[key];
    if (typeof oldValue !== 'string') throw new Error('Missing product checksum: ' + key);
    // Preserve all other product settings and existing local modifications.
    productText = replaceOnce(productText, JSON.stringify(oldValue), JSON.stringify(checksum(after)));
    return { relative, before, after };
  });
  changes.push({ relative: 'product.json', before: productBefore, after: Buffer.from(productText) });
  JSON.parse(productText);
  if (mode === '--check') { console.log('Both bundle anchors and syntax checks pass. Ready to apply to ' + appRoot); return; }
  fs.mkdirSync(backupDir, { recursive: true });
  const manifest = { appRoot, state: 'prepared', createdAt: new Date().toISOString(), files: changes.map(c => ({ relative: c.relative, originalHash: sha(c.before), patchedHash: sha(c.after) })) };
  for (const change of changes) {
    const backup = path.join(backupDir, change.relative);
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    if (fs.existsSync(backup)) {
      if (sha(fs.readFileSync(backup)) !== sha(change.before)) throw new Error('Existing backup differs.');
    } else fs.writeFileSync(backup, change.before, { flag: 'wx' });
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
  try {
    for (const change of changes) atomicWrite(path.join(appRoot, change.relative), change.after);
    manifest.state = 'applied';
    atomicWrite(manifestFile, JSON.stringify(manifest, null, 2));
    verifyManifest(manifest, 'patchedHash');
  } catch (error) {
    for (const change of changes) atomicWrite(path.join(appRoot, change.relative), change.before);
    manifest.state = 'restored';
    atomicWrite(manifestFile, JSON.stringify(manifest, null, 2));
    throw error;
  }
  console.log('Applied host labels to both VS Code windows. Backups: ' + backupDir + '\nUse Developer: Reload Window when ready.');
}
module.exports = { transformBundle, appRoot, relativeFiles };
if (require.main === module) {
  try { main(process.argv[2] || '--check'); } catch (e) { console.error(e.message); process.exitCode = 1; }
}
