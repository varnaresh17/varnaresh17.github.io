/* Render a public, pre-fetched snapshot. No secret or paid API request runs in the browser. */
(function(root){
  'use strict';
  const safeLink=value=>{try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='scholar.google.com'&&['/scholar','/citations'].includes(u.pathname)?u.href:null;}catch{return null;}};
  const validCount=n=>Number.isSafeInteger(n)&&n>=0;
  const api={safeLink,validCount};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(!root.document)return;
  const doc=root.document,section=doc.querySelector('#scholar-impact');if(!section)return;
  const number=n=>validCount(n)?n.toLocaleString():'—';
  function element(tag,text,className){const el=doc.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;}
  function citationLink(article){const link=element('a',validCount(article.citations)?'Cited by '+number(article.citations):'View on Scholar','scholar-citation');link.href=safeLink(article.citingUrl)||safeLink(article.url)||section.querySelector('.scholar-profile').href;link.target='_blank';link.rel='noopener noreferrer';return link;}
  function render(data){
    if(data.status!=='ready'||!data.updatedAt||!Array.isArray(data.articles))return;
    const updated=new Date(data.updatedAt);if(!Number.isFinite(updated.getTime()))throw Error('Invalid timestamp');
    section.querySelector('.scholar-metrics').hidden=false;
    const labels={citations:'Total citations',h_index:'h-index',i10_index:'i10-index'};
    for(const [key,label] of Object.entries(labels)){
      const tile=element('div',undefined,'scholar-metric');
      tile.append(element('dt',label),element('dd',number(data.metrics?.[key]?.all)));
      section.querySelector('.scholar-metrics').append(tile);
    }
    const age=(Date.now()-updated.getTime())/86400000;
    const stamp=section.querySelector('#scholar-status');
    stamp.textContent='Google Scholar · Updated '+updated.toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})+(age>3?' · Update delayed; showing the last successful snapshot.':' · Scheduled daily refresh.');
    section.querySelector('.scholar-explanation').hidden=false;
    const articles=new Map(data.articles.map(a=>[a.id,a]));
    for(const item of doc.querySelectorAll('.publication-item')){
      const article=articles.get(data.publicationMap?.[item.id]);
      const box=element('div',undefined,'scholar-paper-metric');
      if(article){
        box.append(citationLink(article));
        if(Number.isSafeInteger(article.change)&&article.change!==0){
          const label=(article.change>0?'+':'')+article.change+' since previous sync';
          box.append(element('span',label,'scholar-change'));
        }
      }else box.append(element('span','Citation count not yet matched','scholar-unmatched'));
      item.querySelector('.publication-copy').append(box);
    }
    const graph=(data.citationsByYear||[]).filter(r=>validCount(r.year)&&validCount(r.citations)).sort((a,b)=>a.year-b.year);
    if(graph.length){
      const panel=section.querySelector('.scholar-history');panel.hidden=false;
      const list=panel.querySelector('.scholar-bars'),max=Math.max(1,...graph.map(r=>r.citations));
      for(const row of graph){
        const bar=element('div',undefined,'scholar-bar');bar.setAttribute('role','listitem');
        bar.append(element('span',String(row.year),'scholar-bar-year'));
        const track=element('span',undefined,'scholar-bar-track'),fill=element('span',undefined,'scholar-bar-fill');
        fill.style.width=(100*row.citations/max)+'%';track.append(fill);
        bar.append(track,element('span',number(row.citations),'scholar-bar-count'));list.append(bar);
      }
    }
    const extra=(data.additionalArticleIds||[]).map(id=>articles.get(id)).filter(Boolean);
    if(extra.length){
      const panel=section.querySelector('.scholar-additional');panel.hidden=false;
      panel.querySelector('summary').textContent='Additional articles on Google Scholar ('+extra.length+')';
      const list=panel.querySelector('ul');
      for(const a of extra){const item=element('li'),title=element('a',a.title);title.href=safeLink(a.url)||section.querySelector('.scholar-profile').href;title.target='_blank';title.rel='noopener noreferrer';item.append(title,element('p',[a.authors,a.publication,a.year].filter(Boolean).join(' · ')),citationLink(a));list.append(item);}
    }
  }
  fetch('scholar-data.json',{cache:'no-cache'}).then(response=>{if(!response.ok)throw Error('No snapshot');return response.json();}).then(render).catch(()=>{
    section.querySelector('#scholar-status').textContent='Citation updates are temporarily unavailable. The publication list remains available below.';
  });
})(typeof window==='undefined'?{}:window);
