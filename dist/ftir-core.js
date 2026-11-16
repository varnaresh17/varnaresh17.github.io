/* FTIR candidate-band interpretation: characteristic ranges, not compound identification. */
(function(root){'use strict';
const rules=[
 ['oh',3200,3600,'O–H stretching','Often broad with hydrogen bonding; water can also contribute.'],
 ['free-oh',3600,3650,'Free O–H stretching','Check for a relatively sharp, non-hydrogen-bonded O–H band.'],
 ['nh',3300,3500,'N–H stretching','Usually sharper than hydrogen-bonded O–H; primary amines may give two bands.'],
 ['sp-ch',3260,3340,'Terminal alkyne ≡C–H','A sharp feature near 3300; check the C≡C region as supporting evidence.'],
 ['sp2-ch',3000,3100,'Alkene / aromatic C–H','Check C=C or aromatic-ring bands too.'],
 ['sp3-ch',2850,3000,'Alkyl C–H stretching','CH₂/CH₃ stretching commonly gives several bands.'],
 ['acid-oh',2500,3300,'Possible acid O–H envelope','Only persuasive for a very broad envelope with carbonyl evidence; a narrow band here is insufficient.'],
 ['aldehyde-ch',2700,2850,'Possible aldehydic C–H','Look for the characteristic weak pair and a carbonyl band.'],
 ['nitrile',2220,2260,'C≡N stretching','Usually a relatively sharp nitrile absorption.'],
 ['alkyne',2100,2260,'C≡C stretching','Can be weak or absent in symmetric alkynes; overlaps the nitrile region.'],
 ['carbonyl',1640,1850,'C=O stretching','Carbonyl class depends on position and accompanying bands; this range includes amides.'],
 ['alkene',1620,1680,'C=C stretching','Overlaps carbonyl/imine features and water-related absorption.'],
 ['imine',1640,1690,'C=N stretching','Possible imine-type vibration; requires chemical context.'],
 ['aromatic',1475,1620,'Aromatic-ring vibrations','Check for several ring bands, plus aromatic C–H features.'],
 ['nitro-high',1500,1570,'Possible nitro N–O band','Seek the companion nitro band around 1300–1390 cm⁻¹.'],
 ['nitro-low',1300,1390,'Possible nitro N–O band','Seek the companion nitro band around 1500–1570 cm⁻¹.'],
 ['ch-bend',1350,1470,'CH₂ / CH₃ bending','A fingerprint-region possibility with many competing vibrations.'],
 ['co',1000,1300,'C–O stretching','Common in alcohols, ethers, esters, and acids; not unique to one class.'],
 ['cn',1000,1250,'C–N stretching','Overlaps C–O and other fingerprint-region bands.'],
 ['cf',1000,1400,'Possible C–F stretching','A broad reference region; check the sample composition and full fingerprint.'],
 ['aromatic-bend',675,900,'Aromatic C–H out-of-plane bend','Use the overall substitution pattern, not one isolated band.'],
 ['ccl',600,800,'Possible C–Cl stretching','A low-wavenumber possibility requiring composition-specific confirmation.'],
 ['sh',2550,2600,'S–H stretching','Often weak; use sulfur chemistry and supporting features.'],
 ['so',1030,1070,'Possible S=O stretching','Sulfoxide-type region; overlapping fingerprint modes are common.']
].map(([id,low,high,name,note])=>({id,low,high,name,note}));
function number(s,decimalComma=false){s=String(s).trim().replace(/−/g,'-');if(decimalComma&&!s.includes('.')&&/^[-+]?\d+,\d+(?:e[-+]?\d+)?$/i.test(s))s=s.replace(',','.');return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(s)?Number(s):NaN;}
function split(line,delimiter){if(delimiter==='space')return line.trim().split(/\s+/);const out=[];let s='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){s+='"';i++;}else quoted=!quoted;}else if(c===delimiter&&!quoted){out.push(s.trim());s='';}else s+=c;}out.push(s.trim());return out;}
function parse(text){
 if(typeof text!=='string'||text.length>8e6)throw Error('Use a text spectrum smaller than 8 MB.');
 const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!/^(#|\/\/|;\s*[A-Za-z])/.test(s));
 let delimiter,first=-1;
 search:for(let i=0;i<Math.min(lines.length,150);i++)for(const d of [';',',','\t','space']){const cells=split(lines[i],d),n=cells.map(s=>number(s,d===';'));if(cells.length>=2&&n.filter(Number.isFinite).length>=2){delimiter=d;first=i;break search;}}
 if(first<0)throw Error('No numeric spectrum found. Use at least two columns: wavenumber (cm⁻¹) and signal.');
 const rows=[];let skipped=0,maxColumns=0;
 for(let i=first;i<lines.length;i++){const c=split(lines[i],delimiter).map(s=>number(s,delimiter===';'));if(c.filter(Number.isFinite).length>=2){rows.push(c);maxColumns=Math.max(maxColumns,c.length);}else skipped++;if(rows.length>100000)throw Error('Use no more than 100,000 spectrum rows.');}
 if(rows.length<5)throw Error('At least five numeric rows are needed to plot and detect bands.');
 let headers=first>0?split(lines[first-1],delimiter):[];
 headers=Array.from({length:maxColumns},(_,i)=>headers[i]&&!Number.isFinite(number(headers[i]))?headers[i]:'Column '+(i+1));
 return {rows,headers,skipped,delimiter};
}
function spectrum(parsed,{xcol=0,ycol=1,mode='absorbance'}={}){
 if(xcol===ycol)throw Error('Choose different columns for wavenumber and signal.');
 let skipped=0;const points=[];
 for(const row of parsed.rows){const x=row[xcol],y=row[ycol];if(!Number.isFinite(x)||!Number.isFinite(y)||x<=0||x>20000){skipped++;continue;}if(mode!=='absorbance'&&y<=0)throw Error('Transmittance must be greater than zero to convert it to absorbance.');points.push({x,y,a:mode==='absorbance'?y:-Math.log10(mode==='percent'?y/100:y)});}
 points.sort((a,b)=>a.x-b.x);
 const unique=[];for(let i=0;i<points.length;){let j=i+1,sumY=points[i].y,sumA=points[i].a;while(j<points.length&&points[j].x===points[i].x){sumY+=points[j].y;sumA+=points[j].a;j++;}unique.push({x:points[i].x,y:sumY/(j-i),a:sumA/(j-i)});i=j;}
 if(unique.length<5||unique[unique.length-1].x-unique[0].x<1)throw Error('At least five distinct wavenumbers with a usable spectral range are needed.');
 return {points:unique,skipped,duplicates:points.length-unique.length};
}
function detect(points,{smoothing=8,prominence=3,separation=20}={}){
 if(!Number.isFinite(smoothing)||smoothing<0||smoothing>100||!Number.isFinite(prominence)||prominence<=0||prominence>100||!Number.isFinite(separation)||separation<1||separation>500)throw Error('Use smoothing 0–100 cm⁻¹, prominence >0–100%, and band separation 1–500 cm⁻¹.');
 const n=points.length,prefix=[0];for(const p of points)prefix.push(prefix[prefix.length-1]+p.a);
 let left=0,right=0;const s=[];for(let i=0;i<n;i++){while(left<i&&points[left].x<points[i].x-smoothing/2)left++;right=Math.max(right,i);while(right+1<n&&points[right+1].x<=points[i].x+smoothing/2)right++;s.push(smoothing?(prefix[right+1]-prefix[left])/(right-left+1):points[i].a);}
 let lo=Infinity,hi=-Infinity;for(const y of s){lo=Math.min(lo,y);hi=Math.max(hi,y);}const range=hi-lo;if(range<=1e-12)return [];
 // Range-minimum tree and nearest-higher bounds avoid long repeated scans in dense spectra.
 let size=1;while(size<n)size*=2;const tree=new Float64Array(size*2);tree.fill(Infinity);for(let i=0;i<n;i++)tree[size+i]=s[i];for(let i=size-1;i>0;i--)tree[i]=Math.min(tree[i*2],tree[i*2+1]);
 function minimum(l,r){let v=Infinity;l+=size;r+=size;while(l<=r){if(l%2)v=Math.min(v,tree[l++]);if(!(r%2))v=Math.min(v,tree[r--]);l=Math.floor(l/2);r=Math.floor(r/2);}return v;}
 const higherLeft=new Int32Array(n),higherRight=new Int32Array(n),stack=[];
 for(let i=0;i<n;i++){while(stack.length&&s[stack[stack.length-1]]<=s[i])stack.pop();higherLeft[i]=stack.length?stack[stack.length-1]:-1;stack.push(i);}stack.length=0;
 for(let i=n-1;i>=0;i--){while(stack.length&&s[stack[stack.length-1]]<=s[i])stack.pop();higherRight[i]=stack.length?stack[stack.length-1]:n;stack.push(i);}
 let windowLeft=0,windowRight=0;const candidates=[];
 for(let i=1;i<n-1;i++){
  if(!(s[i]>s[i-1]&&s[i]>=s[i+1]))continue;
  let end=i;while(end+1<n&&s[end+1]===s[i])end++;if(end===n-1||s[end+1]>s[i]){i=end;continue;}
  const k=Math.floor((i+end)/2);while(points[windowLeft].x<points[k].x-500)windowLeft++;windowRight=Math.max(windowRight,k);while(windowRight+1<n&&points[windowRight+1].x<=points[k].x+500)windowRight++;
  const lmin=minimum(Math.max(windowLeft,higherLeft[k]+1),k),rmin=minimum(k,Math.min(windowRight,higherRight[k]-1));
  const p=s[k]-Math.max(lmin,rmin);if(p/range*100>=prominence)candidates.push({x:points[k].x,y:points[k].y,prominence:p/range*100,source:'Detected'});i=end;
 }
 candidates.sort((a,b)=>b.prominence-a.prominence);const kept=[];
 for(const p of candidates)if(kept.every(q=>Math.abs(q.x-p.x)>=separation))kept.push(p);
 return kept.slice(0,60).sort((a,b)=>b.x-a.x);
}
function assignments(x){return rules.filter(r=>x>=r.low&&x<=r.high);}
function patterns(peaks,{diamond=false}={}){
 const has=(l,h)=>peaks.some(p=>p.x>=l&&p.x<=h),out=[];
 if(has(1640,1850)&&has(1000,1300))out.push('C=O-region and C–O-region bands occur together: check ester/acid and related oxygen-containing structures, using band shape and sample chemistry.');
 if(has(3200,3600)&&has(1000,1300))out.push('High-wavenumber O–H/N–H-region and C–O-region bands occur together. Alcohol/phenol-type chemistry is one possibility; water and other groups can overlap.');
 if(has(1500,1570)&&has(1300,1390))out.push('Two bands fall in the common nitro-pair regions. Check their shapes and whether a nitro group is chemically plausible.');
 if(has(2300,2400)||has(650,685))out.push('A band is near an atmospheric CO₂ region. Compare the background/purge conditions before treating it as a sample group.');
 if(has(1600,1660)||has(3200,3700))out.push('O–H/N–H and ~1640 cm⁻¹ regions can contain water-related contributions. Band position alone does not distinguish sample chemistry from moisture.');
 if(diamond&&has(1800,2700))out.push('Diamond ATR selected: this region overlaps intrinsic diamond phonon absorption. Check accessory/background effects before assigning a sample band.');
 if(peaks.some(p=>p.x<400||p.x>4000))out.push('Some bands are outside the common 400–4000 cm⁻¹ mid-IR guide. Use additional references for those regions.');
 if(!out.length&&peaks.length)out.push('Review the listed alternative assignments together with band width, relative intensity, the complete fingerprint region, and a suitable reference spectrum.');
 return out;
}
function imageX(x,tick1,tick2){
 if(![x,tick1?.x,tick2?.x,tick1?.value,tick2?.value].every(Number.isFinite)||Math.abs(tick2.x-tick1.x)<10||tick1.value===tick2.value||tick1.value<=0||tick2.value<=0)throw Error('Calibrate two different, well-separated x-axis ticks with positive wavenumbers.');
 return tick1.value+(x-tick1.x)*(tick2.value-tick1.value)/(tick2.x-tick1.x);
}
const api=Object.freeze({rules,parse,spectrum,detect,assignments,patterns,imageX});if(typeof module==='object'&&module.exports)module.exports=api;else root.FTIRCore=api;
})(typeof window==='object'?window:globalThis);
