/* Seleção conservadora do Player 1 publicado pelo site do Cartoonito.
   Não executa scripts de terceiros nem acessa conteúdo protegido de outros domínios. */
(function(){'use strict';
 const BLOCKED=/(?:doubleclick|googlesyndication|adservice|popads|analytics|facebook\.com|t\.me)/i;
 function valid(raw,base){try{const u=new URL(raw,base);return u.protocol==='https:'&&!BLOCKED.test(u.hostname)?u.href:null}catch(e){return null}}
 function firstPlayer(html,page){
  const d=new DOMParser().parseFromString(html,'text/html');
  const nodes=d.querySelectorAll('iframe[src],iframe[data-src],video[src],source[src],a[href],button[data-src],[data-iframe]');
  const choices=[];
  for(const el of nodes){
   const node=el.closest('[id],[class]')||el;
   const hint=[el.getAttribute('title'),el.getAttribute('aria-label'),el.textContent,node.id,node.className]
    .map(x=>typeof x==='string'?x:'').join(' ').slice(0,200);
   if(!/(?:player|servidor|embed|video|transmiss[aã]o|stream|reprodu)/i.test(hint))continue;
   const raw=el.getAttribute('src')||el.getAttribute('data-src')||el.getAttribute('data-iframe')||el.getAttribute('href');
   if(!raw)continue;
   const u=valid(raw,page);if(!u||u===page||u.includes('#'))continue;
   choices.push({u,label:hint});
  }
  return choices.find(x=>/(?:player\s*(?:1|um)|server\s*1|servidor\s*1)/i.test(x.label))?.u||choices[0]?.u||null;
 }
 async function cartoonito(page){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),4800);
  try{const r=await fetch(page,{signal:ctrl.signal,credentials:'omit'});
   if(!r.ok)throw Error('HTTP '+r.status);
   const html=(await r.text()).slice(0,1000000);
   return firstPlayer(html,page)
  }finally{clearTimeout(timer)}
 }
 window.MophieLivePlayer={cartoonito,firstPlayer};
})();
