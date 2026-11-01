/* SaimoTV: metadados publicados no acervo Cloudflare; não abre o site/iframe do provedor. */
(function(){'use strict';
 const old=window.MophieSources;if(!old)return;
 const ROOTS=['https://saimo-filmes.pages.dev/','https://filmes-saimo.pages.dev/'];
 const DBKEY='mophie_saimo_catalog_v2';let current=null,task=null;
 const cap=100000,letters='abcdefghijklmnopqrstuvwxyz'.split('');
 const direct=/\.(?:mp4|m3u8|webm)(?:[?#]|$)/i;
 function media(u){try{const x=new URL(String(u||''));return x.protocol==='https:'&&direct.test(x.href)?x.href:''}catch(_){return ''}}
 function image(u,base){try{const x=new URL(String(u||''),base);return x.protocol==='https:'&&/\.(?:jpg|jpeg|png|webp)(?:[?#]|$)/i.test(x.href)?x.href:''}catch(_){return ''}}
 function cache(){try{const x=JSON.parse(localStorage.getItem(DBKEY)||'null');return x&&Array.isArray(x.items)?x:null}catch(_){return null}}
 function save(o){current=o;try{localStorage.setItem(DBKEY,JSON.stringify({...o,items:o.items.slice(0,850)}))}catch(_){};try{dispatchEvent(new CustomEvent('mophie:catalog-updated',{detail:{name:'SaimoTV',count:o.items.length,pages:o.pages}}))}catch(_){}}
 async function request(url){const c=new AbortController(),t=setTimeout(()=>c.abort(),9000);try{const r=await fetch(url,{signal:c.signal,credentials:'omit'});if(!r.ok)throw Error('HTTP '+r.status);const x=await r.text();if(x.length>16000000)throw Error('Arquivo excessivo');return x}finally{clearTimeout(t)}}
 function parse(text,base,kind){let lines=text.trim().split(/\r?\n/);if(lines.length===1&&text.trim().startsWith('[')){try{const a=JSON.parse(text);if(Array.isArray(a))return a.map(v=>normalize(v,base,kind)).filter(Boolean)}catch(_){}}const result=[];
 for(const line of lines){if(!line||line[0]==='#')continue;let p=line.includes('|')?line.split('|').map(x=>x.trim()):line.split(/\t+/).map(x=>x.trim());if(p.length<3)continue;
 let type= /s[eé]rie|anime|dorama/i.test(p[0])?'series':'movie';
 let title=p[1]||'',poster=p.find(x=>/\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(x))||'';
 let year=(p.find(x=>/^(?:19|20)\d\d$/.test(x))||'');
 let link=p.find(x=>direct.test(x))||'';
 if(!title||title.length>160||/^(?:filmes?|series?|destaques?)$/i.test(title))continue;
 result.push({id:'saimo:'+type+':'+title.toLowerCase()+'|'+year,name:title,type,poster:image(poster,base),year,url:'',source:'SaimoTV',summary:'',genre:'',streamUrl:media(link)});
 }return result}
 function normalize(x,base,kind){if(!x||typeof x!=='object')return null;let title=x.title||x.name||x.titulo||'';if(!title)return null;const type=/ser|anime|dorama/.test(String(x.type||x.tipo||kind||'').toLowerCase())?'series':'movie';return {id:'saimo:'+String(x.id||title),name:String(title),type,poster:image(x.poster||x.capa||x.logo||x.image,base),year:String(x.year||x.ano||''),url:'',source:'SaimoTV',summary:String(x.synopsis||x.sinopse||''),genre:String(x.genre||x.genero||''),streamUrl:media(x.streamUrl||x.stream||x.video||'')}}
 async function scan(root){let urls=['destaques.txt','indice.txt','index.txt','filmes/indice.txt','series/indice.txt','vod/destaques.txt','vod/indice.txt','vod/index.txt','vod/filmes/indice.txt','vod/series/indice.txt'];
 // Consulta as letras da coleção sem exigir baixar vídeos nem carregar todas as capas.
 for(const letter of letters){urls.push('filmes/'+letter+'.txt','filmes/'+letter.toUpperCase()+'.txt','vod/filmes/'+letter+'.txt','vod/series/'+letter+'.txt',letter+'.txt')}
 const map=new Map();let done=0,good=0,next=0;
 async function worker(){while(next<urls.length){const rel=urls[next++];try{const txt=await request(root+rel);const rows=parse(txt,root+rel,/series/i.test(rel)?'series':'movie');if(rows.length){good++;for(const it of rows){const prev=map.get(it.id);if(prev){if(!prev.poster)prev.poster=it.poster;if(!prev.streamUrl)prev.streamUrl=it.streamUrl}else if(map.size<cap)map.set(it.id,it)}}}catch(_){}done++}}
 await Promise.all(Array.from({length:5},worker));
 if(!map.size)throw Error('O acervo SaimoTV não disponibilizou um índice legível para esta versão do aplicativo');
 const o={items:[...map.values()],pages:good,at:Date.now(),errors:[],states:[]};save(o);return o}
 const load0=old.load.bind(old),get0=old.get.bind(old),home0=old.homepage.bind(old);
 old.load=function(name,force){if(name!=='SaimoTV')return load0(name,force);const remembered=current||cache();if(!force&&remembered&&Date.now()-remembered.at<6*3600000){current=remembered;return Promise.resolve(remembered)}
 if(task)return task;task=(async()=>{for(const root of ROOTS){try{return await scan(root)}catch(_){}}if(remembered){current=remembered;return remembered}throw Error('Não foi possível acessar o catálogo SaimoTV; confira a conexão ou a disponibilidade do índice público')})().finally(()=>task=null);return task};
 old.get=function(name){return name==='SaimoTV'?(current||cache()):get0(name)};
 old.homepage=function(name){return name==='SaimoTV'?'https://saimo-tv.pages.dev/':home0(name)};
 if(!old.providers.includes('SaimoTV'))old.providers.push('SaimoTV');
})();
