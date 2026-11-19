/* Runs only inside the isolated preview. It never receives publishing credentials. */
(function(){
  'use strict';let channel=null,selected=null;
  const send=(type,data={})=>{if(channel)parent.postMessage({channel,type,...data},'*');};
  function describe(el){const s=getComputedStyle(el);return {key:el.dataset.editorKey,kind:el.tagName==='IMG'?'image':'text',tag:el.tagName,text:el.innerText||el.textContent||'',html:el.innerHTML,fontSize:parseFloat(s.fontSize),color:s.color,bold:parseInt(s.fontWeight,10)>=600,italic:s.fontStyle==='italic',fontFamily:s.fontFamily};}
  function select(el){if(selected&&selected!==el){selected.removeAttribute('data-editor-selected');selected.removeAttribute('contenteditable');}selected=el;el.setAttribute('data-editor-selected','true');if(el.dataset.editorKind==='text')el.contentEditable='true';send('selection',describe(el));}
  document.addEventListener('click',event=>{
    const target=event.target.closest('[data-editor-key]');
    if(event.target.closest('a,button,input,select,textarea,form'))event.preventDefault();
    if(target){select(target);event.stopPropagation();}
  },true);
  document.addEventListener('input',event=>{const el=event.target.closest('[data-editor-key]');if(el&&el.dataset.editorKind==='text')send('edit',describe(el));},true);
  document.addEventListener('paste',event=>{if(event.target.closest('[contenteditable=true]')){event.preventDefault();document.execCommand('insertText',false,event.clipboardData.getData('text/plain'));}});
  document.addEventListener('drop',event=>event.preventDefault());
  document.addEventListener('submit',event=>event.preventDefault());
  document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();send('save');}});
  window.addEventListener('message',event=>{
    if(event.source!==parent||!event.data)return;
    const data=event.data;
    if(data.type==='initialize'&&typeof data.channel==='string'){channel=data.channel;return;}
    if(!channel||data.channel!==channel)return;
    if(data.type==='select'){const el=[...document.querySelectorAll('[data-editor-key]')].find(n=>n.dataset.editorKey===data.key);if(el){select(el);el.scrollIntoView({block:'nearest'});}return;}
    if(data.type==='patch'){
      const el=[...document.querySelectorAll('[data-editor-key]')].find(n=>n.dataset.editorKey===data.key);if(!el)return;
      if(typeof data.html==='string'&&el.tagName!=='IMG')el.innerHTML=data.html;
      if(data.style&&typeof data.style==='object')for(const [key,value]of Object.entries(data.style))if(['font-size','font-family','line-height','color','font-weight','font-style','text-align','object-fit','width','max-width','height','border-radius','margin-top','margin-bottom','padding','background-color'].includes(key)){if(value)el.style.setProperty(key,value);else el.style.removeProperty(key);}
      if(typeof data.src==='string'&&el.tagName==='IMG')el.src=data.src;
      if(typeof data.alt==='string'&&el.tagName==='IMG')el.alt=data.alt;
      if(typeof data.href==='string'&&el.tagName==='A')el.setAttribute('href',data.href);
    }
  });
  document.querySelectorAll('input,textarea,select,button').forEach(el=>{el.disabled=true;el.setAttribute('tabindex','-1');});
  parent.postMessage({type:'editor-ready'},'*');
})();
