/* Pure helpers for the visual editor. No credentials or browser storage. */
(function(root,factory){'use strict';const core=factory();if(typeof module==='object'&&module.exports)module.exports=core;else root.WebsiteEditorCore=core;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const PAGES=['index.html','stories.html','publications.html','synthesis.html','characterization.html','softwares.html','colorimetry.html','plqy.html','resume.html'];
  const enc=new TextEncoder();
  const bytes=value=>typeof value==='string'?enc.encode(value):value;
  function allowedPath(path){return PAGES.includes(path)||path==='publications.json'||/^assets\/uploads\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|gif|avif)$/.test(path);}
  async function blobHash(value,cryptoAPI=globalThis.crypto){const data=bytes(value),header=enc.encode('blob '+data.length+'\0'),all=new Uint8Array(header.length+data.length);all.set(header);all.set(data,header.length);return Array.from(new Uint8Array(await cryptoAPI.subtle.digest('SHA-1',all)),n=>n.toString(16).padStart(2,'0')).join('');}
  function base64(value){const data=bytes(value);let s='';for(let i=0;i<data.length;i+=8192)s+=String.fromCharCode.apply(null,data.subarray(i,i+8192));return btoa(s);}
  async function publish({request,changes,baselines,message,onProgress=()=>{}}){
    const prefix='/repos/varnaresh17/varnaresh17.github.io';
    const paths=Object.keys(changes);if(!paths.length)throw Error('There are no changes to publish.');
    for(const path of paths)if(!allowedPath(path))throw Error('The editor cannot publish this file: '+path);
    onProgress('Checking the current website version…');
    const ref=await request(prefix+'/git/ref/heads/main');
    const head=ref.object.sha,commit=await request(prefix+'/git/commits/'+head);
    const remote=await request(prefix+'/git/trees/'+commit.tree.sha+'?recursive=1');
    if(remote.truncated)throw Error('The repository file list is incomplete. Download your changes and ask for help publishing.');
    const treeMap=new Map(remote.tree.map(e=>[e.path,e.sha]));
    for(const path of paths){
      const expected=baselines[path];
      if(expected&&treeMap.get(path)!==expected)throw Error('Another update changed '+path+'. Your draft is safe. Download it, then reload the editor before publishing.');
      if(!expected&&treeMap.has(path))throw Error('A file already exists at '+path+'. Download your draft and reload the editor.');
    }
    const entries=[];
    for(const path of paths){
      const value=changes[path];
      if(typeof value==='string')entries.push({path,mode:'100644',type:'blob',content:value});
      else{onProgress('Uploading '+path.split('/').pop()+'…');const blob=await request(prefix+'/git/blobs',{method:'POST',body:{content:base64(value),encoding:'base64'}});entries.push({path,mode:'100644',type:'blob',sha:blob.sha});}
    }
    onProgress('Saving the website update…');
    const tree=await request(prefix+'/git/trees',{method:'POST',body:{base_tree:commit.tree.sha,tree:entries}});
    const next=await request(prefix+'/git/commits',{method:'POST',body:{message:message||'Update website with visual editor',tree:tree.sha,parents:[head]}});
    // force:false rejects an intervening update instead of overwriting it.
    await request(prefix+'/git/refs/heads/main',{method:'PATCH',body:{sha:next.sha,force:false}});
    return {sha:next.sha,url:'https://github.com/varnaresh17/varnaresh17.github.io/commit/'+next.sha,files:paths};
  }
  function crc32(data){let crc=0xffffffff;for(const b of data){crc^=b;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
  function zip(files){
    const parts=[],central=[];let offset=0,centralLength=0;
    function view(n){const a=new Uint8Array(n);return[a,new DataView(a.buffer)];}
    for(const file of files){
      if(file.path.startsWith('/')||file.path.split('/').includes('..'))throw Error('Invalid archive path.');
      const name=enc.encode(file.path),data=bytes(file.content),crc=crc32(data);
      const [local,l]=view(30+name.length);l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x800,true);l.setUint16(12,33,true);l.setUint32(14,crc,true);l.setUint32(18,data.length,true);l.setUint32(22,data.length,true);l.setUint16(26,name.length,true);local.set(name,30);parts.push(local,data);
      const [record,c]=view(46+name.length);c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(14,33,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);record.set(name,46);central.push(record);centralLength+=record.length;offset+=local.length+data.length;
    }
    const [end,e]=view(22);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,centralLength,true);e.setUint32(16,offset,true);
    const output=new Uint8Array(offset+centralLength+end.length);let p=0;for(const a of [...parts,...central,end]){output.set(a,p);p+=a.length;}return output;
  }
  return {PAGES,allowedPath,blobHash,publish,zip,crc32,base64};
});
