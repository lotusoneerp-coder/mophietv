/* Mophie TV 1.5.4 — diagnóstico reproduzível da camada de vídeo.
   Reproduz exclusivamente vídeo local gerado pela Mophie. Não lê vídeo/DOM de terceiros,
   não desativa sandbox/DRM e não captura URLs pessoais. */
(function(){'use strict';
 const ID='mophie_video_test_last';
 let opened=false,idx=0,attempt=null,timer=null,seq=0,received=[];
 const $=id=>document.getElementById(id);
 const C={D201:'O vídeo de teste direto avançou no tempo.',D202:'O vídeo direto falhou ou não avançou.',D211:'O vídeo de teste no iframe local avançou no tempo.',D212:'O vídeo dentro de iframe local falhou ou não avançou.',D220:'A imagem do teste ficou preta ou mostrou o Android.',D221:'Este WebView não anuncia suporte a H.264 MP4.'};
 const BUTTONS=['A · Testar vídeo direto','B · Testar vídeo em iframe','A imagem ficou preta / Android','Fechar diagnóstico'];
 function add(code,detail){const entry={code,detail:String(detail||''),time:new Date().toLocaleTimeString('pt-BR')};received.unshift(entry);received=received.slice(0,5);
  try{localStorage.setItem(ID,JSON.stringify(received))}catch(e){}
  if(window.MophieDiagnostics)MophieDiagnostics.add(code,'Teste da WebView','Reprodução H.264 local',entry.detail,'');
  render();
 }
 function visualStatus(txt){$('videoTestStatus').textContent=txt;}
 function info(){const v=$('videoTestDirect'),type=v.canPlayType&&v.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');
  return 'H.264/MP4: '+(type||'não reconhecido')+' · '+(navigator.userAgent||'WebView').slice(0,120)}
 function render(){if(!opened)return;
  [...$('videoTestMenu').children].forEach((el,i)=>el.classList.toggle('focused',i===idx));
  $('videoTestInfo').textContent=info();
  $('videoTestResults').innerHTML=received.map(x=>'<div><b>'+x.code+'</b> · '+escapeText(C[x.code]||'Registro')+' <small>'+escapeText(x.detail)+'</small></div>').join('')||'Sem testes nesta TV.';
 }
 function escapeText(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 function clear(){clearTimeout(timer);timer=null;attempt=null;const v=$('videoTestDirect');v.pause();v.removeAttribute('src');v.load();v.hidden=true;const f=$('videoTestFrame');f.removeAttribute('src');f.hidden=true;}
 function open(){if(opened)return;opened=true;idx=0;received=[];try{const x=JSON.parse(localStorage.getItem(ID)||'[]');if(Array.isArray(x))received=x.slice(0,5)}catch(e){}
  $('videoTestPanel').hidden=false;$('videoTestStatus').textContent='Escolha um teste e pressione OK. A imagem deve se mover.';render();}
 function close(){if(!opened)return;clear();opened=false;$('videoTestPanel').hidden=true;}
 function finish(success,detail){if(!attempt||attempt.done)return;
  const kind=attempt.kind;attempt.done=true;clearTimeout(timer);timer=null;
  const code=kind==='direct'?(success?'D201':'D202'):(success?'D211':'D212');
  add(code,detail);visualStatus(code+' · '+(success?'O tempo do vídeo avançou. CONFIRA se as cores se movem na tela.':'Falha identificada. Teste a outra opção e fotografe os códigos.'));
 }
 function progress(seconds,event){if(!attempt||attempt.done)return;attempt.seconds=Math.max(attempt.seconds,seconds||0);
  if(seconds>=1.6){finish(true,'Tempo avançou '+seconds.toFixed(1)+' s; último evento '+event)}
  else visualStatus('Reproduzindo teste '+(attempt.kind==='direct'?'A':'B')+' · tempo '+seconds.toFixed(1)+' s · '+event);
 }
 function start(kind){clear();seq++;attempt={kind,id:seq,done:false,seconds:0};
  const v=$('videoTestDirect'),f=$('videoTestFrame');
  visualStatus('Carregando teste '+(kind==='direct'?'A (vídeo direto)':'B (iframe local)')+'…');
  if(kind==='direct'){
   v.hidden=false;v.muted=true;v.src='video-prova.mp4';
   v.onloadedmetadata=()=>{if(attempt&&attempt.kind==='direct')visualStatus('MP4 lido · '+v.videoWidth+'×'+v.videoHeight+' · iniciando…')};
   v.onplaying=()=>progress(v.currentTime,'playing');
   v.ontimeupdate=()=>progress(v.currentTime,'timeupdate');
   v.onerror=()=>{if(attempt&&attempt.kind==='direct')finish(false,'HTMLMediaElement.error='+((v.error&&v.error.code)||0)+'; networkState='+v.networkState)};
   v.play().catch(e=>{if(attempt&&attempt.kind==='direct')finish(false,'play() rejeitado: '+e.name)})
  }else{f.hidden=false;f.src='video-test-frame.html';f.onerror=()=>{if(attempt&&attempt.kind==='frame')finish(false,'iframe onerror')}}
  timer=setTimeout(()=>{if(attempt&&!attempt.done)finish(false,'Tempo limite; último segundo observado: '+attempt.seconds.toFixed(1)+' s')},10500);
 }
 window.addEventListener('message',ev=>{if(!opened||!attempt||attempt.kind!=='frame'||ev.source!==$('videoTestFrame').contentWindow)return;
  const data=ev.data;if(!data||data.mophieLocalVideoTest!==true)return;
  if(data.event==='error'||data.event==='rejected')finish(false,'iframe '+data.event+': '+(data.detail||data.error||''));
  else progress(Number(data.seconds||0),'iframe '+data.event);
 });
 function key(k){if(!opened)return false;
  if(k==='Escape'||k==='Backspace'||k==='Menu'){close();return true}
  if(k==='ArrowDown'||k==='ArrowRight')idx=Math.min(BUTTONS.length-1,idx+1);
  else if(k==='ArrowUp'||k==='ArrowLeft')idx=Math.max(0,idx-1);
  else if(k==='Enter'||k==='NumpadEnter'){
   if(idx===0)start('direct');else if(idx===1)start('frame');
   else if(idx===2){add('D220','Usuário informou vídeo preto ou robô Android. Teste '+(attempt?attempt.kind:'não selecionado'));visualStatus('D220 · Tela preta informada. Fotografe estes resultados.');}
   else close();
  }
  render();return true;
 }
 window.MophieVideoTest={open,close,isOpen:()=>opened,key,_state:()=>({opened,idx,attempt,received:received.slice()})};
})();
