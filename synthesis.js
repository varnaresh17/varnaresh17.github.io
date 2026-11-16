"use strict";
const methodCards=[...document.querySelectorAll('.method-card')];
const methodSearch=document.querySelector('#method-search');
function updateMethods(){const words=methodSearch.value.toLowerCase().normalize('NFKD').replace(/[–—-]/g,' ').trim().split(/\s+/).filter(Boolean);let n=0;methodCards.forEach(card=>{const content=card.dataset.methodSearch.normalize('NFKD').replace(/[–—-]/g,' ');card.hidden=!words.every(word=>content.includes(word));if(!card.hidden)n++});document.querySelector('#method-status').textContent=`${n} of ${methodCards.length} methods shown`;document.querySelector('#method-empty').hidden=n!==0;}
methodSearch.addEventListener('input',updateMethods);updateMethods();
