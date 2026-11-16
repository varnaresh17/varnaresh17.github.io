'use strict';
(()=>{
 const host=document.querySelector('#xrd-calculators');if(!host)return;
 const $=id=>host.querySelector('#'+id);
 const fmt=n=>Number(n.toPrecision(6)).toLocaleString('en-US',{maximumSignificantDigits:6,useGrouping:false});
 const unit=()=> $('bragg-unit').value==='nm'?'nm':'Å';
 const read=id=>{const e=$(id),v=e.value.trim();if(!v)throw {incomplete:true};return Number(v);};
 const braggFields=['bragg-wave','bragg-d','bragg-angle','bragg-order'];
 let lastUnit=$('bragg-unit').value;
 function clearState(ids){ids.forEach(id=>$(id).removeAttribute('aria-invalid'));}
 function report(output,message,error=false){output.classList.toggle('is-error',error);output.textContent=message;}
 function clearBragg(){
  $('bragg-primary').textContent='—';$('bragg-secondary').textContent='';$('bragg-substitution').textContent='';
 }
 function updateBragg(){
  const solve=$('bragg-solve').value;
  for(const [id,hidden] of [['bragg-wave',solve==='wavelength'],['bragg-d',solve==='d'],['bragg-angle',solve==='angle']]){
   $(id).closest('.xrd-field').hidden=hidden;$(id).disabled=hidden;
  }
  $('bragg-result-label').textContent={d:'Interplanar spacing d',angle:'Peak position 2θ',wavelength:'X-ray wavelength λ'}[solve];
  clearState(braggFields);clearBragg();
  try{
   const args={solve,order:read('bragg-order')};
   if(solve!=='wavelength')args.wavelength=read('bragg-wave');
   if(solve!=='d')args.d=read('bragg-d');
   if(solve!=='angle')args.twoTheta=read('bragg-angle');
   const v=window.XRDMath.bragg(args),u=unit(),scale=u==='Å'?0.1:10,alternate=u==='Å'?'nm':'Å';
   if(solve==='angle'){
    $('bragg-primary').textContent=fmt(v.twoTheta)+'°';$('bragg-secondary').textContent='Bragg angle θ = '+fmt(v.theta)+'°';
   }else{
    const value=solve==='d'?v.d:v.wavelength;
    $('bragg-primary').textContent=fmt(value)+' '+u;$('bragg-secondary').textContent=fmt(value*scale)+' '+alternate;
   }
   const expressions={d:`d = (${fmt(v.order)} × ${fmt(v.wavelength)} ${u}) / [2 sin(${fmt(v.theta)}°)]`,angle:`2θ = 2 arcsin[(${fmt(v.order)} × ${fmt(v.wavelength)} ${u}) / (2 × ${fmt(v.d)} ${u})]`,wavelength:`λ = 2 × ${fmt(v.d)} ${u} × sin(${fmt(v.theta)}°) / ${fmt(v.order)}`};
   $('bragg-substitution').textContent=expressions[solve];
   report($('bragg-message'),'Calculated using θ = 2θ / 2 = '+fmt(v.theta)+'°.');
  }catch(err){
   if(err.incomplete)report($('bragg-message'),'Enter the known values to calculate the result.');
   else{report($('bragg-message'),err.message||'Check the entered values.',true);braggFields.forEach(id=>{const e=$(id);if(!e.disabled&&e.value!==''&&(!Number.isFinite(Number(e.value))||Number(e.value)<=0||(id==='bragg-order'&&!Number.isSafeInteger(Number(e.value)))||(id==='bragg-angle'&&Number(e.value)>180)))e.setAttribute('aria-invalid','true');});}
  }
 }
 function updateCrystal(){
  const mode=$('crystal-mode').value;clearState(['crystal-ac','crystal-other']);
  $('crystal-other-label').innerHTML=mode==='total'?'<span class="input-area-tag tag-total">At</span> Total integrated area':'<span class="input-area-tag tag-amorphous">Aa</span> Amorphous area';
  $('crystal-formula').textContent=mode==='total'?'Xc = 100 × Ac / Aₜ':'Xc = 100 × Ac / (Ac + Aₐ)';
  $('crystal-primary').textContent='—';$('crystal-secondary').textContent='';$('crystal-substitution').textContent='';$('crystal-bar').hidden=true;
  try{
   const v=window.XRDMath.crystallinity({crystalline:read('crystal-ac'),other:read('crystal-other'),mode});
   $('crystal-primary').textContent=fmt(v.percent)+'%';$('crystal-secondary').textContent='Amorphous contribution: '+fmt(v.amorphousPercent)+'%';
   $('crystal-substitution').textContent='Xc = 100 × '+fmt(v.crystalline)+' / '+fmt(v.total)+' = '+fmt(v.percent)+'%';
   $('crystal-bar').hidden=false;$('crystal-fill').style.width=v.percent+'%';
   $('crystal-bar').setAttribute('aria-label','Crystalline '+fmt(v.percent)+' percent; amorphous '+fmt(v.amorphousPercent)+' percent.');
   report($('crystal-message'),'Area-based estimate over the selected diffraction range.');
  }catch(err){
   if(err.incomplete)report($('crystal-message'),'Enter both integrated areas to calculate crystallinity.');
   else{report($('crystal-message'),err.message||'Check the entered areas.',true);['crystal-ac','crystal-other'].forEach(id=>{const e=$(id);if(e.value!==''&&(!Number.isFinite(Number(e.value))||Number(e.value)<0))e.setAttribute('aria-invalid','true');});}
  }
 }
 const bragg=$('bragg-form'),crystal=$('crystal-form');
 bragg.addEventListener('submit',e=>e.preventDefault());crystal.addEventListener('submit',e=>e.preventDefault());
 bragg.addEventListener('input',updateBragg);bragg.addEventListener('change',e=>{
  if(e.target.id==='bragg-unit'){
   const next=$('bragg-unit').value,scale=lastUnit===next?1:lastUnit==='angstrom'?0.1:10;
   ['bragg-wave','bragg-d'].forEach(id=>{const e=$(id);if(e.value!==''&&Number.isFinite(Number(e.value)))e.value=Number((Number(e.value)*scale).toPrecision(12));});lastUnit=next;
  }updateBragg();
 });
 crystal.addEventListener('input',updateCrystal);crystal.addEventListener('change',updateCrystal);
 $('bragg-example').addEventListener('click',()=>{$('bragg-solve').value='d';$('bragg-unit').value='angstrom';lastUnit='angstrom';$('bragg-wave').value='1.5406';$('bragg-angle').value='30';$('bragg-order').value='1';$('bragg-d').value='';updateBragg();});
 $('bragg-clear').addEventListener('click',()=>{bragg.reset();lastUnit=$('bragg-unit').value;updateBragg();});
 $('crystal-example').addEventListener('click',()=>{$('crystal-mode').value='total';$('crystal-ac').value='60';$('crystal-other').value='100';host.querySelector('[data-xrd-area="total"]').click();updateCrystal();});
 $('crystal-clear').addEventListener('click',()=>{crystal.reset();updateCrystal();});
 function revealTools(){
  if(!document.querySelector('#xrd').hidden)return;
  const search=document.querySelector('#technique-search');
  if(search){search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));}
  document.querySelector('[data-technique-filter="all"]')?.click();
 }
 document.querySelectorAll('a[href="#xrd-calculators"]').forEach(link=>link.addEventListener('click',revealTools));
 window.addEventListener('hashchange',()=>{if(location.hash==='#xrd-calculators')revealTools();});
 const areaDescriptions={
  total:'<strong>At = total area.</strong> Add the green crystalline regions and the gold amorphous region, after background correction.',
  crystalline:'<strong>Ac = crystalline area.</strong> Only the green areas above the fitted amorphous curve count. Sum all crystalline peaks; do not use their heights.',
  amorphous:'<strong>Aa = amorphous area.</strong> Only the gold area under the broad fitted halo counts, measured from the corrected zero baseline.'
 };
 const areaAlt={
  total:'Illustrative XRD: green crystalline areas Ac plus gold amorphous area Aa give the total At. Example Ac 60, Aa 40, At 100.',
  crystalline:'Illustrative XRD with the crystalline peak areas Ac highlighted in green above the fitted amorphous curve. Other contributions are faded.',
  amorphous:'Illustrative XRD with the broad amorphous halo area Aa highlighted in gold above the background-corrected zero baseline. Crystalline peaks are faded.'
 };
 host.querySelectorAll('[data-xrd-area]').forEach(button=>button.addEventListener('click',()=>{
  const state=button.dataset.xrdArea;
  host.querySelectorAll('[data-xrd-area]').forEach(b=>{const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  $('area-figure').src='assets/xrd-areas/'+state+'.svg';$('area-figure').alt=areaAlt[state];
  $('area-figure-link').href='assets/xrd-areas/'+state+'.svg';$('area-guide-focus').innerHTML=areaDescriptions[state];
 }));
 updateBragg();updateCrystal();
})();
