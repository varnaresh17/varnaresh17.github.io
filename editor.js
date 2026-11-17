(function(){
  'use strict';
  const Core=window.WebsiteEditorCore,$=id=>document.getElementById(id),OWNER='varnaresh17',REPO='varnaresh17.github.io',PREFIX='/repos/'+OWNER+'/'+REPO;
  const labels={'index.html':'Home','stories.html':'Research stories','publications.html':'Publications','synthesis.html':'Synthesis','characterization.html':'Characterization','softwares.html':'Tools overview','xrd.html':'XRD calculators','ftir.html':'FTIR interpreter','colorimetry.html':'Colorimetry','plqy.html':'PLQY / PLQE','resume.html':'CV'};
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
  function buildMap(page){
    const candidates=[...page.doc.querySelectorAll('h1,h2,h3,h4,h5,h6,p,figcaption,dt,dd,small,summary,.brand-name,.brand-sub,.photo-tag,a')].filter(el=>!el.closest('svg,script,style,pre,code,.publication-full-citation')&&!el.querySelector('svg,img,input,select,textarea,button')&&!(el.tagName==='A'&&el.parentElement.closest('h1,h2,h3,h4,h5,h6,p,figcaption,dt,dd,small')));
    const leaf=candidates.filter(el=>!candidates.some(other=>other!==el&&el.contains(other)));
    const images=[...page.doc.querySelectorAll('main img,.hero-profile img')];
    page.map=new Map([...leaf,...images].map((el,i)=>['e'+i,el]));
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
    const el=selected();if(!el||el.tagName==='IMG'||state.busy)return;const clean=sanitizeHTML(html);if(el.innerHTML===clean)return;
    remember(state.current+':'+state.selected+':'+key);el.innerHTML=clean;updateSource(page());
    if(!fromFrame)patch({key:state.selected,html:clean});changed();
  }
  function mutateStyle(name,value){
    const el=selected();if(!el||state.busy)return;remember(state.current+':'+state.selected+':'+name+':'+Date.now());
    if(value)el.style.setProperty(name,value);else el.style.removeProperty(name);
    if(!el.getAttribute('style'))el.removeAttribute('style');updateSource(page());patch({key:state.selected,style:{[name]:value}});changed();
  }
  function displayImage(src){const file=state.assets[src];return file?'data:'+file.mime+';base64,'+file.data:new URL(src,siteBase).href;}
  function selection(data){
    const el=page()?.map.get(data.key);if(!el)return;
    state.selected=data.key;state.lastTransaction='';$('selection-empty').hidden=true;
    const image=el.tagName==='IMG';$('text-panel').hidden=image;$('image-panel').hidden=!image;
    if(image){$('selected-image').src=displayImage(el.getAttribute('src'));$('image-alt').value=el.alt;$('image-fit').value=el.style.objectFit||'';$('image-file').value='';}
    else{
      $('text-kind').textContent=el.tagName.startsWith('H')?'HEADING':'TEXT';$('text-value').value=data.text||textOf(el);$('font-size').value=Math.round(data.fontSize||0)||'';
      const match=(data.color||'').match(/\d+/g);if(match?.length>=3)$('text-color').value='#'+match.slice(0,3).map(v=>Number(v).toString(16).padStart(2,'0')).join('');
      $('bold').setAttribute('aria-pressed',String(!!data.bold));$('italic').setAttribute('aria-pressed',String(!!data.italic));$('text-align').value=el.style.textAlign||'';
      $('link-fields').hidden=el.tagName!=='A';$('link-value').value=el.getAttribute('href')||'';
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
    state.selected=null;$('selection-empty').hidden=false;$('text-panel').hidden=true;$('image-panel').hidden=true;
    $('page-select').value=state.current;$('page-name').textContent=labels[state.current];
    const copy=parse(p.source);copy.querySelectorAll('script,base,meta[http-equiv]').forEach(el=>el.remove());
    copy.querySelectorAll('*').forEach(el=>{for(const attr of [...el.attributes])if(attr.name.startsWith('on')||attr.name==='srcdoc')el.removeAttribute(attr.name);});
    const clonePage={doc:copy};buildMap(clonePage);for(const [key,el]of clonePage.map)el.dataset.editorKey=key;
    const assetTasks=[];
    for(const img of copy.querySelectorAll('img')){const source=img.getAttribute('src'),asset=state.assets[source];if(asset)img.src='data:'+asset.mime+';base64,'+asset.data;else if(source&&!source.startsWith('data:'))assetTasks.push(cachedPreview(new URL(source,siteBase).href,'image').then(data=>{img.src=data;}));}
    for(const link of copy.querySelectorAll('link[rel=stylesheet]'))assetTasks.push(cachedPreview(new URL(link.getAttribute('href'),siteBase).href).then(text=>{const style=copy.createElement('style');style.textContent=text;link.replaceWith(style);}));
    const bridge=await cachedPreview(new URL('editor-bridge.js',siteBase).href);
    const bridgeHash=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(bridge)))));
    const assets=await Promise.allSettled(assetTasks);for(const result of assets)if(result.status==='rejected')throw result.reason;
    if(generation!==renderGeneration)return;
    const base=copy.createElement('base');base.href=siteBase;copy.head.prepend(base);
    const csp=copy.createElement('meta');csp.httpEquiv='Content-Security-Policy';csp.content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; script-src 'sha256-"+bridgeHash+"'; object-src 'none'; form-action 'none'";copy.head.prepend(csp);
    const styles=copy.createElement('style');styles.textContent='[data-editor-key]{cursor:text!important;transition:outline-color .1s}img[data-editor-key]{cursor:pointer!important}[data-editor-key]:hover{outline:2px dashed #529dba;outline-offset:4px}[data-editor-selected]{outline:2px solid #246b9c!important;outline-offset:4px}input,select,textarea,button{pointer-events:none!important}';copy.head.appendChild(styles);
    const script=copy.createElement('script');script.textContent=bridge;copy.body.appendChild(script);frame.srcdoc='<!doctype html>\n'+copy.documentElement.outerHTML;
    renderSections();
    }catch(error){status(error.message,true);}
  }
  window.addEventListener('message',event=>{
    if(event.source!==frame.contentWindow||!event.data)return;const data=event.data;
    if(data.type==='editor-ready'){frame.contentWindow.postMessage({type:'initialize',channel},'*');return;}
    if(data.channel!==channel)return;
    if(data.type==='selection')selection(data);
    else if(data.type==='edit'&&state.selected===data.key){mutateText(data.html,'typing',true);if(document.activeElement!==$('text-value'))$('text-value').value=data.text;}
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
  $('page-select').addEventListener('change',()=>{state.current=$('page-select').value;render();});
  $('desktop-view').addEventListener('click',()=>{$('stage').classList.remove('mobile');$('desktop-view').setAttribute('aria-pressed','true');$('mobile-view').setAttribute('aria-pressed','false');$('desktop-view').classList.add('selected');$('mobile-view').classList.remove('selected');});
  $('mobile-view').addEventListener('click',()=>{$('stage').classList.add('mobile');$('desktop-view').setAttribute('aria-pressed','false');$('mobile-view').setAttribute('aria-pressed','true');$('mobile-view').classList.add('selected');$('desktop-view').classList.remove('selected');});
  $('text-value').addEventListener('input',()=>mutateText(plainHTML($('text-value').value),'sidebar'));
  $('font-size').addEventListener('change',()=>{const n=Number($('font-size').value);if(n>=8&&n<=120)mutateStyle('font-size',n+'px');else if(!$('font-size').value)mutateStyle('font-size','');});
  $('text-color').addEventListener('input',()=>mutateStyle('color',$('text-color').value));
  $('text-align').addEventListener('change',()=>mutateStyle('text-align',$('text-align').value));
  $('bold').addEventListener('click',()=>{const enabled=$('bold').getAttribute('aria-pressed')!=='true';$('bold').setAttribute('aria-pressed',String(enabled));mutateStyle('font-weight',enabled?'700':'400');});
  $('italic').addEventListener('click',()=>{const enabled=$('italic').getAttribute('aria-pressed')!=='true';$('italic').setAttribute('aria-pressed',String(enabled));mutateStyle('font-style',enabled?'italic':'normal');});
  $('reset-format').addEventListener('click',()=>{for(const name of ['font-size','color','font-weight','font-style','text-align'])mutateStyle(name,'');$('font-size').value='';$('text-align').value='';});
  $('apply-link').addEventListener('click',()=>{try{const el=selected();if(el?.tagName!=='A')return;const value=safeLink($('link-value').value);remember('link:'+Date.now());el.setAttribute('href',value);updateSource(page());patch({key:state.selected,href:value});changed();status('Link updated in your draft.');}catch(error){status(error.message,true);}});
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
      for(const p of targets){let touched=false;for(const image of p.doc.querySelectorAll('img'))if(image.getAttribute('src')===old){image.setAttribute('src',path);touched=true;}
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
  load();
})();
