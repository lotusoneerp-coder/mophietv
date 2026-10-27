/* Mophie TV • Catálogo de Filmes e Séries.
   Fonte: Pluto TV Brasil — serviço gratuito, licenciado e financiado por anúncios, com streams HLS sem DRM.
   O catálogo é carregado uma única vez, reduzido para objetos compactos e pesquisado localmente. */
(function(){'use strict';
const BOOT='https://boot.pluto.tv/v4/start';
const VOD='https://service-vod.clusters.pluto.tv/v4/vod';
const CLIENT_KEY='mophietv_pluto_client';
const MAX_AGE=6*3600000;
const GENRES={'Drama':'Drama','Action & Adventure':'Ação e aventura','Children & Family':'Infantil e família','Comedy':'Comédia','Documentary':'Documentário','Horror':'Terror','Thriller':'Suspense','Sci-Fi & Fantasy':'Ficção científica','Romance':'Romance','Anime':'Anime','Western':'Faroeste','Crime':'Crime','Reality':'Reality','Faith & Spirituality':'Fé e espiritualidade','Music':'Música','Food & Cooking':'Culinária','News & Information':'Notícias','Variety Show':'Variedades','Home & Lifestyle':'Estilo de vida','Instructional & Educational':'Educativo','Talk Show':'Talk show','Game Show':'Game show','Young Adult':'Jovem adulto','Sports':'Esportes','Musical':'Musical','Telenovela':'Novela','War':'Guerra','Paranormal':'Paranormal'};
let session=null,catalog=null,loading=null;
const seasonsCache=new Map();

function clientId(){let id='';try{id=localStorage.getItem(CLIENT_KEY)||''}catch(e){}
 if(!/^[0-9a-f-]{36}$/.test(id)){id='xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return (c==='x'?r:(r&3|8)).toString(16)});try{localStorage.setItem(CLIENT_KEY,id)}catch(e){}}
 return id}
async function fetchJSON(url,headers,timeout){const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeout||15000);
 try{const r=await fetch(url,{headers:headers||{},signal:ctrl.signal});if(!r.ok){const e=new Error('HTTP '+r.status);e.status=r.status;throw e}return await r.json()}
 catch(e){if(e.name==='AbortError')throw new Error('Tempo de resposta esgotado');throw e}
 finally{clearTimeout(timer)}}
async function boot(force){if(session&&!force&&Date.now()<session.exp)return session;
 const id=clientId(),q=new URLSearchParams({appName:'web',appVersion:'9',deviceVersion:'120',deviceModel:'web',deviceMake:'chrome',deviceType:'web',clientID:id,clientModelNumber:'1.0.0',serverSideAds:'false'});
 const j=await fetchJSON(BOOT+'?'+q.toString());
 if(!j.sessionToken||!j.servers||!j.servers.stitcher)throw new Error('Sessão do catálogo indisponível');
 session={token:j.sessionToken,stitcher:j.servers.stitcher,params:j.stitcherParams||'',region:(j.session&&j.session.activeRegion)||'',exp:Date.now()+Math.max(600,(Number(j.refreshInSec)||3600)-300)*1000};
 return session}
async function api(path){let s=await boot();
 try{return await fetchJSON(VOD+path,{Authorization:'Bearer '+s.token},20000)}
 catch(e){if(e.status===401||e.status===403){s=await boot(true);return fetchJSON(VOD+path,{Authorization:'Bearer '+s.token},20000)}throw e}}
// Solicita imagens no tamanho exibido para reduzir download e memória na TV.
function img(url,w,h){if(!url)return '';return url.replace(/([?&])w=\d+/,'$1w='+w).replace(/([?&])h=\d+/,'$1h='+h)}
function cover(covers,ratio){const c=(covers||[]).find(x=>x&&x.aspectRatio===ratio);return c?c.url:''}
function rating(r){r=String(r||'').toUpperCase().replace(/^A(?=\d|L$)/,'');return /^(L|\d{1,2})$/.test(r)?r:''}
function year(d){const m=/^(\d{4})/.exec(d||'');return m?m[1]:''}
function reduce(it){const clip=it.clip||{};
 return {id:it._id,type:it.type,name:String(it.name||'').trim(),summary:String(it.summary||it.description||'').trim(),genre:GENRES[it.genre]||it.genre||'',rating:rating(it.rating),year:year(clip.originalReleaseDate),
  dur:Number(it.originalContentDuration||it.duration||0),poster:img(cover(it.covers,'347:500'),240,346),wide:img((it.featuredImage&&it.featuredImage.path)||cover(it.covers,'16:9'),960,540),
  path:(it.stitched&&it.stitched.path)||'',seasons:Array.isArray(it.seasonsNumbers)?it.seasonsNumbers.length:0,cast:(clip.actors||[]).slice(0,4),dir:(clip.directors||[]).slice(0,2)}}
function norm(s){return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}

async function load(force){if(catalog&&!force&&Date.now()-catalog.loadedAt<MAX_AGE)return catalog;if(loading)return loading;
 loading=(async()=>{const j=await api('/categories?includeItems=true&offset=1000&page=1');const items=new Map(),cats=[];
  for(const c of j.categories||[]){if(c.plutoOfficeOnly)continue;const ids=[];
   for(const it of c.items||[]){if(!it||(it.type!=='movie'&&it.type!=='series'))continue;if(it.type==='movie'&&!(it.stitched&&it.stitched.path))continue;if(!items.has(it._id)){const r=reduce(it);r.key=norm(r.name);items.set(it._id,r)}if(ids.indexOf(it._id)<0)ids.push(it._id)}
   if(ids.length)cats.push({id:c._id,name:String(c.name||'').trim(),ids})}
  if(!items.size)throw new Error('Catálogo vazio nesta região');
  catalog={items,cats,loadedAt:Date.now()};return catalog})();
 try{return await loading}finally{loading=null}}
function categories(type){if(!catalog)return [];const out=[];
 for(const c of catalog.cats){const ids=c.ids.filter(id=>catalog.items.get(id).type===type);if(ids.length)out.push({id:c.id,name:c.name,ids})}return out}
function item(id){return catalog?catalog.items.get(id)||null:null}
function search(q,type){if(!catalog)return [];const k=norm(q);if(!k)return [];const words=k.split(' '),hits=[];
 for(const it of catalog.items.values()){if(it.type!==type)continue;if(words.every(w=>it.key.indexOf(w)>=0))hits.push(it)}
 hits.sort((a,b)=>(b.key.indexOf(k)===0)-(a.key.indexOf(k)===0)||a.key.localeCompare(b.key));return hits.slice(0,140)}
async function seasons(seriesId){if(seasonsCache.has(seriesId))return seasonsCache.get(seriesId);
 const j=await api('/series/'+encodeURIComponent(seriesId)+'/seasons?offset=1000&page=1');
 const out={summary:String(j.description||j.summary||'').trim(),genre:GENRES[j.genre]||j.genre||'',rating:rating(j.rating),
  seasons:(j.seasons||[]).map(s=>({number:Number(s.number)||0,episodes:(s.episodes||[]).filter(e=>e&&e.stitched&&e.stitched.path).map(e=>({id:e._id,name:String(e.name||'').trim(),summary:String(e.description||'').trim(),num:Number(e.number)||0,season:Number(e.season||s.number)||0,dur:Number(e.originalContentDuration||e.duration||0),thumb:img(cover(e.covers,'16:9')||(e.featuredImage&&e.featuredImage.path),384,216),path:e.stitched.path})).sort((a,b)=>a.num-b.num)})).filter(s=>s.episodes.length).sort((a,b)=>a.number-b.number)};
 seasonsCache.set(seriesId,out);if(seasonsCache.size>40)seasonsCache.delete(seasonsCache.keys().next().value);return out}
async function streamUrl(path){const s=await boot();return s.stitcher+'/v2'+path+'?'+s.params+(s.params?'&':'')+'jwt='+encodeURIComponent(s.token)+'&masterJWTPassthrough=true'}

window.MophieCatalog={load,categories,item,search,seasons,streamUrl,loaded:()=>!!catalog,source:'Pluto TV Brasil'};
})();
