const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {transformBundle, appRoot, relativeFiles} = require('./patch.cjs');
function makeModel(source, service) {
  const start = source.indexOf('addVendorModels(e){');
  const end = source.indexOf('refreshVisibility(){', start);
  const groupStart = source.indexOf('getProviderGroupId(e){return', end);
  const groupEnd = source.indexOf('toggleCollapsed(', groupStart);
  assert(start > 0 && end > start && groupStart > end && groupEnd > groupStart);
  const body = source.slice(start,end);
  const canHide = body.match(/!c\|\|!(\w+)\(a,c\)/)[1];
  const registry = body.match(/sourceId\?(\w+)\.get/)[1];
  const display = body.match(/label\?\?(\w+)\(this/)[1];
  const isGroup = body.match(/getModelsForGroup\(e\)\{return (\w+)\(e\)/)[1];
  const modelClass = new Function(canHide,registry,display,isGroup, 'return class { constructor(s){this.languageModelsService=s;this.languageModels=[];this.languageModelGroupStatuses=[]}' + source.slice(start,end) + source.slice(groupStart,groupEnd) + '}')(
    () => true, {get: () => ({label:'ChatGPT',icon:'account',description:'Subscription'})}, () => 'ChatGPT', () => true);
  return new modelClass(service);
}
for (const relative of relativeFiles) {
  const backup = path.join(__dirname,'backup-a44adf7f53',relative);
  const before = fs.readFileSync(fs.existsSync(backup) ? backup : path.join(appRoot,relative),'utf8');
  const after = transformBundle(before);
  for (const grouped of [true,false]) {
    const local='agent-host-codex', remote='remote-hex-77736c3a5562756e7475-codex';
    const vendors=[{vendor:local,displayName:'Codex'},{vendor:remote,displayName:'Codex [WSL: Ubuntu]'}];
    const metadata=new Map();
    const groups=new Map(vendors.map(v=>[v.vendor,[{group:{vendor:v.vendor,name:v.displayName},modelIdentifiers:['a','b'].map(id=>v.vendor+':'+id)}]]));
    for (const v of vendors) for (const id of ['a','b']) metadata.set(v.vendor+':'+id,{vendor:v.vendor,targetChatSessionType:v.vendor,id,name:id,modelGroup:grouped?{id:'chatgpt',sourceId:'subscription'}:undefined});
    const calls=[];
    const service={getLanguageModelGroups:v=>groups.get(v),lookupLanguageModel:id=>metadata.get(id),isModelHidden:()=>false,setModelsHidden:(ids,hidden)=>calls.push({ids,hidden})};
    const oldModel=makeModel(before,service), newModel=makeModel(after,service);
    for (const v of vendors) {oldModel.addVendorModels(v);newModel.addVendorModels(v);}
    assert.equal(newModel.languageModels.length,4);
    assert.equal(new Set(newModel.languageModels.map(m=>newModel.getProviderGroupId(m.provider))).size,2);
    if(grouped) assert.equal(new Set(oldModel.languageModels.map(m=>oldModel.getProviderGroupId(m.provider))).size,1,'Original bundle reproduces the merged host groups');
    const expected=grouped?['ChatGPT — Codex [Local]','ChatGPT — Codex [WSL: Ubuntu]']:['Codex [Local]','Codex [WSL: Ubuntu]'];
    assert.deepEqual([...new Set(newModel.languageModels.map(m=>m.provider.group.name))],expected);
    const localGroup={id:newModel.getProviderGroupId(newModel.languageModels[0].provider),hidden:false};
    newModel.toggleGroupHidden(localGroup);
    assert.deepEqual(calls,[{ids:[local+':a',local+':b'],hidden:true}]);
    assert.equal(groups.get(local)[0].group.name,'Codex','Service-owned group must remain unchanged');
    assert.equal(newModel.languageModels[0].identifier,local+':a');
  }
  assert.throws(()=>transformBundle(after),/already contains/);
  console.log('PASS: '+relative+' (original reproduces bug; patched labels, host identity, visibility isolation, immutability, and reapply guard)');
}
