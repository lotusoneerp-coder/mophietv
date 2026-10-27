/* Mophie TV — diagnósticos locais. Nunca registra cookies, tokens ou URLs completas. */
(function(){'use strict';
 const KEY='mophie_diag_v1';
 const CODES={
  M101:'O item não possui página individual válida.',
  M102:'O site não permitiu ler a página (rede/CORS).',
  M103:'A página respondeu com erro HTTP ou redirecionamento.',
  M104:'Nenhum vídeo ou player compatível foi identificado.',
  M105:'O iframe carregou, mas a reprodução não pode ser confirmada.',
  M106:'Tela preta / ícone Android: possível falha de vídeo ou compatibilidade da WebView (não confirmada).',
  M107:'O site exige selecionar episódio, áudio ou servidor.',
  M108:'Falha de reprodução do vídeo ou transmissão.',
  M109:'O player externo exige seleção que não pode ser controlada pela Mophie TV.',
  M110:'A página demorou demais para responder.',
  M111:'O iframe informou erro de carregamento.',
  M112:'Endereço de player inválido ou não permitido.',
  M113:'A reprodução pode estar bloqueada por política do provedor.',
  M114:'Player selecionado: início da tentativa de reprodução.',
  M115:'Loop de páginas do seletor; escolha retornou a um endereço já visitado.',
  M116:'O site exige seleção interativa não disponibilizada por links de controle.',
  M117:'Mouse virtual: iframe de outro site exige clique nativo; JavaScript não alcança os botões internos.',
  M118:'Falha ao acionar a ponte de toque Android (quando disponível).',
  M119:'O vídeo direto não iniciou automaticamente na WebView.',
  D201:'Vídeo MP4 direto de teste avançou.',
  D202:'Vídeo MP4 direto de teste falhou.',
  D211:'Vídeo MP4 dentro de iframe local avançou.',
  D212:'Vídeo MP4 dentro de iframe local falhou.',
  D220:'Imagem preta ou Android reportado durante teste.'
 };
 let memory=[];
 try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(v))memory=v.slice(0,25)}catch(e){}
 function locationOnly(value){try{const u=new URL(value);return u.hostname+u.pathname.slice(0,100)}catch(e){return ''}}
 function add(code,provider,title,detail,uri){
  const c=CODES[code]?code:'M108';const entry={code:c,date:new Date().toISOString(),provider:String(provider||''),title:String(title||'').slice(0,90),detail:String(detail||CODES[c]).slice(0,160),where:locationOnly(uri)};
  memory.unshift(entry);memory=memory.slice(0,25);try{localStorage.setItem(KEY,JSON.stringify(memory))}catch(e){}
  return entry;
 }
 function latest(){return memory[0]||null}
 function list(){return memory.slice()}
 window.MophieDiagnostics={CODES,add,latest,list};
})();
