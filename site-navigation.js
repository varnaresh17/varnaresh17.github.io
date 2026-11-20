(function(){
  'use strict';
  const sidebar=document.querySelector('.site-sidebar');
  if(!sidebar)return;
  const nav=sidebar.querySelector('#navigation'),menu=sidebar.querySelector('.menu-toggle');
  const mobile=()=>window.matchMedia('(max-width:760px)').matches;
  function closeMenu(returnFocus=false){nav.classList.remove('is-open');menu.setAttribute('aria-expanded','false');if(returnFocus)menu.focus();}
  menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav.classList.toggle('is-open',open);});
  for(const button of sidebar.querySelectorAll('.submenu-toggle')){
    button.addEventListener('click',()=>{
      const open=button.getAttribute('aria-expanded')!=='true';
      button.setAttribute('aria-expanded',String(open));
      document.getElementById(button.getAttribute('aria-controls')).hidden=!open;
    });
  }
  function markCurrent(){
    const currentPage=location.pathname.split('/').pop()||'index.html';
    const currentHash=location.hash;
    for(const link of nav.querySelectorAll('a')){
      const target=new URL(link.href,location.href);
      const targetPage=target.pathname.split('/').pop()||'index.html';
      const match=targetPage===currentPage&&(target.hash?target.hash===currentHash:!currentHash||currentHash==='#home');
      if(match)link.setAttribute('aria-current',target.hash?'location':'page');else link.removeAttribute('aria-current');
    }
  }
  nav.addEventListener('click',event=>{if(event.target.closest('a'))closeMenu();});
  document.addEventListener('click',event=>{if(mobile()&&!sidebar.contains(event.target))closeMenu();});
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    if(nav.classList.contains('is-open')){closeMenu(true);return;}
    const button=sidebar.querySelector('.submenu-toggle[aria-expanded=true]');
    if(button){button.setAttribute('aria-expanded','false');document.getElementById(button.getAttribute('aria-controls')).hidden=true;button.focus();}
  });
  window.addEventListener('hashchange',markCurrent);
  window.matchMedia('(max-width:760px)').addEventListener('change',()=>closeMenu());
  markCurrent();
})();
