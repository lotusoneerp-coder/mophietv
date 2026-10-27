/* MophieFlix — leitor de títulos públicos. Não extrai streams ou ignora bloqueios.
   Cada fonte funciona apenas quando permite leitura das páginas na WebView. */
(function(){'use strict';
 const CONFIG={
  RedeCanais:{base:'https://redecanais.by',paths:[
   ['movie','/browse-filmes-videos-1-date.html','Filmes'],
   ['series','/browse-series-videos-1-date.html','Séries'],
   ['anime','/browse-animes-videos-1-date.html','Animes'],
   ['series','/browse-doramas-videos-1-date.html','Doramas'],
   ['series','/browse-desenhos-videos-1-date.html','Desenhos'],
   ['series','/browse-novelas-videos-1-date.html','Novelas']
  ],match:/^\/[^/?#]+_[0-9a-f]{7,16}\.html$/i}
 };
 const CACHE_KEY='mophietv_metadata_catalog_8',MAX_AGE=6*3600000,MAX_ITEMS=100000,MAX_PAGES=5;
 const all=new Map(),ongoing=new Map(),deepTasks=new Map(),moreTasks=new Map();
 const DB_NAME='mophie-catalog-cache',STORE='catalogs';
 function openDB(){return new Promise((resolve,reject)=>{if(!('indexedDB' in window))return reject(Error('IndexedDB indisponível'));
  const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
 async function readDB(name){try{const db=await openDB();return await new Promise(resolve=>{
  const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(name);
  r.onsuccess=()=>resolve(r.result&&Array.isArray(r.result.items)?r.result:null);r.onerror=()=>resolve(null);
  tx.oncomplete=()=>db.close();tx.onerror=()=>db.close()})}catch(e){return null}}
 async function writeDB(name,data){try{const db=await openDB();await new Promise(resolve=>{
  const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(data,name);
  tx.oncomplete=()=>resolve();tx.onerror=()=>resolve()});db.close()}catch(e){}}
 function saveAndNotify(name,data){all.set(name,data);saveCache(name,data);writeDB(name,data).catch(()=>{});
  try{window.dispatchEvent(new CustomEvent('mophie:catalog-updated',{detail:{name,count:data.items.length,pages:data.pages||0}}))}catch(e){}}
 function pause(ms){return new Promise(resolve=>setTimeout(resolve,ms))}

 function validURL(href,base){try{const u=new URL(href,base);return u.protocol==='https:'&&u.hostname.replace(/^www\./,'')===new URL(base).hostname.replace(/^www\./,'')?u.href:''}catch(e){return ''}}
 function clean(s){return String(s||'').replace(/\s+/g,' ').trim().slice(0,130)}
 const bannedImage=/avatar|user[-_]?profile|profile[-_]?picture|user[-_]?photo|favicon|logo|blank|placeholder|loading|pixel|icon[-_]|default[-_]?image|halloween|gravatar/i;
 function imageURL(src,base){if(!src||/^\s*(?:data:|blob:|javascript:)/i.test(src))return '';
  let raw=String(src).trim();if(raw.indexOf(',')>=0&&/(\d+(?:\.\d+)?x|\d+w)\s*[,\n]/.test(raw))raw=raw.split(',').map(x=>x.trim().split(/\s+/)[0]).filter(Boolean).slice(-1)[0]||'';
  try{const u=new URL(raw,base);return u.protocol==='https:'&&!bannedImage.test(u.pathname)?u.href:''}catch(e){return ''}}
 function posterSrc(root,base){if(!root)return '';
  const nodes=[root,...root.querySelectorAll('img,source,picture,[style],[data-poster],[data-image],[data-bg]')];
  const attribs=['data-poster','data-image','data-original','data-src','data-srcset','data-lazy-src','data-lazy','data-bg','data-background','data-background-image','data-fallback-src','srcset','src','poster'];
  for(const node of nodes){
   if(node.closest('header,footer,nav,[class*=avatar],[class*=profile],[class*=logo]'))continue;
   for(const a of attribs){const raw=node.getAttribute(a);if(!raw)continue;const url=imageURL(raw,base);if(url)return url}
   const style=node.getAttribute('style')||'',m=style.match(/(?:background(?:-image)?|--poster|--cover)\s*:\s*[^;]*url\(\s*['"]?([^)'"\s]+)/i);if(m){const url=imageURL(m[1],base);if(url)return url}
  }return ''}
 function titleOf(a){const heading=a.querySelector('h2,h3,h4,h5,.title,.name')||a.closest('article,li,[class*=item],[class*=card]')?.querySelector('h2,h3,h4,h5,.title,.name');
  const img=a.querySelector('img[alt]');let str=clean(a.getAttribute('title')||heading?.textContent||img?.getAttribute('alt')||a.textContent);
  str=str.replace(/^\s*(?:★\s*[\d,.]+\s*)+/g,'').replace(/\s*(?:★\s*[\d,.]+\s*)?(?:19|20)\d{2}\s*(?:Filmes|Séries|Animes)?\s*$/i,'').replace(/\s+(?:Filmes|Séries|Animes|Filme|Série)\s*$/i,'').trim();return str}
 function inferType(url,section,def){if(/\/(?:animes?|episodios|dorama|novela)\//i.test(url)||/anime/i.test(section))return 'anime';if(/\/(?:serie|series)\//i.test(url)||/s[eé]rie|temporada/i.test(section))return 'series';if(/\/(?:filme|filmes)\//i.test(url))return 'movie';return def==='mixed'?'movie':def}
 function cardNode(a){return a.closest('article,li,[class*=movie],[class*=film],[class*=item],[class*=card],[class*=poster],[class*=result],[class*=entry],[class*=slider]')||a.parentElement}
 function fromLinks(doc,cfg,group,name){const out=[];for(const a of doc.querySelectorAll('a[href]')){
  const url=validURL(a.getAttribute('href'),cfg.base);if(!url||!cfg.match.test(new URL(url).pathname))continue;
  const nameText=titleOf(a);if(nameText.length<2||nameText.length>110||/^(assistir|ver mais|pr[oó]ximo|anterior|p[aá]gina|in[ií]cio|user profile image|user avatar|profile picture)$/i.test(nameText))continue;
  const card=cardNode(a),section=clean(a.closest('section')?.querySelector('h2,h3')?.textContent||'');
  let poster=name==='RedeCanais'?'':posterSrc(a,cfg.base)||posterSrc(card,cfg.base);
  if(name!=='RedeCanais'&&!poster&&card&&card.parentElement&&card.parentElement.children.length===1)poster=posterSrc(card.parentElement,cfg.base);
  const rawYear=clean(card?.textContent||a.textContent).match(/\b(?:19|20)\d{2}\b/);
  out.push({id:cfg.base+'|'+new URL(url).pathname,name:nameText,type:inferType(url,section,group),poster,year:rawYear?.[0]||'',url,source:name,summary:'',genre:section});
 }return out}
 function fromPosters(doc,cfg,name){const out=[];
  for(const p of doc.querySelectorAll('img[alt]')){const title=clean(p.getAttribute('alt'));
   if(title.length<3||title.length>110||bannedImage.test(title)||/\b(usu[aá]rio|conta de usu[aá]rio)\b/i.test(title))continue;
   if(p.closest('header,footer,nav,[class*=avatar],[class*=profile],[class*=account]'))continue;
   const card=cardNode(p),header=clean(card?.querySelector('h2,h3,h4,h5')?.textContent||'');if(header&&header.toLowerCase()!==title.toLowerCase()&&Math.abs(header.length-title.length)>25)continue;
   const poster=posterSrc(p,cfg.base)||posterSrc(card,cfg.base);if(!poster)continue;
   const link=p.closest('a[href]')||card?.querySelector('a[href]');const url=link?validURL(link.getAttribute('href'),cfg.base):'';
   const section=clean(p.closest('section')?.querySelector('h2,h3')?.textContent||'');
   if(!url||!cfg.match.test(new URL(url).pathname))continue;
   out.push({id:cfg.base+'|'+new URL(url).pathname,name:header||title,type:inferType(url,section,'mixed'),poster,year:(clean(card?.textContent).match(/\b(?:19|20)\d{2}\b/)||[])[0]||'',url:cfg.match.test(url?new URL(url).pathname:'')?url:'',source:name,summary:'',genre:section});
  }return out}
 async function readPage(url,timeout){const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeout||14000);
  try{const res=await fetch(url,{signal:ctrl.signal,credentials:'omit',redirect:'follow'});if(!res.ok)throw Error('HTTP '+res.status);
   const ct=res.headers.get('content-type')||'';if(ct&&!/html|text\//i.test(ct))throw Error('Resposta não é HTML');
   const html=await res.text();
   if(/p[aá]gina bloqueada[^\n]{0,200}c[oó]digo\s*16|espertinhos? se ferr/i.test(html))throw Error('RedeCanais recusou acesso (código 16)');
   return new DOMParser().parseFromString(html.slice(0,3000000),'text/html')
  }finally{clearTimeout(timer)}}
 function metaImage(doc,base){for(const sel of ['meta[property="og:image"]','meta[name="twitter:image"]','link[rel="image_src"]','[itemprop="image"]']){
  for(const el of doc.querySelectorAll(sel)){const found=imageURL(el.getAttribute('content')||el.getAttribute('href')||el.getAttribute('src'),base);if(found)return found}}
  for(const ld of doc.querySelectorAll('script[type="application/ld+json"]')){try{
   const raw=JSON.parse(ld.textContent||'null'),items=Array.isArray(raw)?raw:[raw];
   for(const it of items){const v=it&&it.image,src=typeof v==='string'?v:Array.isArray(v)?v[0]:v&&v.url;
    const u=imageURL(src,base);if(u)return u}
  }catch(e){}}
  return posterSrc(doc.querySelector('main article,main,.detail,.detail-content,.info,article'),base)||posterSrc(doc.querySelector('img[alt]'),base)}
 async function enrichMissingPosters(list,cfg){const rows=list.filter(x=>!x.poster&&x.url&&cfg.match.test(new URL(x.url).pathname)).slice(0,12);
  if(!rows.length)return;
  let next=0;await Promise.all(Array.from({length:3},async()=>{while(next<rows.length){const it=rows[next++];try{const doc=await readPage(it.url,7000);it.poster=metaImage(doc,it.url)||''}catch(e){/* offline / CORS: mantém capa textual */}}}));}
 function nextPages(doc,url,cfg){
  const found=[];
  for(const a of doc.querySelectorAll('a[href]')){
   const u=validURL(a.getAttribute('href'),cfg.base);if(!u||u===url)continue;
   const label=clean((a.textContent||'')+' '+(a.getAttribute('aria-label')||'')+' '+(a.getAttribute('rel')||''));
   const p=new URL(u).pathname,basePath=new URL(url).pathname.replace(/\/$/,'');
   if(cfg.base==='https://redecanais.by'){
    const cur=basePath.match(/^\/(browse-[a-z0-9-]+-videos-)(\d+)(-date\.html)$/i);
    const target=p.match(/^\/(browse-[a-z0-9-]+-videos-)(\d+)(-date\.html)$/i);
    // Ignore páginas de outras categorias, links distantes e a página anterior.
    if(cur&&target&&target[1]===cur[1]&&Number(target[2])>Number(cur[2])&&Number(target[2])<=Number(cur[2])+3){
     if(!found.includes(u))found.push(u);
     if(found.length>=MAX_PAGES-1)break;
    }
    continue;
   }
   // Paginar somente a mesma seção de catálogo, nunca páginas individuais ou links de anúncio.
   if(!(/\b(?:pr[oó]xim[ao]|next|seguinte|p[aá]gina|page)\b/i.test(label)||/(?:\/page\/\d+\/?$|[?&](?:page|paged)=\d+)/i.test(u)))continue;
   if(!(p===basePath||p.startsWith(basePath+'/')||p.replace(/\/$/,'')===basePath))continue;
   if(/(?:como-assistir|player|login|cadastro|contato|ajuda|episode|episodio)/i.test(p))continue;
   if(!found.includes(u))found.push(u);
   if(found.length>=MAX_PAGES-1)break;
  }
  return found;
 }
 function readCache(name){try{const v=JSON.parse(localStorage.getItem(CACHE_KEY+'_'+name)||'null');return v&&Array.isArray(v.items)?v:null}catch(e){return null}}
 function saveCache(name,data){try{localStorage.setItem(CACHE_KEY+'_'+name,JSON.stringify({...data,items:data.items.slice(0,1000)}))}catch(e){}}
 async function load(name,force){const cfg=CONFIG[name];if(!cfg)throw Error('Fonte não cadastrada');const old=all.get(name)||await readDB(name)||readCache(name);
  if(!force&&old&&Date.now()-old.at<MAX_AGE){all.set(name,old);scheduleSync(name);return old}if(ongoing.has(name))return ongoing.get(name);
  const op=(async()=>{const settled=await Promise.allSettled(cfg.paths.map(async([kind,path,label])=>{
    const first=cfg.base+path,queue=[first],seen=new Set(),pages=[],started=Date.now();
    while(queue.length&&pages.length<MAX_PAGES&&Date.now()-started<23000){
     const url=queue.shift();if(seen.has(url))continue;seen.add(url);
     let doc;try{doc=await readPage(url,Math.min(7500,Math.max(1500,23000-(Date.now()-started))))}catch(e){if(url===first)throw e;continue}
     pages.push(doc);
     for(const next of nextPages(doc,url,cfg))if(!seen.has(next)&&!queue.includes(next))queue.push(next);
    }
    return {section:path,next:queue[0]||'',items:pages.flatMap(d=>[...fromLinks(d,cfg,kind,name)].map(it=>{
     if(name==='RedeCanais'){it.type=kind;it.genre=it.genre||label||''}
     return it
    })),pages:pages.length}
   }));
   const map=new Map((force&&old&&Array.isArray(old.items)?old.items:[]).map(it=>[it.id,it])),errors=[],states=[];let loadedPages=0;for(const part of settled){if(part.status==='rejected'){errors.push(String(part.reason?.message||part.reason));continue}
    loadedPages+=part.value.pages;states.push({section:part.value.section,next:part.value.next,pages:part.value.pages});
    for(const it of part.value.items){const prev=map.get(it.id);if(prev){if(!prev.poster&&it.poster)prev.poster=it.poster;if(!prev.url&&it.url)prev.url=it.url;if(!prev.genre&&it.genre)prev.genre=it.genre}
     else if(map.size<MAX_ITEMS)map.set(it.id,it)}}
   if(!map.size){if(old){all.set(name,{...old,stale:true,errors});return all.get(name)}throw Error(errors[0]||'Nenhum título público encontrado')}
   const items=[...map.values()]; // Apenas metadados, sem buscar imagens
   const result={items,at:Date.now(),stale:false,errors,pages:loadedPages,states};saveAndNotify(name,result);scheduleSync(name);return result})();
  ongoing.set(name,op);try{return await op}finally{ongoing.delete(name)}}
 // Busca paginas seguintes SOMENTE onde o site publica links de paginacao.
 // Se o servidor devolver codigo 16, o catalogo fica preservado, sem contornar o bloqueio.
 async function loadMoreBatch(name){
  if(name!=='RedeCanais')throw Error('Carregamento adicional disponivel apenas para RedeCanais');
  const cfg=CONFIG[name];let previous=all.get(name)||await readDB(name)||readCache(name);
  if(!previous||!Array.isArray(previous.states)||!previous.states.length)previous=await load(name,true);
  const sections=previous.states.map(st=>({...st})),errors=[];
  const settled=await Promise.allSettled(sections.map(async st=>{
   const added=[],visited=new Set();let u=st.next||'',pages=0;
   while(u&&pages<2){
    if(visited.has(u))break;visited.add(u);
    const doc=await readPage(u,11000),entry=cfg.paths.find(x=>x[1]===st.section);
    if(!entry)break;
    added.push(...fromLinks(doc,cfg,entry[0],name));pages++;
    st.next=nextPages(doc,u,cfg).find(x=>!visited.has(x))||'';u=st.next;
   }
   st.pages+=pages;
   return {items:added,state:st,pages};
  }));
  const updatedStates=[];let fetched=0;const map=new Map(previous.items.map(it=>[it.id,{...it}]));
  settled.forEach((r,i)=>{
   if(r.status==='rejected'){updatedStates.push(sections[i]);errors.push(String(r.reason?.message||r.reason));return;}
   const {items,state,pages}=r.value;updatedStates.push(state);fetched+=pages;
   for(const it of items){const existing=map.get(it.id);
    if(existing){if(!existing.poster&&it.poster)existing.poster=it.poster;if(!existing.genre&&it.genre)existing.genre=it.genre;}
    else if(map.size<MAX_ITEMS)map.set(it.id,it);
   }
  });
  if(!fetched&&errors.length)throw Error(errors[0]);
  const result={items:[...map.values()],at:Date.now(),stale:false,
                errors,pages:(previous.pages||0)+fetched,states:updatedStates};
  saveAndNotify(name,result);
  return { ...result,added:result.items.length-previous.items.length };
 }
 function loadMore(name){if(moreTasks.has(name))return moreTasks.get(name);
  const task=loadMoreBatch(name).finally(()=>moreTasks.delete(name));moreTasks.set(name,task);return task}
 function hasMore(data){return !!(data&&data.items.length<MAX_ITEMS&&data.states&&data.states.some(s=>s.next&&s.pages<5000))}
 function scheduleSync(name){if(name!=='RedeCanais'||deepTasks.has(name))return;
  setTimeout(()=>{if(!deepTasks.has(name))syncAll(name).catch(()=>{})},3500)}
 function syncAll(name){if(name!=='RedeCanais')return Promise.reject(Error('Fonte não autorizada'));
  if(deepTasks.has(name))return deepTasks.get(name);
  const task=(async()=>{
   let count=0;while(count++<1200){
    const data=all.get(name)||await readDB(name)||readCache(name);
    if(!hasMore(data)||navigator.onLine===false)break;
    if(window.__mophie&&window.__mophie.S&&window.__mophie.S.playing){await pause(5000);continue}
    try{await loadMore(name)}
    catch(e){const cached=all.get(name);if(cached){cached.errors=[String(e.message||e)];saveAndNotify(name,cached)}break}
    await pause(1100);
   }
   return all.get(name)||null;
  })().finally(()=>deepTasks.delete(name));deepTasks.set(name,task);return task;
 }
 function get(name){return all.get(name)||readCache(name)||null}
 function homepage(name){return CONFIG[name]?.base+'/'||''}
 // Restaurar o catálogo integral do IndexedDB ao iniciar: localStorage contém só uma amostra.
  readDB('RedeCanais').then(data=>{
   if(!data||!Array.isArray(data.items)||!data.items.length)return;
   const current=all.get('RedeCanais');if(current&&current.items.length>=data.items.length)return;
   all.set('RedeCanais',data);
   try{window.dispatchEvent(new CustomEvent('mophie:catalog-updated',{detail:{name:'RedeCanais',count:data.items.length,pages:data.pages||0}}))}catch(e){}
   if(navigator.onLine!==false)scheduleSync('RedeCanais');
  }).catch(()=>{});
  window.MophieSources={load,loadMore,syncAll,get,homepage,providers:Object.keys(CONFIG),validURL,metaImage,posterSrc};
})();
