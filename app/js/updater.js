/* Mophie TV updater 1.6.9 — boot gate + instalacao nativa de APK.
 * Instalacao via PackageInstaller: validacao no Android e confirmacao pelo usuario.
 */
(function(){'use strict';
var MANIFEST='https://mophietv.lotusoneerp.com/latest.json';
var SITE='https://mophietv.lotusoneerp.com/';
var CODE=38, VERSION='1.6.9', CHANNEL='tcl-completa', PACKAGE='com.mophie.tv';
var opened=false, choice=0, latest=null, running=false, state='idle';
var gateStarted=false, gatePassed=false, bootCallback=null, inflight=null;
var el=document.getElementById('mophie-update-modal');
var status=document.getElementById('mophie-update-status');
var caption=document.getElementById('mophie-update-caption');
var actions=document.getElementById('mophie-update-actions');
function clean(s){return String(s==null?'':s);}
function buttons(){return Array.prototype.slice.call(actions.children);}
function redraw(){if(!opened)return;buttons().forEach(function(b,i){b.classList.toggle('focused',i===choice)});}
function show(title,body,opts,next){
 state=next;opened=true;choice=0;
 status.textContent=title;caption.textContent=body;actions.textContent='';
 (opts||[]).forEach(function(label,i){
  var btn=document.createElement('div');btn.className='update-option';btn.textContent=label;
  btn.tabIndex=-1;btn.setAttribute('role','button');
  btn.addEventListener('click',function(){choice=i;redraw();activate();});actions.appendChild(btn);
 });
 el.hidden=false;el.classList.toggle('update-mandatory',!gatePassed||state==='required'||state==='instructions'||state==='retry');redraw();
}
function hide(){if(!gatePassed)return;opened=false;el.hidden=true;el.classList.remove('update-mandatory');}
function release(){
 if(gatePassed)return;gatePassed=true;state='idle';hide();
 // Enable app only after a successful and valid HTTPS version comparison.
 var fn=bootCallback;bootCallback=null;if(fn)fn();
}
function installOnTV(){
 // Intencionalmente usa somente um esquema interno, sem URL de download controlada pelo site.
 // A Activity valida canal, pacote, tamanho, hash e versão no servidor HTTPS fixo.
 show('Preparando atualização',
  'Iniciando o download diretamente na televisão. Não feche a Mophie TV.\nO Android solicitará confirmação quando o APK estiver pronto.',[], 'installing');
 try{window.location.href='mophie-install://start';}
 catch(e){nativeStatus('error','Não foi possível acionar o instalador nativo: '+e.message);}
}
function nativeStatus(kind,message){
 // Somente nossa Activity invoca esta função via evaluateJavascript.
 var msg=clean(message).slice(0,400);
 if(kind==='progress'||kind==='working'){
  show('Baixando atualização',msg,[],'installing');return;
 }
 if(kind==='permission'){
  show('Permitir instalação','Ative a autorização de instalar apps da Mophie TV nas configurações do Android. Depois volte e pressione Instalar.',
  ['Instalar novamente','Verificar novamente'],'instructions');return;
 }
 if(kind==='installer'){
  show('Confirmar atualização','APK conferido. Confirme a instalação na janela do Android.',[], 'installing');return;
 }
 show('Não foi possível instalar',msg||'Tente novamente.',
 ['Instalar novamente','Verificar novamente'],'instructions');
}
function activate(){
 if(!opened)return;
 if(state==='required'){
  if(choice===0){installOnTV();return;}
  if(choice===1){check(false,true);return;}
 }
 if(state==='instructions'){
  if(choice===0){installOnTV();return;}
  showRequired();return;
 }
 if(state==='installing')return;
 if(state==='retry'){check(false,true);return;}
 if(state==='checking')return;
 if(state==='current'||state==='manual-error'||state==='manual-old'){hide();return;}
 if(state==='manual-install'){
  if(choice===0){installOnTV();return;}
  hide();return;
 }
 hide();
}
function showRequired(){
 var j=latest||{};
 show('ATUALIZACAO OBRIGATORIA',
 'Mophie TV '+clean(j.version||'mais recente')+' disponivel.\n'+
 'Versao instalada: '+VERSION+'.\n\n'+
 'O acesso aos canais e ao MophieFlix esta bloqueado ate instalar a versao nova.\n'+
 'O APK será baixado aqui na televisão. O Android solicitará a confirmação para instalar.',
 ['Baixar e instalar nesta TV','Verificar novamente'],'required');
}
function nav(k){
 if(!opened)return false;
 if(k==='ArrowDown'||k==='ArrowRight')choice=Math.min(actions.children.length-1,choice+1);
 else if(k==='ArrowUp'||k==='ArrowLeft')choice=Math.max(0,choice-1);
 else if(k==='Enter'||k==='NumpadEnter'){activate();return true;}
 else if(k==='Escape'||k==='Backspace'){
  if(!gatePassed){if(state==='instructions')showRequired();return true;}
  hide();return true;
 }
 redraw();return true;
}
function valid(j){
 if(!j||j.appId!==PACKAGE||j.channel!==CHANNEL||!Number.isSafeInteger(j.versionCode)||j.versionCode<1)throw Error('Canal ou codigo de versao invalido');
 if(!/^\d+\.\d+\.\d+$/.test(String(j.version||'')))throw Error('Versao invalida');
 if(!/^MophieTV_TCL_v\d+\.\d+\.\d+_[a-zA-Z0-9_-]+\.apk$/.test(String(j.apk||'')))throw Error('Nome de APK nao permitido');
 if(!j.apk.startsWith('MophieTV_TCL_v'+j.version+'_'))throw Error('APK e versao divergentes');
 if(!/^[a-f0-9]{64}$/i.test(String(j.sha256||'')))throw Error('Hash invalido');
 if(!Number.isSafeInteger(j.sizeBytes)||j.sizeBytes<100000)throw Error('Tamanho do APK invalido');
 if(!Array.isArray(j.notes))j.notes=[];
 j.apkUrl=SITE+j.apk;return j;
}
async function check(manualCheck,fromGate){
 if(running)return inflight;
 running=true;
 var gate=!gatePassed||!!fromGate;
 if(gate)show('Verificando atualizacoes','Conectando a Hostinger por HTTPS. Aguarde antes de usar os canais…',[],'checking');
 else if(manualCheck)show('Verificando atualizacoes','Consultando a Hostinger por HTTPS…',[],'checking');
 var ctl=new AbortController(),timer=setTimeout(function(){ctl.abort()},12000);
 inflight=(async function(){
  try{
   var response=await fetch(MANIFEST+'?v='+Date.now(),{signal:ctl.signal,cache:'no-store',mode:'cors',credentials:'omit',redirect:'error'});
   if(!response.ok)throw Error('HTTP '+response.status);
   var j=valid(await response.json());latest=j;
   if(j.versionCode>CODE){
    // Enforce every newer version regardless of the optional old manifest flag.
    showRequired();return false;
   }
   if(gate){release();return true;}
   if(manualCheck)show('Aplicativo atualizado','Esta TV esta na versao '+VERSION+'. Servidor: '+j.version+'.',['Fechar'],'current');
   return true;
  }catch(e){
   var why=e&&e.name==='AbortError'?'Tempo de resposta excedido':clean(e&&e.message||e);
   if(gate){
    show('Nao foi possivel verificar a versao',
     'A Mophie TV precisa validar a versao pela internet antes de liberar os canais.\n'+
     'Confira o Wi-Fi e o HTTPS da Hostinger.\n\nDetalhe: '+why,
     ['Tentar novamente'],'retry');
   }else if(manualCheck){
    show('Falha na consulta','Confira a internet e o endereco HTTPS. '+why,['Fechar'],'manual-error');
   }
   return false;
  }finally{clearTimeout(timer);running=false;inflight=null;}
 })();return inflight;
}
function startGate(boot){
 if(gateStarted)return;gateStarted=true;bootCallback=boot;
 check(false,true);
}
window.MophieUpdater={check:check,key:nav,isOpen:function(){return opened},isBlocking:function(){return !gatePassed||state==='required'||state==='instructions'||state==='retry'||state==='installing'},close:hide,manual:installOnTV,startGate:startGate,manifest:MANIFEST,site:SITE,validate:valid,
 nativeStatus:nativeStatus,getState:function(){return state},getLatest:function(){return latest},passed:function(){return gatePassed}};
})();
