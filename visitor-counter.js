/* Read only GoatCounter's deliberately public total; private analytics stay in its dashboard. */
(function(root){
  'use strict';
  function displayCount(value){
    if(typeof value!=='string'&&typeof value!=='number')return null;
    const cleaned=String(value).replace(/[,\s\u00a0\u202f]/g,'');
    if(!/^\d+$/.test(cleaned))return null;
    const n=Number(cleaned);return Number.isSafeInteger(n)&&n>=0?n.toLocaleString():null;
  }
  if(typeof module==='object'&&module.exports)module.exports={displayCount};
  if(!root.document)return;
  const value=root.document.querySelector('[data-visitor-total]');if(!value)return;
  // Avoid fetching personal-site analytics inside visual-editor frames or local previews.
  if(root.location.hostname!=='varnaresh17.github.io'||root.self!==root.top)return;
  root.fetch('https://varnaresh17.goatcounter.com/counter/TOTAL.json',{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(10000)})
    .then(response=>{if(!response.ok)throw Error('Counter unavailable');return response.json();})
    .then(data=>{const count=displayCount(data.count);if(count===null)throw Error('Invalid count');value.textContent=count;value.closest('.site-visit-counter').title='Aggregate site visits since tracking began. Public totals can take up to four hours to refresh.';})
    .catch(()=>{value.textContent='—';value.closest('.site-visit-counter').title='The visit count is temporarily unavailable.';});
})(typeof window==='undefined'?{}:window);
