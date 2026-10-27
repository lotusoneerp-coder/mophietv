/* Mophie TV — detecção conservadora de players e opções PUBLICADAS em HTML.
   Não controla DOM de iframes de outra origem, não executa scripts de terceiros,
   não obtém cookies/sessões e não contorna DRM nem bloqueios de incorporação. */
(function(){'use strict';
 const ROOTS={RedeCanais:'https://redecanais.by'};
 const TIMEOUT=12000;
 function safeUrl(url,base){try{const v=new URL(url,base);return v.protocol==='https:'&&!/\s/.test(v.href)?v.href:null}catch(e){return null}}
 function isInstruction(u){try{return /(?:como[-_]?assistir|how[-_]?to[-_]?watch|instru(?:coes|coes|ções)|tutorial|faq|ajuda)/i.test(new URL(u).pathname)}catch(e){return true}}
 function media(url){return /\.(?:m3u8|mp4|webm)(?:[?#]|$)/i.test(url||'')}
 function reject(u){return /(?:^|\.)(?:doubleclick|googlesyndication|google-analytics|adservice|popads)\./i.test(new URL(u).hostname)}
 function providerPage(item,provider){const site=ROOTS[provider];if(!site||!item||!item.url)return null;
  const u=safeUrl(item.url,site);return u&&new URL(u).hostname.replace(/^www\./,'')===new URL(site).hostname.replace(/^www\./,'')&&new URL(u).pathname!=='/'?u:null}
 function err(code,msg){const e=new Error(msg);e.code=code;return e}
 function extract(html,page){const d=new DOMParser().parseFromString(html,'text/html'),found=[];
  d.querySelectorAll('video[src],video source[src],source[type^="video/"][src]').forEach(el=>{const u=safeUrl(el.getAttribute('src'),page);if(u&&media(u)&&!reject(u))found.push({kind:'video',url:u})});
  d.querySelectorAll('iframe[src]').forEach(el=>{const u=safeUrl(el.getAttribute('src'),page);if(u&&!reject(u)&&!/youtube|youtu\.be|vimeo|analytics|banner/i.test(new URL(u).hostname))found.push({kind:'embed',url:u})});
  d.querySelectorAll('a[href]').forEach(el=>{const label=(el.textContent||'').trim(),raw=el.getAttribute('href')||'';
   if(!/^(iframe|player|assistir no player)$/i.test(label)&&!/\/player(?:\.php|\/|\?)/i.test(raw))return;
   const u=safeUrl(raw,page);if(u&&!reject(u))found.push({kind:media(u)?'video':'embed',url:u})});
  return found.find(x=>x.kind==='video')||found.find(x=>x.kind==='embed')||null;
 }
 function inspectHTML(html,page){const d=new DOMParser().parseFromString(html,'text/html');let entries=[],used=new Set();
  function push(label,url,kind){const u=safeUrl(url,page);if(!u||reject(u)||isInstruction(u)||/\bcomo\s+assistir\b/i.test(label||'')||used.has(kind+u)||entries.length>=100)return;
   if(kind==='page'&&new URL(u).origin!==new URL(page).origin)return;
   used.add(kind+u);entries.push({label:String(label||'Opção de reprodução').replace(/\s+/g,' ').trim().slice(0,95),kind,url:u});}
  d.querySelectorAll('a[href]').forEach(a=>{
   const href=a.getAttribute('href'),url=safeUrl(href,page);if(!url||isInstruction(url))return;
   const dest=new URL(url),origin=new URL(page),path=dest.pathname;
   const txt=(a.textContent||a.getAttribute('title')||a.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim();
   // Não confundir menu, patrocinador, agregador de filmes ou homepage com episódio/player.
   if(/(?:assistir filmes|filmes e s[eé]ries online|filmes xp|box filmes|comando|google filmes|hyper flicks|in[ií]cio|home|cat[aá]logo|como assistir)/i.test(txt))return;
   const episode=dest.origin===origin.origin&&/\/(?:epis[oó]dios?|episodes?|temporadas?)\/[\w%.-]+/i.test(path);
   const player=/(?:\/(?:embed|player|watch)\/|\/(?:embed|player)\.(?:php|html)$|[?&](?:embed|player)=)/i.test(url);
   const namedServer=/^(?:blogger|vip(?:\s+player)?|player\s*\d+)$/i.test(txt)&&dest.origin!==origin.origin;
   if(episode)push(txt||'Episódio',url,'page');
   else if(media(url))push(txt||'Vídeo direto',url,'video');
   else if(player||namedServer)push(txt||'Player',url,'embed');
  });
  // Players expostos em elementos com data-src/data-url (sem executar JS remoto).
  d.querySelectorAll('[data-player],[data-src],[data-video],[data-url]').forEach(el=>{
   const label=(el.textContent||el.getAttribute('aria-label')||el.getAttribute('title')||'').replace(/\s+/g,' ').trim().slice(0,70);
   if(!/(?:player|servidor|dub|leg|hd|assistir|blogger|vip)/i.test(label))return;
   for(const attr of ['data-src','data-video','data-url','data-player']){
    const raw=el.getAttribute(attr),u=raw&&safeUrl(raw,page);if(u&&u!==page){push(label||'Escolher player',u,media(u)?'video':'embed');break}
   }
  });
  // Algumas páginas de episódio oferecem áudio/servidor em <select> HTML.
  // Somente valores que sejam links absolutos/relativos verificáveis são utilizáveis;
  // tokens JavaScript (por exemplo, "dub" ou "1") não permitem controlar iframe externo.
  d.querySelectorAll('select').forEach(sel=>{
   const subject=(sel.getAttribute('name')||'')+' '+(sel.getAttribute('id')||'')+' '+(sel.getAttribute('aria-label')||'');
   const relevant=/(?:audio|idioma|language|dublado|legendado|player|servidor|server|episodio|episode)/i.test(subject)||
    !!sel.closest('[class*="player"],[class*="audio"],[class*="server"],[class*="episode"]');
   if(!relevant)return;
   for(const option of sel.querySelectorAll('option[value]')){
    const raw=option.getAttribute('value'),label=(option.textContent||'').trim();
    if(!raw||/^(?:undefined|null|#|0|1|dub|leg)$/i.test(raw))continue;
    const url=safeUrl(raw,page);if(!url||isInstruction(url)||url===page)continue;
    const kind=media(url)?'video':/\/(?:episodios?|episodes?)\//i.test(new URL(url).pathname)?'page':'embed';
    push(label||'Selecionar áudio / servidor',url,kind);
   }
  });
  // Iframes reais com endereço publicamente declarado.
  d.querySelectorAll('iframe[src]').forEach((el,i)=>{const src=safeUrl(el.getAttribute('src'),page);
   if(src&&!/youtube|youtu\.be|vimeo|analytics|banner/i.test(new URL(src).hostname))push((el.getAttribute('title')||'Player '+(i+1)),src,'embed')});
  d.querySelectorAll('video[src],video source[src]').forEach((el,i)=>{const u=safeUrl(el.getAttribute('src'),page);if(u&&media(u))push('Vídeo '+(i+1),u,'video')});
  // Remove páginas com o mesmo endereço da página atual para não criar loops.
  entries=entries.filter(x=>x.url!==page);
  return {options:entries,primary:extract(html,page)};
 }
 async function inspect(item,provider){if(item&&media(item.streamUrl)){const url=safeUrl(item.streamUrl,ROOTS[provider]);if(url)return {page:item.url||'',primary:{kind:'video',url},options:[{label:'Vídeo direto',kind:'video',url}]}}
  const page=providerPage(item,provider);if(!page)throw err('M101','O catálogo não fornece página individual válida.');
  const ctrl=new AbortController(),ti=setTimeout(()=>ctrl.abort(),TIMEOUT);let html;
  try{const r=await fetch(page,{signal:ctrl.signal,credentials:'omit',redirect:'follow'});
   if(!r.ok)throw err('M103','HTTP '+r.status+' na página do título');
   if(new URL(r.url).origin!==new URL(page).origin)throw err('M103','Redirecionamento externo não suportado');
   if(isInstruction(r.url))throw err('M116','A fonte redirecionou para Como assistir, não para um episódio válido.');
   html=await r.text();if(html.length>2000000)throw err('M104','Resposta HTML maior que o limite de análise');
  }catch(e){if(e.code)throw e;if(e.name==='AbortError')throw err('M110','Tempo limite de leitura da página');throw err('M102','Site não permitiu consultar a página do título (rede ou CORS)')}
  finally{clearTimeout(ti)}
  if(/como[-_]?assistir/i.test(new URL(page).pathname))throw err('M116','Link de instruções não é um episódio nem um player.');
  return {...inspectHTML(html,page),page};
 }
 async function resolve(item,provider){const x=await inspect(item,provider);if(!x.primary)throw err('M104','Nenhum player incorporável identificado nesta página.');return x.primary}
 window.MophieSourcePlayer={resolve,inspect,extract,inspectHTML,providerPage,ROOTS};
})();
