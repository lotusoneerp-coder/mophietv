/* Mophie TV 1.5.6 — cursor triangular e cliques acessíveis.
 * Uma página cross-origin pode receber um toque nativo pela ponte Android;
 * a shell instalada NÃO tem essa ponte. Eventos JS não podem substituí-la. */
(function(){'use strict';
 const $=id=>document.getElementById(id);
 const state={active:false,visible:false,x:0,y:0,timer:null,lastError:'',lastClick:null,feedbackTimer:null,pressTimer:null};
 const IDLE_MS=10000;
 const DIR={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const mounted=()=>{const p=$('player'),f=$('embed');return p&&!p.hidden&&f&&getComputedStyle(f).display!=='none'&&!!f.getAttribute('src')};
 const mask=()=>$('mouseCursor');
 function record(code,detail){state.lastError=code;try{if(window.MophieDiagnostics&&MophieDiagnostics.add)MophieDiagnostics.add(code,window.__mophie?.S?.playing?.provider||'',window.__mophie?.S?.playing?.meta?.name||'',detail,$('embed')?.src||'')}catch(_){};
  try{document.dispatchEvent(new CustomEvent('mophie-mouse-error',{detail:{code,message:detail}}))}catch(_){} }
 function feedback(message,kind){const el=$('mouseClickFeedback');if(!el)return;clearTimeout(state.feedbackTimer);el.textContent=message;el.dataset.kind=kind||'info';el.hidden=false;state.feedbackTimer=setTimeout(()=>{el.hidden=true},3500)}
 function press(){const c=mask();if(!c)return;c.classList.add('mouse-pressed');clearTimeout(state.pressTimer);state.pressTimer=setTimeout(()=>c.classList.remove('mouse-pressed'),180)}
 function draw(){const e=mask();if(!e)return;
  e.hidden=!state.active||!state.visible;
  if(!e.hidden){e.style.left=state.x+'px';e.style.top=state.y+'px'}
  document.body.classList.toggle('virtual-mouse-mode',state.active);
  const help=$('mouseGuide');if(help)help.hidden=!state.active;
 }
 function activity(){if(!state.active)return;state.visible=true;clearTimeout(state.timer);
  state.timer=setTimeout(()=>{state.visible=false;draw()},IDLE_MS);draw()}
 function enable(){if(!mounted())return false;state.lastError='';state.active=true;
  const r=$('embed').getBoundingClientRect();state.x=r.left+r.width/2;state.y=r.top+r.height/2;
  activity();return true}
 function disable(){state.active=false;state.visible=false;clearTimeout(state.timer);clearTimeout(state.pressTimer);const c=mask();if(c)c.classList.remove('mouse-pressed');const fb=$('mouseClickFeedback');if(fb)fb.hidden=true;draw()}
 function toggle(){if(state.active){disable();return false}return enable()}
 function dispatchClick(el,x,y){if(!el)return false;
  const d=el.ownerDocument,w=d.defaultView||window;
  try{el.focus&&el.focus({preventScroll:true})}catch(_){try{el.focus&&el.focus()}catch(__){}}
  const payload={bubbles:true,cancelable:true,view:w,clientX:x,clientY:y,button:0,buttons:1};
  try{if(w.PointerEvent)el.dispatchEvent(new w.PointerEvent('pointerdown',{...payload,pointerId:1,pointerType:'mouse',isPrimary:true}))}catch(_){}
  el.dispatchEvent(new w.MouseEvent('mousedown',payload));
  try{if(w.PointerEvent)el.dispatchEvent(new w.PointerEvent('pointerup',{...payload,buttons:0,pointerId:1,pointerType:'mouse',isPrimary:true}))}catch(_){}
  el.dispatchEvent(new w.MouseEvent('mouseup',{...payload,buttons:0}));
  if(typeof el.click==='function')el.click();else el.dispatchEvent(new w.MouseEvent('click',{...payload,buttons:0}));
  return true;
 }
 function click(){if(!state.active)return {ok:false,reason:'inactive'};
  state.lastError='';activity();press();const x=state.x,y=state.y;
  const f=$('embed'),fr=f.getBoundingClientRect();const inside=x>=fr.left&&y>=fr.top&&x<fr.right&&y<fr.bottom;
  if(inside){
   // Uma Activity recompilada pode expor uma ponte nativa que injeta um toque real.
   // A shell v1.0.2 ainda não fornece esse recurso.
   if(window.MophieNativeMouse&&typeof window.MophieNativeMouse.tap==='function'){
    try{window.MophieNativeMouse.tap(x/window.innerWidth,y/window.innerHeight);state.lastClick={native:true,x,y};feedback('Toque enviado pelo Android','ok');return {ok:true,native:true}}catch(e){record('M118','Ponte nativa falhou: '+String(e&&e.message||e));feedback('M118 · Erro ao enviar toque nativo','error')}
   }
   try{const d=f.contentDocument;
    if(d&&d.documentElement){const tx=(x-fr.left)*d.documentElement.clientWidth/fr.width,ty=(y-fr.top)*d.documentElement.clientHeight/fr.height;
     const el=d.elementFromPoint(tx,ty);
     if(el){dispatchClick(el,tx,ty);state.lastClick={native:false,localFrame:true,x,y};feedback('Clique enviado ao elemento acessível','ok');return {ok:true,localFrame:true}}
    }
   }catch(_){};
   try{f.focus({preventScroll:true})}catch(_){}
   record('M117','Iframe externo: somente um toque real da camada nativa da WebView pode acionar seus controles');feedback('M117 · Este player precisa de clique nativo. O cursor funciona, mas o OK não pode clicar dentro deste iframe.','error');
   state.lastClick={ok:false,crossOrigin:true,x,y};return {ok:false,reason:'cross-origin',code:'M117'};
  }
  const el=document.elementFromPoint(x,y);
  if(!el){feedback('Não há botão nesta posição','error');return {ok:false,reason:'missing'}};
  dispatchClick(el,x,y);state.lastClick={ok:true,local:true,x,y};feedback('Clique enviado ao controle','ok');return {ok:true,local:true};
 }
 function nativeClickFeedback(){if(!state.active)return;
  state.lastError='';activity();press();state.lastClick={ok:true,native:true,x:state.x,y:state.y};
  feedback('OK: toque real enviado à WebView · confira se o player respondeu','ok');
 }
 function key(k){if(!state.active)return false;
  if(k==='Escape'||k==='Backspace'){disable();return true}
  if(k==='Enter'||k==='NumpadEnter'){click();return true}
  const vec=DIR[k];if(!vec)return false;
  const w=window.innerWidth,h=window.innerHeight,step=clamp(Math.min(w,h)*.043,18,58);
  state.x=clamp(state.x+vec[0]*step,7,w-7);state.y=clamp(state.y+vec[1]*step,7,h-7);activity();return true
 }
 window.MophieVirtualMouse={enable,disable,toggle,key,click,nativeClickFeedback,isActive:()=>state.active,state,IDLE_MS};
 window.addEventListener('resize',()=>{if(state.active){state.x=clamp(state.x,7,window.innerWidth-7);state.y=clamp(state.y,7,window.innerHeight-7);draw()}});
})();
