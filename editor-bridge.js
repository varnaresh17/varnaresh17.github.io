/* Runs only inside the isolated preview. It never receives publishing credentials. */
(function(){
  'use strict';let channel=null,selected=null,hovered=null,drag=null,scheduled=false;
  const send=(type,data={})=>{if(channel)parent.postMessage({channel,type,...data},'*');};
  const handle=document.createElement('div');handle.dataset.editorUi='resize';handle.setAttribute('role','button');handle.setAttribute('tabindex','0');handle.setAttribute('aria-label','Resize selected item');handle.title='Drag to resize this item. Arrow keys resize; Shift changes by 10 pixels.';
  handle.style.cssText='display:none;position:fixed;width:22px;height:22px;background:#246b9c;border:2px solid white;border-radius:4px;box-shadow:0 1px 5px #0006;z-index:2147483647;cursor:nwse-resize;touch-action:none;box-sizing:border-box;';document.body.appendChild(handle);
  function describe(el){const s=getComputedStyle(el),r=el.getBoundingClientRect();return {key:el.dataset.editorKey,kind:el.dataset.editorKind,tag:el.tagName,text:el.innerText||el.textContent||'',html:el.innerHTML,fontSize:parseFloat(s.fontSize),color:s.color,bold:parseInt(s.fontWeight,10)>=600,italic:s.fontStyle==='italic',fontFamily:s.fontFamily,width:r.width,height:r.height};}
  function positionHandle(){
    scheduled=false;if(!selected||!selected.isConnected){handle.style.display='none';return;}
    const r=selected.getBoundingClientRect();
    if(!r.width||!r.height||r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth){handle.style.display='none';return;}
    handle.style.display='block';handle.style.left=Math.max(1,Math.min(innerWidth-24,r.right-11))+'px';handle.style.top=Math.max(1,Math.min(innerHeight-24,r.bottom-11))+'px';
    send('geometry',{key:selected.dataset.editorKey,width:r.width,height:r.height});
  }
  function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(positionHandle);}}
  const observer=new ResizeObserver(schedule);
  function select(el){if(selected&&selected!==el){observer.unobserve(selected);selected.removeAttribute('data-editor-selected');selected.removeAttribute('contenteditable');}selected=el;el.setAttribute('data-editor-selected','true');if(el.dataset.editorKind==='text')el.contentEditable='true';observer.observe(el);send('selection',describe(el));schedule();}
  function resize(width,height,notify=false){
    if(!selected)return;width=Math.round(Math.max(1,Math.min(3000,width)));height=Math.round(Math.max(1,Math.min(3000,height)));
    const styles={width:width+'px',height:height+'px','min-width':'0px','max-width':'none','min-height':'0px','max-height':'none','aspect-ratio':'auto','flex-shrink':'0'};
    for(const [key,value]of Object.entries(styles))selected.style.setProperty(key,value);
    schedule();if(notify)send('resize',{key:selected.dataset.editorKey,width,height});
  }
  handle.addEventListener('pointerdown',event=>{if(!selected)return;event.preventDefault();event.stopPropagation();const r=selected.getBoundingClientRect();drag={id:event.pointerId,x:event.clientX,y:event.clientY,width:r.width,height:r.height,style:selected.style.cssText};handle.setPointerCapture(event.pointerId);});
  handle.addEventListener('pointermove',event=>{if(!drag)return;resize(drag.width+event.clientX-drag.x,drag.height+event.clientY-drag.y);});
  handle.addEventListener('pointerup',event=>{if(!drag)return;const w=drag.width+event.clientX-drag.x,h=drag.height+event.clientY-drag.y;drag=null;resize(w,h,true);});
  handle.addEventListener('pointercancel',()=>{if(drag&&selected)selected.style.cssText=drag.style;drag=null;schedule();});
  handle.addEventListener('keydown',event=>{if(!selected||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();event.stopPropagation();const r=selected.getBoundingClientRect(),step=event.shiftKey?10:1;resize(r.width+(event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0),r.height+(event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0),true);});
  document.addEventListener('pointerover',event=>{if(event.target.closest('[data-editor-ui]'))return;const el=event.target.closest('[data-editor-key]');if(hovered!==el){hovered?.removeAttribute('data-editor-hover');hovered=el;hovered?.setAttribute('data-editor-hover','');}});
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-editor-ui]'))return;
    const target=event.target.closest('[data-editor-key]');
    if(event.target.closest('a,button,input,select,textarea,form'))event.preventDefault();
    if(target){select(target);event.stopPropagation();}
  },true);
  document.addEventListener('input',event=>{const el=event.target.closest('[data-editor-key]');if(el&&el.dataset.editorKind==='text')send('edit',describe(el));},true);
  document.addEventListener('paste',event=>{if(event.target.closest('[contenteditable=true]')){event.preventDefault();document.execCommand('insertText',false,event.clipboardData.getData('text/plain'));}});
  document.addEventListener('drop',event=>event.preventDefault());document.addEventListener('submit',event=>event.preventDefault());
  document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();send('save');}});
  window.addEventListener('scroll',schedule,true);window.addEventListener('resize',schedule);
  window.addEventListener('message',event=>{
    if(event.source!==parent||!event.data)return;
    const data=event.data;if(data.type==='initialize'&&typeof data.channel==='string'){channel=data.channel;return;}
    if(!channel||data.channel!==channel)return;
    if(data.type==='select'){const el=[...document.querySelectorAll('[data-editor-key]')].find(n=>n.dataset.editorKey===data.key);if(el){select(el);el.scrollIntoView({block:'nearest'});}return;}
    if(data.type==='patch'){
      const el=[...document.querySelectorAll('[data-editor-key]')].find(n=>n.dataset.editorKey===data.key);if(!el)return;
      if(typeof data.html==='string'&&el.tagName!=='IMG')el.innerHTML=data.html;
      if(data.style&&typeof data.style==='object')for(const [key,value]of Object.entries(data.style))if(['font-size','font-family','line-height','color','font-weight','font-style','text-align','object-fit','width','max-width','min-width','height','min-height','max-height','aspect-ratio','flex-shrink','border-radius','border-width','border-style','border-color','margin-top','margin-bottom','margin-left','margin-right','padding','background-color','display','flex-direction','grid-template-columns','gap','overflow','align-items','justify-content'].includes(key)){if(value)el.style.setProperty(key,value);else el.style.removeProperty(key);}
      if(typeof data.src==='string'&&el.tagName==='IMG')el.src=data.src;if(typeof data.alt==='string'&&el.tagName==='IMG')el.alt=data.alt;if(typeof data.href==='string'&&el.tagName==='A')el.setAttribute('href',data.href);schedule();
    }
  });
  document.querySelectorAll('input,textarea,select,button').forEach(el=>{el.disabled=true;el.setAttribute('tabindex','-1');});
  parent.postMessage({type:'editor-ready'},'*');
})();
