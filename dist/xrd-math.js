/* Deterministic XRD calculations. Lengths supplied in one consistent unit. */
(function(root){
 'use strict';
 const positive=(v,name)=>{if(!Number.isFinite(v)||v<=0)throw new RangeError(name+' must be a finite number greater than zero.');};
 function bragg({solve='d',wavelength,d,twoTheta,order=1}){
  if(!Number.isSafeInteger(order)||order<1)throw new RangeError('Diffraction order n must be a positive whole number.');
  if(!['d','angle','wavelength'].includes(solve))throw new RangeError('Choose a supported Bragg quantity.');
  if(solve!=='wavelength')positive(wavelength,'Wavelength');
  if(solve!=='d')positive(d,'d-spacing');
  if(solve!=='angle'){
   positive(twoTheta,'Peak position 2θ');
   if(twoTheta>180)throw new RangeError('Peak position 2θ must be greater than 0° and at most 180°.');
  }
  if(solve==='d')d=order*wavelength/(2*Math.sin(twoTheta*Math.PI/360));
  if(solve==='angle'){
   const ratio=order*wavelength/(2*d);
   if(!Number.isFinite(ratio)||ratio>1+1e-12)throw new RangeError('No real Bragg angle: nλ must be no greater than 2d.');
   twoTheta=2*Math.asin(Math.min(1,ratio))*180/Math.PI;
  }
  if(solve==='wavelength')wavelength=2*d*Math.sin(twoTheta*Math.PI/360)/order;
  positive(d,'Calculated d-spacing');positive(wavelength,'Calculated wavelength');positive(twoTheta,'Calculated peak position');
  return {d,wavelength,twoTheta,theta:twoTheta/2,order};
 }
 function crystallinity({crystalline,other,mode='total'}){
  if(!['total','amorphous'].includes(mode))throw new RangeError('Choose total or amorphous area.');
  for(const [name,value] of [['Crystalline area',crystalline],['Second area',other]]){
   if(!Number.isFinite(value)||value<0)throw new RangeError(name+' must be a finite, nonnegative number.');
  }
  const total=mode==='total'?other:crystalline+other;
  positive(total,'Total integrated area');
  if(crystalline>total)throw new RangeError('Crystalline area cannot exceed the total area.');
  const percent=100*(crystalline/total);
  return {crystalline,total,amorphous:Math.max(0,total-crystalline),percent,amorphousPercent:Math.max(0,100-percent)};
 }
 const api=Object.freeze({bragg,crystallinity});
 if(typeof module==='object'&&module.exports)module.exports=api;else root.XRDMath=api;
})(typeof window==='object'?window:globalThis);
