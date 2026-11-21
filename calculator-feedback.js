/* Public calculator feedback: no API keys, private measurements or automatic posting. */
(function(root){
 'use strict';
 const REPO='varnaresh17/varnaresh17.github.io',WEB='https://github.com/'+REPO,API='https://api.github.com/';
 const SCOPES={
  'xrd-bragg':{name:'XRD: Bragg’s law and d-spacing',page:'xrd.html',anchor:'bragg-title'},
  'xrd-crystallinity':{name:'XRD: crystallinity by integrated area',page:'xrd.html',anchor:'crystal-title'},
  'ftir-data':{name:'FTIR: uploaded numerical spectra',page:'ftir.html',anchor:'ftir-data-panel'},
  'ftir-image':{name:'FTIR: uploaded spectrum images',page:'ftir.html',anchor:'ftir-image-panel'},
  'ftir-peaks':{name:'FTIR: manually entered peak positions',page:'ftir.html',anchor:'ftir-peaks-panel'},
  'color-cie':{name:'CIE color coordinates, CCT and Duv',page:'colorimetry.html',anchor:'color-results'},
  'color-gamut':{name:'RGB color gamut and coverage',page:'colorimetry.html',anchor:'rgb-gamut'},
  'color-rendering':{name:'Color rendering: CRI, CQS and TM-30',page:'colorimetry.html',anchor:'light-quality'},
  'led-efficiency':{name:'LED efficiency and efficacy',page:'colorimetry.html',anchor:'led-efficiency'},
  'photobiology':{name:'Photobiological spectral quantities',page:'colorimetry.html',anchor:'photobiology'},
  'plqy-sphere':{name:'PLQY: integrating-sphere method',page:'plqy.html',anchor:'qy-sphere-panel'},
  'plqy-relative':{name:'PLQY: relative-standard method',page:'plqy.html',anchor:'qy-relative-panel'},
  'plqy-series':{name:'PLQY: dilution-series method',page:'plqy.html',anchor:'qy-series-panel'},
  'plqy-rates':{name:'Photoluminescence lifetime and rates',page:'plqy.html',anchor:'qy-rates-panel'}
 };
 const KINDS=['Suggestion','Calculation concern','Technical problem','Explanation or usability'];
 const validScope=scope=>Object.hasOwn(SCOPES,scope);
 function scopeInfo(scope){if(!validScope(scope))throw Error('Unknown calculator.');return SCOPES[scope];}
 function searchQuery(scope){scopeInfo(scope);return 'repo:'+REPO+' is:issue in:title "Calculator feedback" "'+scope+'"';}
 function listingURL(scope){const u=new URL(WEB+'/issues');u.searchParams.set('q',searchQuery(scope));return u.href;}
 function marker(scope){scopeInfo(scope);return '<!-- nv-calculator-feedback:v1 '+scope+' -->';}
 function compose(scope,kind,comment){
  const info=scopeInfo(scope),text=String(comment||'').trim();
  if(!KINDS.includes(kind))throw Error('Choose a feedback type.');
  if(text.length<10||text.length>1000)throw Error('Write a comment of 10 to 1,000 characters.');
  const title='[Calculator feedback] ['+scope+'] '+kind;
  const body=[marker(scope),'Calculator: '+info.name,'Page: https://varnaresh17.github.io/'+info.page+'#'+info.anchor,'Type: '+kind,'','### Feedback',text].join('\n');
  const url=new URL(WEB+'/issues/new');url.searchParams.set('title',title);url.searchParams.set('body',body);
  if(url.href.length>7500)throw Error('Please shorten the comment before continuing to GitHub.');
  return {title,body,url:url.href};
 }
 function validNumber(n){return Number.isSafeInteger(n)&&n>0;}
 function normalizeIssue(issue,scope){
  scopeInfo(scope);
  if(!issue||issue.pull_request||!validNumber(issue.number)||typeof issue.body!=='string'||!issue.body.startsWith(marker(scope)+'\n')||typeof issue.title!=='string'||!issue.title.startsWith('[Calculator feedback] ['+scope+'] '))return null;
  const split=issue.body.indexOf('\n### Feedback\n');if(split<0)return null;
  const created=new Date(issue.created_at);if(!Number.isFinite(created.getTime()))return null;
  return {number:issue.number,url:WEB+'/issues/'+issue.number,author:String(issue.user?.login||'GitHub user').slice(0,80),date:created.toISOString(),body:issue.body.slice(split+14).trim().slice(0,2000),closed:issue.state==='closed',replies:Number.isSafeInteger(issue.comments)&&issue.comments>=0?issue.comments:0};
 }
 function normalizeSearch(data,scope){
  if(!data||!Array.isArray(data.items)||!Number.isSafeInteger(data.total_count)||data.total_count<0)throw Error('Invalid feedback response.');
  return {items:data.items.map(row=>normalizeIssue(row,scope)).filter(Boolean),more:data.total_count>data.items.length||!!data.incomplete_results};
 }
 function normalizeReplies(data,number){
  if(!validNumber(number)||!Array.isArray(data))throw Error('Invalid reply response.');
  return data.filter(row=>row&&validNumber(row.id)&&typeof row.body==='string'&&Number.isFinite(Date.parse(row.created_at))).map(row=>({author:String(row.user?.login||'GitHub user').slice(0,80),body:row.body.slice(0,3000),date:new Date(row.created_at).toISOString(),url:WEB+'/issues/'+number+'#issuecomment-'+row.id}));
 }
 class ReadError extends Error{constructor(status){super('Feedback request failed.');this.status=status;}}
 function errorMessage(error){
  if([403,429].includes(error.status))return 'GitHub’s request limit may have been reached. Try later, or read the comments directly on GitHub.';
  if(error.status===404||error.status===410)return 'This conversation is unavailable. You can still open the repository’s feedback page.';
  return 'Comments could not be loaded. Check your connection or read them directly on GitHub.';
 }
 function createClient(fetcher,timeoutMs=15000){
  const cache=new Map();
  async function request(url){
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
   try{
    const response=await fetcher(url,{method:'GET',headers:{Accept:'application/vnd.github+json'},credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:controller.signal});
    if(!response.ok)throw new ReadError(response.status);
    return await response.json();
   }catch(error){throw error instanceof ReadError?error:new ReadError(0);}finally{clearTimeout(timer);}
  }
  return {
   async comments(scope,refresh=false){
    scopeInfo(scope);const saved=cache.get(scope);if(!refresh&&saved&&Date.now()-saved.time<60000)return saved.value;
    const url=new URL('search/issues',API);url.searchParams.set('q',searchQuery(scope));url.searchParams.set('sort','created');url.searchParams.set('order','desc');url.searchParams.set('per_page','20');
    const value=normalizeSearch(await request(url.href),scope);cache.set(scope,{value,time:Date.now()});return value;
   },
   async replies(number){
    if(!validNumber(number))throw new ReadError(400);
    return normalizeReplies(await request(API+'repos/'+REPO+'/issues/'+number+'/comments?per_page=20'),number);
   }
  };
 }
 const core={SCOPES,KINDS,compose,listingURL,searchQuery,normalizeIssue,normalizeSearch,normalizeReplies,createClient,errorMessage,ReadError};
 if(typeof module==='object'&&module.exports)module.exports=core;
 if(!root.document)return;
 const doc=root.document,client=createClient(root.fetch.bind(root));
 function el(tag,text,cls){const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;}
 function link(text,url){const node=el('a',text);node.href=url;node.target='_blank';node.rel='noopener noreferrer';return node;}
 function status(node,text,isError=false){node.textContent=text;node.classList.toggle('feedback-error',isError);}
 function meta(author,date){return '@'+author+' · '+new Date(date).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});}
 for(const host of doc.querySelectorAll('[data-feedback-scope]')){
  const scope=host.dataset.feedbackScope;if(!validScope(scope))continue;
  const info=SCOPES[scope],content=host.querySelector('[data-feedback-root]');if(!content)continue;
  content.replaceChildren();
  content.append(el('h3','Help improve this calculator'),el('p',info.name,'feedback-context'),el('p','Public feedback. A GitHub account is required to post; you can read feedback here without signing in.','feedback-help'));
  const form=el('form'),typeLabel=el('label','Feedback type'),select=el('select');select.id='feedback-kind-'+scope;
  for(const kind of KINDS){const option=el('option',kind);option.value=kind;select.append(option);}typeLabel.htmlFor=select.id;typeLabel.append(select);
  const copyLabel=el('label','Your comment'),textarea=el('textarea');textarea.id='feedback-copy-'+scope;textarea.rows=4;textarea.required=true;textarea.minLength=10;textarea.maxLength=1000;textarea.placeholder='What could be clearer or work better? For a calculation concern, describe the expected and observed behavior.';copyLabel.htmlFor=textarea.id;copyLabel.append(textarea);
  const help=el('p','Your comment will be public. Do not include contact details, passwords or unpublished data. Uploaded spectra and calculator inputs are not attached.','feedback-help');help.id='feedback-help-'+scope;textarea.setAttribute('aria-describedby',help.id);
  const actions=el('div',undefined,'feedback-actions'),submit=el('button','Review & post on GitHub','feedback-primary');submit.type='submit';
  const prepared=link('Open prepared feedback',WEB+'/issues/new');prepared.hidden=true;actions.append(submit,prepared);
  const formStatus=el('p','','feedback-status');formStatus.setAttribute('role','status');formStatus.setAttribute('aria-live','polite');
  form.append(typeLabel,copyLabel,help,actions,formStatus);content.append(form);
  form.addEventListener('submit',event=>{
   event.preventDefault();let entry;try{entry=compose(scope,select.value,textarea.value);}catch(error){status(formStatus,error.message,true);return;}
   prepared.href=entry.url;prepared.hidden=false;
   root.open(entry.url,'_blank','noopener,noreferrer');
   status(formStatus,'Finish by clicking “Submit new issue” on GitHub. Your comment has not been posted yet. If no tab opened, use “Open prepared feedback”.');
  });
  const publicArea=el('section',undefined,'feedback-public'),publicHeader=el('div',undefined,'feedback-list-heading'),load=el('button','Load comments');load.type='button';
  const viewAll=link('View all on GitHub',listingURL(scope));publicHeader.append(el('h3','Community feedback'),load,viewAll);
  const listStatus=el('p','Load comments to read published suggestions and reports.','feedback-status');listStatus.setAttribute('role','status');listStatus.setAttribute('aria-live','polite');
  const list=el('div',undefined,'feedback-list');publicArea.append(publicHeader,listStatus,list);content.append(publicArea);
  let hasLoaded=false;
  load.addEventListener('click',async()=>{
   load.disabled=true;status(listStatus,'Loading public comments…');
   try{
    const data=await client.comments(scope,hasLoaded);list.replaceChildren();
    for(const item of data.items){
     const card=el('article',undefined,'feedback-comment'),header=el('div',undefined,'feedback-comment-meta');header.append(el('span',meta(item.author,item.date)),el('span',item.closed?'Closed':'Open','feedback-state'));card.append(header,el('p',item.body,'feedback-body'));
     const cardActions=el('div',undefined,'feedback-actions');cardActions.append(link('Read or reply on GitHub',item.url));
     if(item.replies>0){
      const show=el('button','Show replies ('+item.replies+')');show.type='button';cardActions.append(show);const replies=el('div',undefined,'feedback-replies');replies.hidden=true;
      show.addEventListener('click',async()=>{
       if(replies.dataset.loaded){replies.hidden=!replies.hidden;show.textContent=replies.hidden?'Show replies ('+item.replies+')':'Hide replies';return;}
       show.disabled=true;replies.hidden=false;replies.textContent='Loading replies…';
       try{const rows=await client.replies(item.number);replies.replaceChildren();for(const row of rows){const reply=el('article',undefined,'feedback-reply');reply.append(el('p',meta(row.author,row.date),'feedback-comment-meta'),el('p',row.body,'feedback-body'));replies.append(reply);}if(!rows.length)replies.append(el('p','No public replies were returned.','feedback-help'));if(item.replies>rows.length)replies.append(link('Read all replies on GitHub',item.url));replies.dataset.loaded='true';show.textContent='Hide replies';}
       catch(error){replies.textContent=errorMessage(error);}finally{show.disabled=false;}
      });card.append(cardActions,replies);
     }else card.append(cardActions);
     list.append(card);
    }
    hasLoaded=true;load.textContent='Refresh comments';
    status(listStatus,data.items.length?(data.more?'Showing recent feedback. More conversations are available on GitHub.':'Public feedback loaded. New submissions may take a moment to appear.'):'No matching public feedback returned yet. You can be the first to suggest an improvement.');
   }catch(error){status(listStatus,errorMessage(error),true);}finally{load.disabled=false;}
  });
 }
})(typeof window==='undefined'?{}:window);
