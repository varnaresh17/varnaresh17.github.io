(function(){
  'use strict';
  const Core=window.WebsiteEditorCore,$=id=>document.getElementById(id),OWNER='varnaresh17',REPO='varnaresh17.github.io',PREFIX='/repos/'+OWNER+'/'+REPO;
  const labels={'index.html':'Home','research.html':'Research','expertise.html':'Technical Expertise','experience.html':'Experience','achievements.html':'Achievements','contact.html':'Contact','stories.html':'Research stories','publications.html':'Publications','synthesis.html':'Synthesis','characterization.html':'Characterization','softwares.html':'Tools overview','xrd.html':'XRD calculators','ftir.html':'FTIR interpreter','colorimetry.html':'Colorimetry','plqy.html':'PLQY / PLQE','resume.html':'CV'};
  const frame=$('preview'),channel=crypto.randomUUID(),pageParam=new URLSearchParams(location.search).get('page');
  const localMode=['127.0.0.1','localhost'].includes(location.hostname)&&new URLSearchParams(location.search).get('local')==='1';
  const siteBase=new URL('./',location.href).href;
  const state={pages:new Map(),assets:{},json:null,jsonSource:'',jsonBaseline:null,jsonDirty:false,current:Core.PAGES.includes(pageParam)?pageParam:'index.html',selected:null,undo:[],redo:[],busy:false,loaded:false,savedDraft:null,lastTransaction:'',lastTime:0};
  let publishingToken='',dbPromise,draftTimer,saveGeneration=0,pollTimer,renderGeneration=0;
  const previewCache=new Map();
  function cachedPreview(url,mode='text'){
    const key=mode+':'+url;
    if(!previewCache.has(key))previewCache.set(key,(async()=>{const response=await fetch(url,{credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('A preview asset could not be opened. Reload the editor.');if(mode==='text')return response.text();return 'data:'+(response.headers.get('content-type')||'image/png').split(';')[0]+';base64,'+Core.base64(new Uint8Array(await response.arrayBuffer()));})());
    return previewCache.get(key);
  }
  function status(text,error=false){$('status').textContent=text;document.querySelector('.statusbar').classList.toggle('error-state',error);}
  function showHelp(title,message){$('help-title').textContent=title;$('help-message').textContent=message;$('help-dialog').showModal();}
  function parse(text){return new DOMParser().parseFromString(text,'text/html');}
  function serialize(doc){return '<!doctype html>\n'+doc.documentElement.outerHTML+'\n';}
  const textTags=new Set(['H1','H2','H3','H4','H5','H6','P','FIGCAPTION','DT','DD','SMALL','SUMMARY','SPAN','LI','A','TIME','BLOCKQUOTE','STRONG','B','EM','I','SUB','SUP']);
  const blockTags=new Set(['HEADER','NAV','FOOTER','SECTION','ARTICLE','ASIDE','FIGURE','DIV','UL','OL','DETAILS','MAIN']);
  const protectedSelector='form,svg,script,style,pre,code,canvas,math,.publication-full-citation,[role="status"],[role="alert"],output';
  function kindOf(el){if(el.tagName==='IMG')return 'image';if(textTags.has(el.tagName)&&!el.querySelector('svg,img,input,select,textarea,button,section,article,div,p,ul,ol'))return 'text';return 'block';}
  function buildMap(page){
    const nodes=[...page.doc.querySelectorAll('body *')].filter(el=>!el.closest(protectedSelector)&&el.getAttribute('aria-hidden')!=='true'&&(el.tagName==='IMG'||textTags.has(el.tagName)||blockTags.has(el.tagName))&&!['SCRIPT','STYLE'].includes(el.tagName));
    page.map=new Map(nodes.map((el,i)=>['e'+i,el]));
  }
  function page(){return state.pages.get(state.current);}
  function selected(){return state.selected&&page()?.map.get(state.selected);}
  function safeLink(value){const v=String(value).trim();if(!v)return '';const u=new URL(v,siteBase);if(!['http:','https:','mailto:','tel:'].includes(u.protocol))throw Error('Use a website address, email link, phone link, or a relative page link.');return v;}
  function sanitizeHTML(value){
    const template=document.createElement('template');template.innerHTML=String(value);
    const allowed=new Set(['B','STRONG','I','EM','U','BR','SUB','SUP','SPAN','A']);
    function clean(parent){for(const child of [...parent.childNodes]){
      if(child.nodeType===Node.COMMENT_NODE){child.remove();continue;}
      if(child.nodeType!==Node.ELEMENT_NODE)continue;
      if(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','IMG','SVG','MATH','FORM','INPUT'].includes(child.tagName)){child.remove();continue;}
      clean(child);
      if(!allowed.has(child.tagName)){
        const fragment=document.createDocumentFragment();while(child.firstChild)fragment.appendChild(child.firstChild);
        if(['DIV','P'].includes(child.tagName))fragment.appendChild(document.createElement('br'));
        child.replaceWith(fragment);continue;
      }
      for(const attr of [...child.attributes]){
        if(child.tagName==='A'&&attr.name==='href'){try{child.setAttribute('href',safeLink(attr.value));}catch{child.removeAttribute('href');}continue;}
        if(child.tagName==='A'&&['target','rel'].includes(attr.name)){child.setAttribute('target','_blank');child.setAttribute('rel','noopener noreferrer');continue;}
        if(attr.name==='class'&&/^[a-zA-Z0-9_ -]{0,120}$/.test(attr.value))continue;
        if(attr.name==='aria-hidden'&&['true','false'].includes(attr.value))continue;
        child.removeAttribute(attr.name);
      }
    }}clean(template.content);return template.innerHTML;
  }
  function plainHTML(value){const div=document.createElement('div');String(value).split('\n').forEach((line,i)=>{if(i)div.appendChild(document.createElement('br'));div.appendChild(document.createTextNode(line));});return div.innerHTML;}
  function textOf(el){return el.textContent||'';}
  function snapshot(){return {sources:Object.fromEntries([...state.pages].map(([path,p])=>[path,p.source])),assets:{...state.assets},jsonSource:state.jsonSource,jsonDirty:state.jsonDirty};}
  function remember(key){const now=Date.now();if(key!==state.lastTransaction||now-state.lastTime>700){state.undo.push(snapshot());if(state.undo.length>25)state.undo.shift();state.redo=[];}state.lastTransaction=key;state.lastTime=now;}
  function restoreSnapshot(s){
    for(const [path,source]of Object.entries(s.sources)){const p=state.pages.get(path);p.source=source;p.doc=parse(source);p.dirty=source!==p.original;buildMap(p);}
    state.assets={...s.assets};state.jsonSource=s.jsonSource;state.json=JSON.parse(s.jsonSource);state.jsonDirty=s.jsonDirty;state.selected=null;state.lastTransaction='';render();changed();
  }
  function syncPublications(element){
    const p=state.pages.get('publications.html');if(!p?.dirty)return;
    const row=element?.closest('.citation-row.research-entry');if(!row)return;
    const data=JSON.parse(state.jsonSource);
    const records=[...(data.papers||[]),...(data.contributions||[]),...(data.presentations||[]),...(data.workshops||[])];
    const title=row.querySelector('h3')?.textContent?.trim(),citation=row.querySelector('.citation-detail p')?.textContent?.trim(),venue=row.querySelector('.activity-venue,.publication-venue')?.textContent||'',authors=row.querySelector('.publication-authors')?.textContent?.trim()||'';
    const record=records.find(r=>r.id===row.id);let updated=false;
    if(record&&element.closest('h3')&&record.title!==title){record.title=title;updated=true;}
    if(record&&element.closest('.citation-detail p')&&record.citation!==citation){record.citation=citation;updated=true;}
    if(record&&element.closest('.activity-venue,.publication-venue')&&record.venue!==venue){record.venue=venue;updated=true;}
    if(record&&element.closest('.publication-authors')&&record.authors!==authors){record.authors=authors;updated=true;}
    if(updated&&row.classList.contains('publication-item')&&!element.closest('.citation-detail p')){record.citation=[authors,title,venue].filter(Boolean).join(', ');const full=row.querySelector('.citation-detail p');if(full)full.textContent=record.citation;}
    row.dataset.search=[title,citation,authors,venue,record?.year||'',row.dataset.areas||''].join(' ').toLowerCase();p.source=serialize(p.doc);
    if(updated){state.json=data;state.jsonSource=JSON.stringify(data,null,2)+'\n';state.jsonDirty=state.jsonSource!==state.jsonOriginal;}
  }
  function updateSource(p){p.source=serialize(p.doc);p.dirty=p.source!==p.original;if(p===state.pages.get('publications.html'))syncPublications(selected());}
  function patch(data){frame.contentWindow?.postMessage({channel,type:'patch',...data},'*');}
  function mutateText(html,key='text',fromFrame=false){
    const el=selected();if(!el||kindOf(el)!=='text'||state.busy)return;const clean=sanitizeHTML(html);if(el.innerHTML===clean)return;
    remember(state.current+':'+state.selected+':'+key);el.innerHTML=clean;updateSource(page());
    if(!fromFrame)patch({key:state.selected,html:clean});changed();
  }
  function mutateStyle(name,value){
    const el=selected();if(!el||state.busy)return;remember(state.current+':'+state.selected+':'+name);
    if(value)el.style.setProperty(name,value);else el.style.removeProperty(name);
    if(!el.getAttribute('style'))el.removeAttribute('style');updateSource(page());patch({key:state.selected,style:{[name]:value}});changed();
  }
  function mutateStyles(styles,key='layout'){
    const el=selected();if(!el||state.busy)return;
    remember(state.current+':'+state.selected+':'+key);
    for(const [name,value]of Object.entries(styles))if(value)el.style.setProperty(name,value);else el.style.removeProperty(name);
    if(!el.getAttribute('style'))el.removeAttribute('style');
    updateSource(page());patch({key:state.selected,style:styles});changed();
  }
  function displayImage(src){const file=state.assets[src];return file?'data:'+file.mime+';base64,'+file.data:new URL(src,siteBase).href;}
  function selection(data){
    const el=page()?.map.get(data.key);if(!el)return;
    state.selected=data.key;state.lastTransaction='';$('selection-empty').hidden=true;
    const image=el.tagName==='IMG',kind=kindOf(el);$('text-panel').hidden=kind!=='text';$('image-panel').hidden=!image;showElementControls(el,data);
    if(image){$('selected-image').src=displayImage(el.getAttribute('src'));$('image-alt').value=el.alt;$('image-fit').value=el.style.objectFit||'';$('image-file').value='';}
    else if(kind==='text'){
      $('text-kind').textContent=el.tagName.startsWith('H')?'HEADING':'TEXT';$('text-value').value=data.text||textOf(el);$('font-size').value=Math.round(data.fontSize||0)||'';
      const match=(data.color||'').match(/\d+/g);if(match?.length>=3)$('text-color').value='#'+match.slice(0,3).map(v=>Number(v).toString(16).padStart(2,'0')).join('');
      $('bold').setAttribute('aria-pressed',String(!!data.bold));$('italic').setAttribute('aria-pressed',String(!!data.italic));$('text-align').value=el.style.textAlign||'';
      $('font-family').value=[...$('font-family').options].find(o=>o.value.replace(/[\"']/g,'')===(el.style.fontFamily||'').replace(/[\"']/g,''))?.value||'';$('line-height').value=el.style.lineHeight||'';
    }
  }
  function changed(){
    const count=Object.keys(changes()).length;$('change-count').textContent=count?count+' file'+(count===1?'':'s')+' changed':'No unpublished changes';
    $('undo').disabled=!state.undo.length||state.busy;$('redo').disabled=!state.redo.length||state.busy;
    $('export').disabled=!count||state.busy;$('publish').disabled=!count||state.busy;$('save-draft').disabled=!count||state.busy;
    clearTimeout(draftTimer);draftTimer=setTimeout(()=>saveDraft().catch(error=>status(error.message,true)),350);
    $('draft-state').textContent=count?'Draft changes · not published':'Drafts stay on this device';
  }
  function assetBytes(asset){const s=atob(asset.data);return Uint8Array.from(s,c=>c.charCodeAt(0));}
  function changes(){
    const result={};for(const [path,p]of state.pages)if(p.dirty)result[path]=p.source;
    if(state.jsonDirty)result['publications.json']=state.jsonSource;
    for(const [path,asset]of Object.entries(state.assets)){
      if(asset.published)continue;
      if([...state.pages.values()].some(p=>p.source.includes(path)))result[path]=assetBytes(asset);
    }return result;
  }
  function database(){if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open('naresh-visual-editor',1);req.onupgradeneeded=()=>req.result.createObjectStore('drafts');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(Error('This browser cannot save drafts. Download your changes before closing.'));});return dbPromise;}
  async function readDraft(){const db=await database();return new Promise((resolve,reject)=>{const req=db.transaction('drafts').objectStore('drafts').get('website');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
  async function saveDraft(){
    if(!state.loaded)return;const generation=++saveGeneration,db=await database(),dirty=[...state.pages].filter(([,p])=>p.dirty);
    const draft={version:1,savedAt:new Date().toISOString(),page:state.current,pages:Object.fromEntries(dirty.map(([path,p])=>[path,{source:p.source,baseline:p.baseline}])),assets:state.assets,jsonSource:state.jsonDirty?state.jsonSource:null,jsonBaseline:state.jsonBaseline};
    await new Promise((resolve,reject)=>{const tx=db.transaction('drafts','readwrite');const store=tx.objectStore('drafts');if(dirty.length||state.jsonDirty)store.put(draft,'website');else store.delete('website');tx.oncomplete=resolve;tx.onerror=()=>reject(Error('The draft could not be saved. Download your changes to keep them.'));});
    if(generation===saveGeneration&&dirty.length)$('draft-state').textContent='Draft saved on this device';
  }
  async function deleteDraft(){const db=await database();await new Promise((resolve,reject)=>{const tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').delete('website');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
  function renderSections(){
    $('sections-card').hidden=state.current!=='index.html';const list=$('section-list');list.replaceChildren();if(state.current!=='index.html')return;
    const children=[...page().doc.querySelector('main').children].filter(el=>el.tagName!=='SCRIPT');
    children.forEach((el,index)=>{
      if(index===0)return;const row=document.createElement('div');row.className='section-item';const title=document.createElement('span');title.textContent=(el.querySelector('h2')?.textContent||el.id||el.getAttribute('aria-label')||'Statistics').trim().slice(0,60);row.appendChild(title);
      for(const [delta,label]of [[-1,'↑'],[1,'↓']]){const b=document.createElement('button');b.textContent=label;b.setAttribute('aria-label','Move '+title.textContent+(delta<0?' up':' down'));b.disabled=index+delta<1||index+delta>=children.length;b.addEventListener('click',()=>{
        remember('section-order:'+Date.now());const other=children[index+delta];if(delta<0)other.before(el);else other.after(el);updateSource(page());buildMap(page());render();changed();
      });row.appendChild(b);}list.appendChild(row);
    });
  }
  async function render(){
    const generation=++renderGeneration;
    try{
    const p=page();if(!p)return;
    state.selected=null;$('selection-empty').hidden=false;$('text-panel').hidden=true;$('image-panel').hidden=true;$('element-panel').hidden=true;$('layout-panel').hidden=true;renderContentTree();
    $('page-select').value=state.current;$('page-name').textContent=labels[state.current];
    const copy=parse(p.source);copy.querySelectorAll('script,base,meta[http-equiv]').forEach(el=>el.remove());
    copy.querySelectorAll('*').forEach(el=>{for(const attr of [...el.attributes])if(attr.name.startsWith('on')||attr.name==='srcdoc')el.removeAttribute(attr.name);});
    const clonePage={doc:copy};buildMap(clonePage);for(const [key,el]of clonePage.map){el.dataset.editorKey=key;el.dataset.editorKind=kindOf(el);}
    const assetTasks=[];
    for(const img of copy.querySelectorAll('img')){const source=img.getAttribute('src'),asset=state.assets[source];if(asset)img.src='data:'+asset.mime+';base64,'+asset.data;else if(source&&!source.startsWith('data:'))assetTasks.push(cachedPreview(new URL(source,siteBase).href,'image').then(data=>{img.src=data;}));}
    for(const link of copy.querySelectorAll('link[rel=stylesheet]'))assetTasks.push(cachedPreview(new URL(link.getAttribute('href'),siteBase).href).then(text=>{const style=copy.createElement('style');style.textContent=text;link.replaceWith(style);}));
    const bridge=await cachedPreview(new URL('editor-bridge.js?v=full-editor20261119',siteBase).href);
    const bridgeHash=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(bridge)))));
    const assets=await Promise.allSettled(assetTasks);for(const result of assets)if(result.status==='rejected')throw result.reason;
    if(generation!==renderGeneration)return;
    const base=copy.createElement('base');base.href=siteBase;copy.head.prepend(base);
    const csp=copy.createElement('meta');csp.httpEquiv='Content-Security-Policy';csp.content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; script-src 'sha256-"+bridgeHash+"'; object-src 'none'; form-action 'none'";copy.head.prepend(csp);
    const styles=copy.createElement('style');styles.textContent='[data-editor-key]{transition:none!important}.bio-material-panel:hover,.bio-material-panel:focus-within{transform:none!important}[data-editor-kind=text]{cursor:text!important;transition:outline-color .1s}img[data-editor-key]{cursor:pointer!important}[data-editor-kind=text]:hover,img[data-editor-key]:hover{outline:2px dashed #529dba;outline-offset:4px}[data-editor-selected]{outline:2px solid #246b9c!important;outline-offset:4px}input,select,textarea,button{pointer-events:none!important}[data-editor-hover]{outline:1px dashed #529dba;outline-offset:3px}';copy.head.appendChild(styles);
    const script=copy.createElement('script');script.textContent=bridge;copy.body.appendChild(script);frame.srcdoc='<!doctype html>\n'+copy.documentElement.outerHTML;
    renderSections();
    }catch(error){status(error.message,true);}
  }
  window.addEventListener('message',event=>{
    if(event.source!==frame.contentWindow||!event.data)return;const data=event.data;
    if(data.type==='editor-ready'){frame.contentWindow.postMessage({type:'initialize',channel},'*');if(state.pendingSelection){frame.contentWindow.postMessage({type:'select',channel,key:state.pendingSelection},'*');state.pendingSelection=null;}return;}
    if(data.channel!==channel)return;
    if(data.type==='selection')selection(data);
    else if(data.type==='edit'&&state.selected===data.key){mutateText(data.html,'typing',true);if(document.activeElement!==$('text-value'))$('text-value').value=data.text;}
    else if(data.type==='geometry'&&state.selected===data.key){$('box-measurement').textContent='Current box: '+Math.round(data.width)+' × '+Math.round(data.height)+' px';}
    else if(data.type==='resize'&&state.selected===data.key){const styles=Core.resizeStyles(data.width,data.height);if(styles){mutateStyles(styles,'resize');$('element-width').value=Math.round(data.width);$('width-unit').value='px';$('element-height').value=Math.round(data.height);$('box-measurement').textContent='Current box: '+Math.round(data.width)+' × '+Math.round(data.height)+' px';status('Size updated in your draft.');}}
    else if(data.type==='save')saveDraft().then(()=>status('Draft saved on this device.')).catch(e=>status(e.message,true));
  });
  async function getText(url){const response=await fetch(url,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('Could not load '+url.split('/').pop()+'. Check your internet connection and try again.');return response.text();}
  async function load(){
    try{
      let sourceBase=siteBase;
      if(!localMode){try{const ref=await publicRequest(PREFIX+'/git/ref/heads/main');sourceBase='https://raw.githubusercontent.com/'+OWNER+'/'+REPO+'/'+ref.object.sha+'/';}catch{sourceBase=siteBase;}}
      $('loading-detail').textContent='Loading '+Core.PAGES.length+' pages and your publication record…';
      const paths=[...Core.PAGES,'publications.json'];const results=await Promise.allSettled(paths.map(async path=>{let source;try{source=await getText(new URL(path,sourceBase));}catch(error){if(sourceBase===siteBase)throw error;source=await getText(new URL(path,siteBase));}return[path,source];}));
      for(const result of results)if(result.status==='rejected')throw result.reason;
      for(const result of results){const [path,source]=result.value;
        if(path==='publications.json'){state.json=JSON.parse(source);state.jsonSource=source;state.jsonOriginal=source;state.jsonBaseline=await Core.blobHash(source);continue;}
        const p={original:source,source,doc:parse(source),dirty:false,baseline:await Core.blobHash(source)};buildMap(p);state.pages.set(path,p);
      }
      for(const path of Core.PAGES){const option=document.createElement('option');option.value=path;option.textContent=labels[path];$('page-select').appendChild(option);}
      state.loaded=true;$('page-select').disabled=false;await render();$('loading').hidden=true;status('Ready. Click text or a photo on your page to begin.');
      try{state.savedDraft=await readDraft();$('draft-banner').hidden=!state.savedDraft;}catch(error){status(error.message,true);}
    }catch(error){$('loading-detail').textContent=error.message;$('loading').querySelector('h2').textContent='Your pages could not be opened';$('loading').querySelector('.spinner').hidden=true;$('reload-editor').hidden=false;status(error.message,true);}
  }
  async function publicRequest(path){const response=await fetch('https://api.github.com'+path,{headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10'},credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});if(!response.ok)throw Error(response.status===403?'GitHub’s public request limit was reached. Please try again shortly.':'GitHub could not be reached. Please try again.');return response.json();}
  async function apiRequest(path,options={}){
    if(!publishingToken)throw Error('Connect your GitHub publishing key first.');
    if(path!=='/user'&&path!==PREFIX&&!path.startsWith(PREFIX+'/'))throw Error('The editor is restricted to your website repository.');
    const response=await fetch('https://api.github.com'+path,{method:options.method||'GET',headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10',Authorization:'Bearer '+publishingToken,...(options.body?{'Content-Type':'application/json'}:{})},...(options.body?{body:JSON.stringify(options.body)}:{}),credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});
    if(!response.ok){if(response.status===401)throw Error('GitHub did not accept this token. Create a current fine-grained token and reconnect.');if(response.status===403)throw Error('GitHub denied this operation. Check that the token has Contents: Read and write for this website repository.');if([409,422].includes(response.status))throw Error('The repository changed during publishing, or GitHub rejected the update. Your draft is safe. Download it and reload before trying again.');throw Error('GitHub returned an error ('+response.status+'). Your draft is safe.');}
    return response.status===204?{}:response.json();
  }
  function setBusy(value){state.busy=value;document.body.classList.toggle('editor-busy',value);$('confirm-publish').disabled=value;$('page-select').disabled=value;for(const b of document.querySelectorAll('.header-actions button'))b.disabled=value;if(!value)changed();}
  function exportChanges(){
    const edited=changes();if(!Object.keys(edited).length)return;
    const files=Object.entries(edited).map(([path,content])=>({path,content}));files.push({path:'READ-ME-FIRST.txt',content:'Website changes for varnaresh17/varnaresh17.github.io\n\nThese files contain your edited pages and any new images.\nSend this ZIP to ChatGPT and ask to publish these changes to your existing GitHub website.\nNo publishing token is included.\n'});
    const url=URL.createObjectURL(new Blob([Core.zip(files)],{type:'application/zip'})),a=document.createElement('a');a.href=url;a.download='Naresh_Website_Changes_'+new Date().toISOString().slice(0,10)+'.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);status('Your changes were downloaded. You can send the ZIP here for help publishing.');
  }
  $('page-select').addEventListener('change',()=>{state.current=$('page-select').value;$('element-search').value='';render();});
  $('desktop-view').addEventListener('click',()=>{$('stage').classList.remove('mobile');$('desktop-view').setAttribute('aria-pressed','true');$('mobile-view').setAttribute('aria-pressed','false');$('desktop-view').classList.add('selected');$('mobile-view').classList.remove('selected');});
  $('mobile-view').addEventListener('click',()=>{$('stage').classList.add('mobile');$('desktop-view').setAttribute('aria-pressed','false');$('mobile-view').setAttribute('aria-pressed','true');$('mobile-view').classList.add('selected');$('desktop-view').classList.remove('selected');});
  $('text-value').addEventListener('input',()=>mutateText(plainHTML($('text-value').value),'sidebar'));
  $('font-size').addEventListener('input',()=>{const n=Number($('font-size').value);if(n>=8&&n<=120)mutateStyle('font-size',n+'px');else if(!$('font-size').value)mutateStyle('font-size','');});
  $('text-color').addEventListener('input',()=>mutateStyle('color',$('text-color').value));
  $('text-align').addEventListener('change',()=>mutateStyle('text-align',$('text-align').value));
  $('bold').addEventListener('click',()=>{const enabled=$('bold').getAttribute('aria-pressed')!=='true';$('bold').setAttribute('aria-pressed',String(enabled));mutateStyle('font-weight',enabled?'700':'400');});
  $('italic').addEventListener('click',()=>{const enabled=$('italic').getAttribute('aria-pressed')!=='true';$('italic').setAttribute('aria-pressed',String(enabled));mutateStyle('font-style',enabled?'italic':'normal');});
  $('reset-format').addEventListener('click',()=>{for(const name of ['font-size','font-family','line-height','color','font-weight','font-style','text-align'])mutateStyle(name,'');$('font-size').value='';$('font-family').value='';$('line-height').value='';$('text-align').value='';});
  $('apply-link').addEventListener('click',()=>{try{const el=selected(),link=findLink(el);if(!link)return;const value=safeLink($('link-value').value);remember('link:'+Date.now());link.setAttribute('href',value);updateSource(page());const key=keyFor(link);if(key)patch({key,href:value});changed();status('Link updated in your draft.');}catch(error){status(error.message,true);}});
  $('image-alt').addEventListener('input',()=>{const el=selected();if(el?.tagName!=='IMG')return;remember('image-alt:'+state.selected);el.alt=$('image-alt').value;updateSource(page());patch({key:state.selected,alt:el.alt});changed();});
  $('image-fit').addEventListener('change',()=>mutateStyle('object-fit',$('image-fit').value));
  $('image-file').addEventListener('change',async()=>{
    const file=$('image-file').files[0],el=selected();if(!file||el?.tagName!=='IMG')return;
    const extensions={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif'};
    if(!extensions[file.type]||file.size>8*1024*1024){status('Choose a JPG, PNG, WebP, GIF or AVIF image up to 8 MB.',true);return;}
    try{
      const bitmap=await createImageBitmap(file);bitmap.close();const data=new Uint8Array(await file.arrayBuffer()),old=el.getAttribute('src');
      const path='assets/uploads/photo-'+Date.now()+'-'+crypto.randomUUID().slice(0,8)+'.'+extensions[file.type];
      remember('image:'+Date.now());state.assets[path]={data:Core.base64(data),mime:file.type};
      const targets=$('replace-all').checked?[...state.pages.values()]:[page()];
      for(const p of targets){let touched=false;for(const image of p.doc.querySelectorAll('img'))if(image.getAttribute('src')===old){image.setAttribute('src',path);const zoom=image.closest('a[data-research-zoom]');if(zoom){zoom.setAttribute('href',path);for(const attr of ['data-detail-src','data-detail-alt','data-default-view'])zoom.removeAttribute(attr);}touched=true;}
        for(const a of p.doc.querySelectorAll('a[href]'))if(a.getAttribute('href')===old){a.setAttribute('href',path);touched=true;}
        if(touched)updateSource(p);
      }
      $('selected-image').src=displayImage(path);render();changed();status('Photo replaced in your draft. Publish when you are ready.');
    }catch{status('This image could not be opened. Try a different image file.',true);}
  });
  $('undo').addEventListener('click',()=>{if(!state.undo.length)return;state.redo.push(snapshot());restoreSnapshot(state.undo.pop());status('Undid the last change.');});
  $('redo').addEventListener('click',()=>{if(!state.redo.length)return;state.undo.push(snapshot());restoreSnapshot(state.redo.pop());status('Restored the last change.');});
  $('save-draft').addEventListener('click',()=>saveDraft().then(()=>status('Draft saved on this device. Your public website has not changed.')).catch(e=>status(e.message,true)));
  $('export').addEventListener('click',exportChanges);
  $('reload-editor').addEventListener('click',()=>location.reload());
  $('restore-draft').addEventListener('click',()=>{
    const draft=state.savedDraft;if(!draft)return;remember('restore:'+Date.now());
    for(const [path,saved]of Object.entries(draft.pages||{}))if(state.pages.has(path)&&typeof saved.source==='string'){
      const p=state.pages.get(path);p.source=saved.source;p.doc=parse(saved.source);p.dirty=true;p.baseline=saved.baseline;buildMap(p);
    }
    state.assets=draft.assets||{};if(draft.jsonSource){state.jsonSource=draft.jsonSource;state.json=JSON.parse(draft.jsonSource);state.jsonDirty=true;state.jsonBaseline=draft.jsonBaseline;}
    if(state.pages.has(draft.page))state.current=draft.page;$('draft-banner').hidden=true;render();changed();status('Your saved draft is restored.');
  });
  $('discard-draft').addEventListener('click',()=>deleteDraft().then(()=>{$('draft-banner').hidden=true;state.savedDraft=null;status('The stored draft was discarded.');}).catch(e=>status(e.message,true)));
  for(const b of document.querySelectorAll('[data-close]'))b.addEventListener('click',()=>$(b.dataset.close).close());
  $('connect').addEventListener('click',()=>{$('connect-error').textContent='';$('connect-dialog').showModal();});
  $('disconnect').addEventListener('click',()=>{publishingToken='';$('connection-label').textContent='GitHub not connected';$('disconnect').hidden=true;$('connect').hidden=false;status('Publishing disconnected. Your draft is kept on this device.');});
  $('connect-dialog').addEventListener('close',()=>{$('github-token').value='';});
  $('connect-form').addEventListener('submit',async event=>{
    event.preventDefault();const candidate=$('github-token').value.trim();$('github-token').value='';
    if(!/^github_pat_[A-Za-z0-9_]{20,}$/.test(candidate)){$('connect-error').textContent='Use a fine-grained GitHub token, beginning github_pat_.';return;}
    publishingToken=candidate;$('connect-submit').disabled=true;$('connect-error').textContent='Checking your account…';
    try{const user=await apiRequest('/user');if(user.login.toLowerCase()!==OWNER)throw Error('Sign in with the varnaresh17 GitHub account to publish this website.');const repo=await apiRequest(PREFIX);if(!repo.permissions?.push)throw Error('This key does not have write access to the website repository.');$('connection-label').textContent='Connected · '+user.login;$('connect').hidden=true;$('disconnect').hidden=false;$('connect-dialog').close();status('GitHub publishing connected for this tab.');}
    catch(error){publishingToken='';$('connect-error').textContent=error.message;}finally{$('connect-submit').disabled=false;}
  });
  $('publish').addEventListener('click',()=>{
    if(!publishingToken){$('connect-dialog').showModal();return;}
    $('publish-files').replaceChildren();for(const path of Object.keys(changes())){const li=document.createElement('li');li.textContent=path;$('publish-files').appendChild(li);}$('publish-error').textContent='';$('publish-dialog').showModal();
  });
  $('confirm-publish').addEventListener('click',async()=>{
    if(state.busy)return;const pending=changes(),baselines={};for(const [path,p]of state.pages)baselines[path]=p.baseline;baselines['publications.json']=state.jsonBaseline;
    setBusy(true);$('publish-error').textContent='';
    try{
      await saveDraft();const result=await Core.publish({request:apiRequest,changes:pending,baselines,message:$('commit-message').value.trim(),onProgress:text=>{status(text);$('publish-error').textContent=text;}});
      for(const [path,p]of state.pages)if(p.dirty){p.original=p.source;p.baseline=await Core.blobHash(p.source);p.dirty=false;}
      if(state.jsonDirty){state.jsonOriginal=state.jsonSource;state.jsonBaseline=await Core.blobHash(state.jsonSource);state.jsonDirty=false;}
      for(const asset of Object.values(state.assets))asset.published=true;state.undo=[];state.redo=[];await deleteDraft();$('draft-banner').hidden=true;$('publish-dialog').close();status('Saved to GitHub. Your website is publishing…');watchDeployment(result.sha);
    }catch(error){$('publish-error').textContent=error.message;status(error.message,true);}finally{setBusy(false);}
  });
  function watchDeployment(sha){
    clearTimeout(pollTimer);let attempts=0;
    const poll=async()=>{try{
      const data=await publicRequest(PREFIX+'/actions/runs?branch=main&per_page=10');const run=data.workflow_runs?.find(r=>r.head_sha===sha&&r.name==='pages build and deployment');
      if(run?.status==='completed'){if(run.conclusion==='success'){status('Published. Your updated website is live at varnaresh17.github.io.');showHelp('Your website is published','Your changes are live. Open “View public website” to review them.');}else status('Saved to GitHub, but publishing needs attention. Open the repository Actions tab.',true);return;}
    }catch{if(attempts>8){status('Saved to GitHub. Check the repository Actions tab for publication status.');return;}}
    if(++attempts<30)pollTimer=setTimeout(poll,6000);else status('Saved to GitHub. Publishing is taking longer than usual; check the repository Actions tab.');};pollTimer=setTimeout(poll,6000);
  }
  function keyFor(el){for(const [key,node]of page().map)if(node===el)return key;return null;}
  function findLink(el){if(!el)return null;return el.tagName==='A'?el:el.closest('a')||((el.querySelectorAll('a').length===1)?el.querySelector('a'):null);}
  function itemName(el){const name=el.getAttribute('aria-label')||el.id||el.querySelector('h1,h2,h3')?.textContent||el.getAttribute('alt')||el.textContent||el.tagName;return name.trim().replace(/\s+/g,' ').slice(0,65);}
  function renderContentTree(){const list=$('element-select');list.replaceChildren();const query=$('element-search').value.toLowerCase().trim();for(const [key,el]of page()?.map||[]){const label=el.tagName.toLowerCase()+' · '+itemName(el)+(el.style.display==='none'?' (hidden)':'');if(query&&!label.toLowerCase().includes(query))continue;const option=document.createElement('option');option.value=key;option.textContent=label;list.appendChild(option);}if(state.selected)list.value=state.selected;}
  function showElementControls(el,data={}){
    $('element-panel').hidden=false;$('layout-panel').hidden=false;$('element-kind').textContent=kindOf(el).toUpperCase();$('element-name').textContent=itemName(el);$('element-select').value=state.selected;
    $('element-hint').textContent=kindOf(el)==='block'?'You selected a container. Styles apply to this group. Select a child to edit its wording.':'Duplicate, move, or delete this item. Undo restores your changes.';
    const path=$('selection-path');path.replaceChildren();
    const ancestors=[];for(let node=el;node&&node.tagName!=='BODY';node=node.parentElement)if(keyFor(node))ancestors.unshift(node);
    for(const node of ancestors){const button=document.createElement('button');button.type='button';button.textContent=node===el?'Selected: '+node.tagName.toLowerCase():node.id||node.classList[0]||node.tagName.toLowerCase();button.title=itemName(node);button.addEventListener('click',()=>chooseElement(node));path.appendChild(button);}
    const parent=el.parentElement;$('select-parent').disabled=!parent||![...page().map.values()].some(node=>node===parent||node.contains(el)&&node!==el);
    for(const [id,property]of [['element-height','height'],['margin-left','marginLeft'],['margin-right','marginRight'],['layout-gap','gap'],['border-width','borderWidth'],['element-radius','borderRadius'],['margin-top','marginTop'],['margin-bottom','marginBottom'],['element-padding','padding']])$(id).value=el.style[property]?parseFloat(el.style[property]):'';
    $('element-width').value=el.style.width?parseFloat(el.style.width):'';$('width-unit').value=el.style.width.endsWith('%')?'%':'px';
    $('box-measurement').textContent=data.width&&data.height?'Current box: '+Math.round(data.width)+' × '+Math.round(data.height)+' px':'';
    for(const [id,property]of [['layout-display','display'],['layout-direction','flexDirection'],['layout-overflow','overflow'],['layout-align','alignItems'],['layout-justify','justifyContent']])$(id).value=el.style[property]||'';
    const columns=el.style.gridTemplateColumns.match(/repeat\((\d+)/);$('layout-columns').value=columns?columns[1]:'';
    const bg=el.style.backgroundColor.match(/\d+/g);if(bg?.length>=3)$('element-background').value='#'+bg.slice(0,3).map(n=>Number(n).toString(16).padStart(2,'0')).join('');
    const link=findLink(el);$('link-fields').hidden=!link;$('link-value').value=link?.getAttribute('href')||'';
  }
  function chooseElement(el){const key=keyFor(el);if(key)frame.contentWindow.postMessage({type:'select',channel,key},'*');}
  function finishStructure(el,message){updateSource(page());buildMap(page());state.pendingSelection=el?keyFor(el):null;render();changed();status(message);}
  function isToolElement(el){return ['xrd.html','ftir.html','colorimetry.html','plqy.html'].includes(state.current)&&el.closest('main')&&!el.closest('#home,.tool-page-intro,.software-breadcrumb');}
  function containingRecord(el){return state.current==='publications.html'?el?.closest('.citation-row.research-entry'):null;}
  function saveJSON(data){state.json=data;state.jsonSource=JSON.stringify(data,null,2)+'\n';state.jsonDirty=state.jsonSource!==state.jsonOriginal;}
  function updatePublicationCounts(){
    const data=state.json,journals=data.papers.length,proceedings=data.contributions.length,talks=data.presentations.length,seminars=data.workshops.length,symposia=data.contributions.filter(r=>r.category==='symposium').length,total=journals+proceedings;
    for(const [path,p]of state.pages){let touched=false;const change=(el,text)=>{if(el&&el.textContent!==String(text)){el.textContent=text;touched=true;}};
      if(path==='publications.html'){
        change(p.doc.querySelector('.publication-summary [data-publication-type=journal] strong'),journals);change(p.doc.querySelector('.publication-summary [data-publication-type=proceeding] strong'),proceedings);change(p.doc.querySelector('#publication-status'),'Showing all '+total+' publications.');
        for(const el of p.doc.querySelectorAll('.publication-topic-list [data-topic] .topic-count')){const tag=el.parentElement.dataset.topic;change(el,'('+[...data.papers,...data.contributions].filter(r=>(r.tags||r.areas||[]).includes(tag)).length+')');}
        change(p.doc.querySelector('#academic-activities>summary>span'),talks+' presentations · '+seminars+' workshops & seminars');
        for(const [id,count]of [['conference-presentations',talks],['workshops-seminars',seminars]])change(p.doc.querySelector('#'+id+' .publication-group-count'),count+' entries');
      }
      if(path==='index.html'||path==='research.html'){
        for(const div of p.doc.querySelectorAll('.proof-strip>div'))if(/journal/i.test(div.textContent))change(div.querySelector('strong'),journals);
        for(const tile of p.doc.querySelectorAll('.area-tile')){const area=new URL(tile.getAttribute('href'),siteBase).searchParams.get('area');const n=data.papers.filter(r=>r.areas?.includes(area)).length;const count=tile.querySelector('.area-count');if(count){const svg=count.querySelector('svg')?.cloneNode(true);change(count,n+' journal article'+(n===1?'':'s')+' ');if(svg)count.appendChild(svg);}}
      }
      if(path==='resume.html'){
        const walker=p.doc.createTreeWalker(p.doc.body,NodeFilter.SHOW_TEXT);while(walker.nextNode()){const node=walker.currentNode;if(node.parentElement.closest('script,style'))continue;const before=node.nodeValue;node.nodeValue=before.replace(/Author of \d+ journal articles and \d+ proceedings papers/,'Author of '+journals+' journal articles and '+proceedings+' proceedings papers').replace(/Published Articles \(\d+\)/,'Published Articles ('+journals+')').replace(/Conference Proceedings \(\d+\)/,'Conference Proceedings ('+(proceedings-symposia)+')').replace(/Symposium Proceedings \(\d+\)/,'Symposium Proceedings ('+symposia+')').replace(/Conference Presentations \(\d+\)/,'Conference Presentations ('+talks+')').replace(/Workshops and Seminars Presented \(\d+\)/,'Workshops and Seminars Presented ('+seminars+')');if(before!==node.nodeValue)touched=true;}
      }
      if(touched){p.source=serialize(p.doc);p.dirty=p.source!==p.original;}
    }
  }
  function uniqueClone(el){const clone=el.cloneNode(true),nodes=[clone,...clone.querySelectorAll('*')],ids=new Map();for(const node of nodes)if(node.id){const next='copy-'+crypto.randomUUID().slice(0,8);ids.set(node.id,next);node.id=next;}for(const node of nodes){for(const attr of [...node.attributes]){if(attr.name.startsWith('data-editor-'))node.removeAttribute(attr.name);if(['for','aria-labelledby','aria-describedby','aria-controls'].includes(attr.name))node.setAttribute(attr.name,attr.value.split(' ').map(id=>ids.get(id)||id).join(' '));if(attr.name==='href'&&attr.value.startsWith('#')&&ids.has(attr.value.slice(1)))node.setAttribute('href','#'+ids.get(attr.value.slice(1)));}}return clone;}
  function deleteElement(){
    const el=selected();if(!el||state.busy)return;const record=containingRecord(el);
    if(record&&record!==el){showHelp('Select the whole publication','Use “Select container” until the publication card is selected, then delete it. To change a title, authors, or citation, edit its text instead.');return;}
    remember('delete:'+Date.now());const parent=el.parentElement;
    if(isToolElement(el)||el.querySelector('form,canvas')){el.style.display='none';finishStructure(parent,'Hidden from the public page. The calculator code is preserved; Undo restores visibility.');return;}
    if(state.current==='publications.html'){
      const ids=[el,...el.querySelectorAll('.research-entry')].filter(n=>n.matches('.research-entry')).map(n=>n.id),data=JSON.parse(state.jsonSource);
      if(ids.length){for(const name of ['papers','contributions','presentations','workshops'])data[name]=data[name].filter(r=>!ids.includes(r.id));saveJSON(data);}
    }
    el.remove();if(state.current==='publications.html')updatePublicationCounts();finishStructure(parent,'Deleted from your draft. Undo restores the item.');
  }
  function duplicateElement(){
    const el=selected();if(!el||state.busy)return;if(isToolElement(el)||el.querySelector('form,canvas')){showHelp('Choose content to duplicate','You can duplicate text, photos, links, and content sections. Interactive calculators have unique controls and cannot be duplicated as ordinary content.');return;}
    if(state.current==='publications.html'&&el.querySelector('.research-entry')){showHelp('Select one publication','Select an individual publication card to duplicate it.');return;}
    remember('duplicate:'+Date.now());const clone=uniqueClone(el);const row=containingRecord(el);
    if(row===el){const data=JSON.parse(state.jsonSource);for(const key of ['papers','contributions','presentations','workshops']){const source=data[key].find(r=>r.id===el.id);if(source){const copy=JSON.parse(JSON.stringify(source));copy.id='entry-'+crypto.randomUUID().slice(0,8);clone.id=copy.id;data[key].splice(data[key].findIndex(r=>r.id===el.id)+1,0,copy);break;}}saveJSON(data);}
    el.after(clone);if(row===el)updatePublicationCounts();finishStructure(clone,'Duplicated in your draft. Edit the copy before publishing.');
  }
  function moveElement(delta){const el=selected();if(!el||state.busy)return;const other=delta<0?el.previousElementSibling:el.nextElementSibling;if(!other||['SCRIPT','STYLE'].includes(other.tagName))return;if(isToolElement(el)){showHelp('Move the whole workspace','Use the page section controls to move an interactive workspace without changing its internal controls.');return;}remember('move:'+Date.now());if(delta<0)other.before(el);else other.after(el);finishStructure(el,'Moved the selected item.');}
  function insertContent(node){
    const current=selected(),main=page().doc.querySelector('main')||page().doc.body,position=$('add-position').value;
    if(!current||position==='end'){main.appendChild(node);return;}
    let anchor=current;if(node.tagName==='SECTION'){while(anchor.parentElement&&anchor.parentElement!==main&&main.contains(anchor))anchor=anchor.parentElement;}
    if(position==='inside'){const target=kindOf(current)==='block'&&!['UL','OL'].includes(current.tagName)?current:current.parentElement;target.appendChild(node);}
    else if(anchor.parentElement&&anchor.parentElement!==page().doc.body){if(position==='before')anchor.before(node);else anchor.after(node);}
    else main.appendChild(node);
  }
  async function readNewImage(file){
    const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif'};if(!file||!ext[file.type]||file.size>8*1024*1024)throw Error('Choose a JPG, PNG, WebP, GIF or AVIF image up to 8 MB.');
    const bitmap=await createImageBitmap(file);bitmap.close();return {path:'assets/uploads/photo-'+Date.now()+'-'+crypto.randomUUID().slice(0,8)+'.'+ext[file.type],asset:{data:Core.base64(new Uint8Array(await file.arrayBuffer())),mime:file.type}};
  }
  function addContent(){
    if(!state.loaded||state.busy)return;const kind=$('add-kind').value,copy=$('add-copy').value.trim();
    if(['journal','proceeding'].includes(kind)){if(state.current!=='publications.html'){showHelp('Choose the Publications page','Select Publications from the Page menu, then add your article or proceedings paper.');return;}openPublicationForm(kind);return;}
    if(kind==='img'){$('add-image-file').value='';$('add-image-file').click();return;}
    if(!copy){status('Write the text you want to add first.',true);return;}
    const doc=page().doc;let node=doc.createElement(kind);
    if(kind==='div'){node.className='editable-container';node.style.cssText='width:100%;min-height:120px;padding:20px;border:1px solid #bfd0c5;border-radius:8px;';const p=doc.createElement('p');p.textContent=copy;node.appendChild(p);}
    else if(kind==='section'){node.className='section-shell';node.style.paddingTop='32px';node.style.paddingBottom='32px';const title=doc.createElement('h2');title.textContent=copy;title.style.fontSize='32px';const paragraph=doc.createElement('p');paragraph.textContent='Write your section content here.';paragraph.style.marginTop='16px';paragraph.style.fontSize='16px';node.append(title,paragraph);}
    else if(kind==='ul'){for(const line of copy.split('\n').filter(Boolean)){const li=doc.createElement('li');li.textContent=line;node.appendChild(li);}node.style.paddingLeft='24px';node.style.fontSize='16px';node.style.lineHeight='1.8';}
    else{node.textContent=copy;if(kind==='a'){try{node.setAttribute('href',safeLink($('add-url').value||'index.html'));}catch(error){status(error.message,true);return;}node.style.textDecoration='underline';}node.style.fontSize=kind==='h2'?'32px':'16px';node.style.lineHeight='1.7';node.style.marginTop='16px';node.style.marginBottom='16px';}
    remember('add:'+Date.now());insertContent(node);finishStructure(node,'New content added. Click it to edit or style it.');
  }
  function openPublicationForm(kind){
    state.addPublicationKind=kind;$('publication-add-form').reset();$('publication-add-title').textContent=kind==='journal'?'Add a journal article':'Add a proceedings paper';$('new-pub-category-field').hidden=kind==='journal';$('new-pub-year').value=new Date().getFullYear();$('new-pub-error').textContent='';const list=$('new-pub-topics');list.replaceChildren();
    for(const topic of state.json.publicationTopics||[]){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=topic.id;label.append(input,document.createTextNode(topic.label));list.appendChild(label);}$('publication-add-dialog').showModal();
  }
  $('publication-add-form').addEventListener('submit',event=>{
    event.preventDefault();try{
      const tags=[...$('new-pub-topics').querySelectorAll('input:checked')].map(el=>el.value);if(!tags.length)throw Error('Choose at least one topic.');
      const title=$('new-pub-title').value.trim(),authors=$('new-pub-authors').value.trim(),venue=$('new-pub-venue').value.trim(),year=$('new-pub-year').value,type=state.addPublicationKind,id='entry-'+crypto.randomUUID().slice(0,8);let url=$('new-pub-url').value.trim();if(url.startsWith('10.'))url='https://doi.org/'+url;if(url){safeLink(url);if(!/^https?:\/\//i.test(url))throw Error('Use a DOI or a full http/https paper URL.');}
      const doc=page().doc,original=parse(page().original),template=original.querySelector('.publication-item[data-type="'+type+'"]');if(!template)throw Error('The publication template is missing. Download your draft and ask for help.');
      const node=uniqueClone(template);node.id=id;node.dataset.type=type;node.dataset.year=year;node.dataset.topics=tags.join(' ');node.dataset.areas=tags.filter(tag=>state.json.areas[tag]).join(' ')||'general';const category=$('new-pub-category').value;
      if(type==='proceeding')node.dataset.category=category;else delete node.dataset.category;
      node.querySelector('h3').replaceChildren();if(url){const link=doc.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=title;node.querySelector('h3').appendChild(link);}else node.querySelector('h3').textContent=title;
      node.querySelector('.publication-authors').textContent=authors;node.querySelector('.publication-venue').textContent=venue;node.querySelector('.publication-year').textContent=year;node.querySelector('.publication-kind').textContent=type==='journal'?'Journal article':category==='symposium'?'Symposium proceedings':'Conference proceedings';
      const citation=[authors,title,venue].join(', ');node.querySelector('.citation-detail p').textContent=citation;node.querySelector('.publication-story')?.remove();const topicBox=node.querySelector('.publication-item-topics');topicBox.replaceChildren();
      for(const tag of tags){const link=doc.createElement('a');link.className='publication-topic';link.href='#'+tag;link.dataset.topic=tag;link.setAttribute('role','button');link.setAttribute('aria-pressed','false');link.textContent=state.json.publicationTopics.find(t=>t.id===tag)?.label||tag;topicBox.appendChild(link);}
      node.dataset.search=[title,authors,venue,year,...tags].join(' ').toLowerCase();
      const record={id,title,authors,venue,citation,year,url:url||null,type,areas:node.dataset.areas.split(' '),tags};if(type==='proceeding'&&category==='symposium')record.category='symposium';
      remember('add-publication:'+Date.now());const data=JSON.parse(state.jsonSource);data[type==='journal'?'papers':'contributions'].push(record);saveJSON(data);
      let list=doc.querySelector('#publication-list');if(!list){list=doc.createElement('div');list.id='publication-list';(doc.querySelector('.publication-browser')||doc.querySelector('main')).appendChild(list);}const next=[...list.children].find(el=>Number(el.dataset.year)<Number(year));if(next)next.before(node);else list.appendChild(node);
      updatePublicationCounts();$('publication-add-dialog').close();finishStructure(node,'Publication added. Bibliography counts and CV totals were updated in your draft.');
    }catch(error){$('new-pub-error').textContent=error.message;}
  });
  $('element-search').addEventListener('input',renderContentTree);
  $('element-select').addEventListener('change',()=>{const el=page().map.get($('element-select').value);if(el)chooseElement(el);});
  $('select-parent').addEventListener('click',()=>{let el=selected()?.parentElement;while(el&&!keyFor(el))el=el.parentElement;if(el)chooseElement(el);});
  $('delete-element').addEventListener('click',deleteElement);$('duplicate-element').addEventListener('click',duplicateElement);$('move-element-up').addEventListener('click',()=>moveElement(-1));$('move-element-down').addEventListener('click',()=>moveElement(1));
  $('add-kind').addEventListener('change',()=>{$('add-url-field').hidden=$('add-kind').value!=='a';$('add-copy-field').hidden=['journal','proceeding'].includes($('add-kind').value);});$('add-content').addEventListener('click',addContent);
  $('add-image-file').addEventListener('change',async()=>{try{const file=$('add-image-file').files[0];if(!file)return;const image=await readNewImage(file);remember('add-image:'+Date.now());state.assets[image.path]=image.asset;const node=page().doc.createElement('img');node.src=image.path;node.alt=$('add-copy').value.trim()||'Research image';node.style.maxWidth='100%';node.style.height='auto';node.style.display='block';node.style.marginTop='16px';node.style.marginBottom='16px';insertContent(node);finishStructure(node,'Photo added. Set its size and description in the sidebar.');}catch(error){status(error.message,true);}});
  $('font-family').addEventListener('change',()=>mutateStyle('font-family',$('font-family').value));
  $('line-height').addEventListener('input',()=>{const n=Number($('line-height').value);if(!$('line-height').value)mutateStyle('line-height','');else if(n>=.8&&n<=3)mutateStyle('line-height',String(n));});
  for(const [id,prop,min,max]of [['element-height','height',1,3000],['element-radius','border-radius',0,300],['margin-top','margin-top',-120,500],['margin-bottom','margin-bottom',-120,500],['margin-left','margin-left',-120,500],['margin-right','margin-right',-120,500],['layout-gap','gap',0,150],['element-padding','padding',0,250]])$(id).addEventListener('input',()=>{const value=$(id).value,n=Number(value);if(!value)mutateStyle(prop,'');else if(Number.isFinite(n)&&n>=min&&n<=max){if(prop==='height')mutateStyles({height:n+'px','min-height':'0px','max-height':'none','aspect-ratio':'auto'},'height');else mutateStyle(prop,n+'px');}});
  function updateWidth(){const value=$('element-width').value,n=Number(value),unit=$('width-unit').value;if(!value)mutateStyle('width','');else if(Number.isFinite(n)&&n>=1&&n<=(unit==='%'?100:3000))mutateStyles({width:n+unit,'max-width':'none','min-width':'0px','flex-shrink':'0'},'width');else status('Use a width from 1 to 100 percent, or up to 3000 pixels.',true);}
  $('element-width').addEventListener('input',updateWidth);$('width-unit').addEventListener('change',updateWidth);$('element-background').addEventListener('input',()=>mutateStyle('background-color',$('element-background').value));$('clear-background').addEventListener('click',()=>mutateStyle('background-color',''));

  $('reset-size').addEventListener('click',()=>{mutateStyles(Object.fromEntries(['width','height','min-width','max-width','min-height','max-height','aspect-ratio','flex-shrink'].map(n=>[n,''])),'reset-size');$('element-width').value='';$('element-height').value='';status('Website sizing restored for this item.');});
  for(const [id,prop]of [['layout-display','display'],['layout-direction','flex-direction'],['layout-overflow','overflow'],['layout-align','align-items'],['layout-justify','justify-content']])$(id).addEventListener('change',()=>mutateStyle(prop,$(id).value));
  $('layout-columns').addEventListener('input',()=>{const n=Number($('layout-columns').value);if(!$('layout-columns').value)mutateStyle('grid-template-columns','');else if(Number.isInteger(n)&&n>=1&&n<=6){$('layout-display').value='grid';mutateStyles({display:'grid','grid-template-columns':'repeat('+n+', minmax(0, 1fr))'},'grid-columns');}});
  $('border-width').addEventListener('input',()=>{const s=$('border-width').value,n=Number(s);if(!s)mutateStyles({'border-width':'','border-style':''},'border');else if(Number.isFinite(n)&&n>=0&&n<=30)mutateStyles({'border-width':n+'px','border-style':'solid'},'border');});
  $('border-color').addEventListener('input',()=>mutateStyle('border-color',$('border-color').value));
  load();
})();
