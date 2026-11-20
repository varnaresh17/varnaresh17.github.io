/* Topic-filtered bibliography. Activities are intentionally outside this collection. */
(function(root){
  'use strict';
  const normalize=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[‐‑‒–—−]/g,'-');
  function matches(record,filters){
    const words=normalize(filters.q).trim().split(/\s+/).filter(Boolean);
    return (!filters.topic||record.topics.includes(filters.topic))&&(!filters.type||filters.type==='all'||record.type===filters.type)&&(!filters.category||record.category===filters.category)&&words.every(word=>normalize(record.search).includes(word));
  }
  const core={normalize,matches};
  if(typeof module==='object'&&module.exports)module.exports=core;
  if(!root.document)return;
  const doc=root.document,browser=doc.querySelector('.publication-browser');if(!browser)return;
  const items=[...browser.querySelectorAll('.publication-item')];
  const records=items.map(el=>({el,id:el.id,type:el.dataset.type,category:el.dataset.category,topics:el.dataset.topics.split(' '),search:el.dataset.search}));
  const topicLinks=[...doc.querySelectorAll('.publication-topic')];
  const labels=new Map([...browser.querySelectorAll('.publication-topic-list .publication-topic')].map(el=>[el.dataset.topic,el.childNodes[0].textContent.trim()]));
  const input=doc.querySelector('#publication-search'),type=doc.querySelector('#publication-type'),status=doc.querySelector('#publication-status');
  const activities=doc.querySelector('#academic-activities');
  let topic='',category='';
  const legacyTypes={'published-articles':'journal','published-proceedings':'proceeding','conference-proceedings':'proceeding','symposium-proceedings':'proceeding','book-chapters':'proceeding'};
  const aliases={nanoplatelets:'npls',other:'biosensors'};
  function readLocation(){
    const url=new URL(root.location.href);let hash='';try{hash=decodeURIComponent(url.hash.slice(1));}catch{hash='';}category='';
    const area=url.searchParams.get('area')||'';
    topic=labels.has(hash)?hash:labels.has(aliases[hash])?aliases[hash]:labels.has(area)?area:'';
    // Historic broad categories retain their complete topic union.
    if(!topic&&area==='other')topic='other';
    type.value=['journal','proceeding'].includes(url.searchParams.get('type'))?url.searchParams.get('type'):'all';
    input.value=url.searchParams.get('q')||'';
    if(legacyTypes[hash]){topic='';type.value=legacyTypes[hash];category=['symposium-proceedings','book-chapters'].includes(hash)?'symposium':hash==='conference-proceedings'?'conference':'';}
    const target=doc.getElementById(hash);
    if(target?.closest('#academic-activities'))activities.open=true;
    if(records.some(r=>r.id===hash)){topic='';type.value='all';input.value='';}
    update();
    if(target&&(!labels.has(hash)))requestAnimationFrame(()=>target.scrollIntoView({block:'start'}));
  }
  function selected(record){return topic==='other'?record.topics.some(t=>['biosensors','water-treatment'].includes(t))&&matches(record,{type:type.value,q:input.value}):matches(record,{topic,type:type.value,category,q:input.value});}
  function update(){
    let count=0;for(const record of records){const visible=selected(record);record.el.hidden=!visible;if(visible)count++;}
    const filterText=topic?' tagged “'+(labels.get(topic)||'Biosensors & Water Treatment')+'”':'';
    const typeText=category==='symposium'?' · Symposium proceedings':category==='conference'?' · Conference proceedings':type.value==='journal'?' · Journal articles':type.value==='proceeding'?' · Published proceedings':'';
    const searchText=input.value.trim()?' matching “'+input.value.trim()+'”':'';
    status.textContent=(count===records.length&&!topic&&!searchText&&type.value==='all'?'Showing all '+records.length+' publications.':'Showing '+count+' of '+records.length+' publications'+filterText+searchText+'.')+typeText;
    doc.querySelector('#publication-empty').hidden=count!==0;
    for(const link of topicLinks){const active=link.dataset.topic===topic;link.classList.toggle('active',active);link.setAttribute('aria-pressed',String(active));}
  }
  function writeLocation(push=false){
    category='';const url=new URL(root.location.href);url.searchParams.delete('area');
    if(input.value.trim())url.searchParams.set('q',input.value.trim());else url.searchParams.delete('q');
    if(type.value!=='all')url.searchParams.set('type',type.value);else url.searchParams.delete('type');
    url.hash=topic;
    root.history[push?'pushState':'replaceState'](null,'',url);update();
  }
  function reset(event){event?.preventDefault();topic='';input.value='';type.value='all';writeLocation(true);}
  for(const link of topicLinks)link.addEventListener('keydown',event=>{if(event.key===' '){event.preventDefault();link.click();}});
  for(const link of topicLinks)link.addEventListener('click',event=>{
    event.preventDefault();topic=topic===link.dataset.topic?'':link.dataset.topic;writeLocation(true);
    if(link.closest('.publication-item'))browser.scrollIntoView({block:'start'});
  });
  for(const jump of doc.querySelectorAll('.publication-summary [data-publication-type]'))jump.addEventListener('click',event=>{
    event.preventDefault();
    const url=new URL(root.location.href);
    for(const param of ['area','q'])url.searchParams.delete(param);
    url.searchParams.set('type',jump.dataset.publicationType);
    url.hash=jump.getAttribute('href');
    root.history.pushState(null,'',url);readLocation();
  });
  input.addEventListener('input',()=>writeLocation());type.addEventListener('change',()=>writeLocation(true));
  doc.querySelector('#publication-show-all').addEventListener('click',reset);
  doc.querySelector('.publication-reset').addEventListener('click',reset);
  root.addEventListener('hashchange',readLocation);root.addEventListener('popstate',readLocation);
  readLocation();
})(typeof window==='undefined'?{}:window);
