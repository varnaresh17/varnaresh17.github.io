"use strict";
// Preserve existing bookmarks to calculators formerly embedded in this page.
const legacyToolPages={'#xrd-calculators':'xrd.html','#crystal-area-guide':'xrd.html#crystal-area-guide','#ftir-explorer':'ftir.html'};
function openLegacyTool(){const target=legacyToolPages[location.hash];if(target)location.replace(target);}
openLegacyTool();window.addEventListener('hashchange',openLegacyTool);
const techniqueCards=[...document.querySelectorAll(".technique-card")];
const techniqueButtons=[...document.querySelectorAll(".technique-filter")];
const techniqueSearch=document.querySelector("#technique-search");
let techniqueGroup="all";
function updateTechniques(){
 const words=techniqueSearch.value.toLowerCase().trim().split(/\s+/).filter(Boolean);let count=0;
 techniqueCards.forEach(card=>{card.hidden=!((techniqueGroup==="all"||card.dataset.techniqueGroup===techniqueGroup)&&words.every(word=>card.dataset.techniqueSearch.includes(word)));if(!card.hidden)count++;});
 techniqueButtons.forEach(button=>{const active=button.dataset.techniqueFilter===techniqueGroup;button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active));});
 document.querySelector("#technique-status").textContent=`${count} of ${techniqueCards.length} techniques shown`;
 document.querySelector("#technique-empty").hidden=count!==0;
}
techniqueButtons.forEach(button=>button.addEventListener("click",()=>{techniqueGroup=button.dataset.techniqueFilter;updateTechniques();}));
techniqueSearch.addEventListener("input",updateTechniques);updateTechniques();
