/* Aggregate page visits and named actions only; never send uploaded spectra or input values. */
(function(){
  'use strict';
  if(location.hostname!=='varnaresh17.github.io'||window.self!==window.top||location.pathname.endsWith('/editor.html'))return;
  if(window.__researchAnalyticsLoaded)return;
  window.__researchAnalyticsLoaded=true;
  const cleanReferrer=()=>{try{const url=new URL(document.referrer);return url.origin+url.pathname;}catch{return '';}};
  window.goatcounter={path:()=>location.pathname==='/'?'/index.html':location.pathname,referrer:cleanReferrer,no_events:true};
  const script=document.createElement('script');
  script.src='https://gc.zgo.at/count.js';script.async=true;
  script.dataset.goatcounter='https://varnaresh17.goatcounter.com/count';
  document.head.append(script);
  const actions={
    'ftir-detect':'ftir-detect-peaks','ftir-interpret-list':'ftir-interpret-peaks',
    'color-calculate':'cie-coordinate-calculate','color-integrate':'cie-spectrum-calculate',
    'color-from-temperature':'cct-to-xy-calculate','gamut-calculate':'color-gamut-calculate',
    'lighting-quality-run':'lighting-quality-calculate','led-calculate':'led-efficiency-calculate',
    'photo-calculate':'photobiological-calculate','qy-run-sphere':'plqy-absolute-calculate',
    'qy-run-relative':'plqy-relative-calculate','qy-run-series':'plqy-series-calculate',
    'qy-run-rates':'plqy-rates-calculate'
  };
  function send(name){if(typeof window.goatcounter?.count==='function')window.goatcounter.count({path:name,title:name.replace(/-/g,' '),event:true});}
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(button&&actions[button.id])send(actions[button.id]);
    const link=event.target.closest('a[href]');if(!link)return;
    let url;try{url=new URL(link.href,location.href);}catch{return;}
    if(url.origin===location.origin&&url.pathname.endsWith('/resume.html'))send('cv-open');
    const paper=link.closest('.publication-item');
    if(paper&&url.origin!==location.origin)send('publication-link-'+paper.id);
  });
  document.addEventListener('submit',event=>{
    if(event.target.id==='bragg-form')send('xrd-bragg-calculate');
    if(event.target.id==='crystal-form')send('xrd-crystallinity-calculate');
  });
})();
