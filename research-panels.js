(function(){
  'use strict';
  const gallery=document.querySelector('.bio-research-images');
  const dialog=document.getElementById('research-image-viewer');
  if(!gallery||!dialog||typeof dialog.showModal!=='function')return;
  const image=document.getElementById('research-viewer-image');
  const title=document.getElementById('research-viewer-title');
  const options=document.getElementById('research-viewer-options');
  const note=document.getElementById('research-viewer-note');
  const close=document.getElementById('research-viewer-close');
  let activeLink=null,previousOverflow='';
  function showView(view){
    const detail=view==='detail'&&activeLink.dataset.detailSrc;
    image.src=detail?activeLink.dataset.detailSrc:activeLink.getAttribute('href');
    image.alt=detail?activeLink.dataset.detailAlt:activeLink.querySelector('img').alt;
    image.dataset.view=detail?'detail':activeLink.dataset.detailSrc?'figure-limited':'figure';
    for(const button of options.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.imageView===(detail?'detail':'figure')));
    note.hidden=!activeLink.dataset.detailSrc;
    note.textContent=detail?'Additional SEM detail from the research image collection (1448 × 1086 pixels).':'The XRD/SEM composite originated from a 405-pixel-wide image. The display is sharpened conservatively; original exports are needed for sharper diffraction plots.';
  }
  gallery.addEventListener('click',event=>{
    const link=event.target.closest('a[data-research-zoom]');
    if(!link||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    event.preventDefault();activeLink=link;
    title.textContent=link.closest('.bio-material-panel').querySelector('h3').textContent.replace(/\s+/g,' ').trim();
    options.hidden=!link.dataset.detailSrc;showView(link.dataset.defaultView||'figure');
    previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
    dialog.showModal();close.focus();
  });
  close.addEventListener('click',()=>dialog.close());
  options.addEventListener('click',event=>{const button=event.target.closest('button[data-image-view]');if(button)showView(button.dataset.imageView);});
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const r=dialog.getBoundingClientRect();
    if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();
  });
  dialog.addEventListener('close',()=>{document.body.style.overflow=previousOverflow;image.removeAttribute('src');activeLink?.focus({preventScroll:true});});
})();
