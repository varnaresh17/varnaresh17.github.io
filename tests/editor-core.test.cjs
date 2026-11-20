'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const crypto=require('node:crypto').webcrypto;
const fs=require('node:fs');
const core=require('../editor-core.js');

test('The preview can execute only the explicitly hashed editor bridge',()=>{
  const bridge=fs.readFileSync(require.resolve('../editor-bridge.js'));
  const hash=require('node:crypto').createHash('sha256').update(bridge).digest('base64');
  const html=fs.readFileSync(require.resolve('../editor.html'),'utf8');
  assert.ok(html.includes("'sha256-"+hash+"'"));assert.ok(html.includes('sandbox="allow-scripts"'));assert.ok(!html.includes('allow-same-origin'));
});

test('Git baseline hashes match Git for Unicode and binary content',async()=>{
  for(const value of ['Naresh · CsPbBr₃\n',new Uint8Array([0,1,128,255])]){
    const expected=execFileSync('git',['hash-object','--stdin'],{input:typeof value==='string'?value:Buffer.from(value),encoding:'utf8'}).trim();
    assert.equal(await core.blobHash(value,crypto),expected);
  }
});
test('ZIP exports preserve Unicode text, paths and exact image bytes',()=>{
  const archive=core.zip([{path:'index.html',content:'<h1>Naresh · Φ = 80%</h1>'},{path:'assets/uploads/α.png',content:new Uint8Array([0,1,128,255])}]);
  const script="import sys,zipfile,io; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); assert z.testzip() is None; assert z.read('index.html').decode() == '<h1>Naresh · Φ = 80%</h1>'; assert z.read('assets/uploads/α.png') == bytes([0,1,128,255]); print('valid')";
  assert.equal(execFileSync('python3',['-c',script],{input:archive,encoding:'utf8'}).trim(),'valid');
});
function fakeServer({conflict=false,race=false}={}){
  const calls=[];
  const request=async(path,options={})=>{
    calls.push({path,...options});
    if(path.endsWith('/git/ref/heads/main'))return {object:{sha:'old-head'}};
    if(path.endsWith('/git/commits/old-head'))return {tree:{sha:'original-tree'}};
    if(path.includes('/git/trees/original-tree'))return {tree:[{path:'index.html',sha:conflict?'someone-elses-edit':'original-html'}],truncated:false};
    if(path.endsWith('/git/blobs'))return {sha:'new-image'};
    if(path.endsWith('/git/trees'))return {sha:'new-tree'};
    if(path.endsWith('/git/commits'))return {sha:'new-commit'};
    if(path.endsWith('/git/refs/heads/main')){if(race)throw Error('Non-fast-forward update rejected');return {};}
    throw Error('Unexpected request: '+path);
  };return {request,calls};
}
test('A visual update preserves the remote tree and publishes one atomic commit',async()=>{
  const server=fakeServer();const result=await core.publish({request:server.request,changes:{'index.html':'edited','assets/uploads/photo.png':new Uint8Array([0,255])},baselines:{'index.html':'original-html'},message:'My photo update'});
  assert.equal(result.sha,'new-commit');
  const tree=server.calls.find(c=>c.path.endsWith('/git/trees'));
  assert.equal(tree.body.base_tree,'original-tree');assert.deepEqual(tree.body.tree.map(e=>e.path),['index.html','assets/uploads/photo.png']);
  const commit=server.calls.find(c=>c.path.endsWith('/git/commits'));
  assert.deepEqual(commit.body.parents,['old-head']);assert.equal(commit.body.message,'My photo update');
  const update=server.calls.at(-1);assert.equal(update.method,'PATCH');assert.equal(update.body.force,false);
});
test('Conflicting edits are rejected before creating blobs or commits',async()=>{
  const server=fakeServer({conflict:true});await assert.rejects(core.publish({request:server.request,changes:{'index.html':'edited'},baselines:{'index.html':'original-html'}}),/Another update changed/);
  assert.equal(server.calls.filter(c=>c.method).length,0);
});
test('A race at the final branch update is surfaced without a force push',async()=>{
  const server=fakeServer({race:true});await assert.rejects(core.publish({request:server.request,changes:{'index.html':'edited'},baselines:{'index.html':'original-html'}}),/Non-fast-forward/);
  assert.equal(server.calls.at(-1).body.force,false);
});
test('Publishing is limited to editorial pages, publication data and new raster images',async()=>{
  for(const path of ['.github/workflows/steal.yml','editor.js','assets/uploads/photo.svg','../index.html','https://example.com']){
    const server=fakeServer();await assert.rejects(core.publish({request:server.request,changes:{[path]:'changed'},baselines:{}}),/cannot publish/);assert.equal(server.calls.length,0);
  }
});


test('Visual resize dimensions stay numeric and within the publishing limits',()=>{
  const style=core.resizeStyles(367.4,279.2);
  assert.equal(style.width,'367px');assert.equal(style.height,'279px');
  assert.equal(style['max-width'],'none');assert.equal(style['min-height'],'0px');assert.equal(style['aspect-ratio'],'auto');
  for(const pair of [[0,10],[10,3001],[NaN,10],[Infinity,10],['100%',10],[null,10]])assert.equal(core.resizeStyles(...pair),null);
});
