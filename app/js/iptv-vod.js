/* Mophie TV — biblioteca IPTV VOD local.
   Importa playlist M3U e catálogo Xtream fornecidos pelo usuário.
   Credenciais ficam apenas no IndexedDB deste dispositivo, nunca no código do APK. */
(function(){'use strict';
 const DB='mophietv-iptv-vod',STORE='library',LIMIT=100000;
 let state={items:[],config:null,updated:0},ready=null;
 const validURL=value=>{try{const u=new URL(String(value||'').trim());return (u.protocol==='http:'||u.protocol==='https:')&&!!u.hostname&&!u.username&&!u.password?u:null}catch(_){return null}};
 const text=x=>String(x==null?'':x).replace(/[\u0000-\u001f]+/g,' ').trim().slice(0,170);
 function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)};
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('IndexedDB indisponível'))})}
 async function persist(){const db=await openDB();try{await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');
   tx.objectStore(STORE).put(state,'catalog');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}finally{db.close()}}
 async function load(){if(ready)return ready;ready=(async()=>{try{const db=await openDB();try{const saved=await new Promise((resolve,reject)=>{
    const r=db.transaction(STORE,'readonly').objectStore(STORE).get('catalog');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
    if(saved&&Array.isArray(saved.items))state={items:saved.items.slice(0,LIMIT),config:saved.config||null,updated:saved.updated||0}
   }finally{db.close()}}catch(e){console.warn('Biblioteca IPTV local indisponível:',e.message)}return state})();return ready}
 const info=()=>({count:state.items.length,updated:state.updated,kind:state.config&&state.config.kind});
 const items=()=>state.items;
 function xtreamFromVideo(raw){const u=validURL(raw);if(!u)return null;
  const match=u.pathname.match(/^\/movie\/([^/]+)\/([^/]+)\/(\d+)\.(mp4|mkv|ts|m3u8)$/i);
  if(!match)return null;
  try{return {kind:'xtream',origin:u.origin,username:decodeURIComponent(match[1]),password:decodeURIComponent(match[2]),example:{id:match[3],ext:match[4],url:u.href}}}
  catch(_){return null}}
 function parseM3u(source){const lines=String(source||'').split(/\r?\n/),out=[];let name='',category='',logo='';
  for(const s of lines){const line=s.trim();
   if(line.startsWith('#EXTINF')){name=text(line.slice(line.indexOf(',')+1));
    category=text((line.match(/group-title="([^"]*)"/i)||[])[1]);logo=(line.match(/tvg-logo="([^"]*)"/i)||[])[1]||''}
   else if(line&&!line.startsWith('#')){const u=validURL(line);
    if(u&&name&&out.length<LIMIT){out.push({id:'m3u-'+out.length,name,category,url:u.href,poster:validURL(logo)?.href||'',kind:'direct'})}
    name='';category='';logo=''}}
  return out}
 function normalizeXtream(json){if(!Array.isArray(json))throw Error('API não retornou uma lista de filmes');
  const out=[];for(const x of json){if(out.length>=LIMIT)break;
   const id=Number(x&&x.stream_id);if(!Number.isSafeInteger(id)||id<=0)continue;
   const name=text(x.name);if(!name)continue;
   const ext=String(x.container_extension||'mp4').toLowerCase().replace(/[^a-z0-9]/g,'');
   if(!['mp4','mkv','ts','m3u8'].includes(ext))continue;
   out.push({id:'xtream-'+id,name,category:text(x.category_name||''),streamId:id,ext,kind:'xtream',poster:''})}
  return out}
 async function request(url,asJSON){const u=validURL(url);if(!u)throw Error('Link inválido');
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),22000);
  try{const r=await fetch(u.href,{credentials:'omit',redirect:'follow',signal:c.signal});
   if(!r.ok)throw Error('Servidor respondeu HTTP '+r.status);
   const body=await r.text();if(body.length>30000000)throw Error('Catálogo acima do limite de tamanho');
   return asJSON?JSON.parse(body):body
  }catch(e){if(e.name==='AbortError')throw Error('Tempo limite de leitura do IPTV');throw e}finally{clearTimeout(timer)}}
 async function importSource(raw,progress){await load();const source=String(raw||'').trim();const xtream=xtreamFromVideo(source);
  const tell=(m)=>{if(typeof progress==='function')progress(m)};
  if(xtream){
   const api=xtream.origin+'/player_api.php?username='+encodeURIComponent(xtream.username)+'&password='+encodeURIComponent(xtream.password)+'&action=get_vod_streams';
   tell('Consultando catálogo Xtream…');
   try{const list=normalizeXtream(await request(api,true));
    if(!list.length)throw Error('Catálogo sem vídeos reconhecidos');
    state={items:list,config:{kind:'xtream',origin:xtream.origin,username:xtream.username,password:xtream.password},updated:Date.now()};
    await persist();return {count:list.length,kind:'xtream'};
   }catch(e){tell('Catálogo indisponível; cadastrando somente o vídeo enviado…');
    const single={id:'direct-'+xtream.example.id,name:'Filme '+xtream.example.id,category:'IPTV',kind:'direct',url:xtream.example.url};
    state={items:[single],config:{kind:'direct'},updated:Date.now()};await persist();
    return {count:1,kind:'direct',warning:'Não foi possível importar o catálogo: '+e.message+'. Somente o MP4 informado foi cadastrado.'}}}
  let list;
  if(source.startsWith('#EXTM3U')){tell('Lendo playlist M3U…');list=parseM3u(source)}
  else{const u=validURL(source);if(!u)throw Error('Informe um MP4, playlist M3U ou link Xtream válido');
   if(/\.(mp4|m3u8|webm)(?:$|[?#])/i.test(u.href)){
    list=[{id:'direct-'+Date.now(),name:'Vídeo '+decodeURIComponent(u.pathname.split('/').pop()||'IPTV').slice(0,70),category:'IPTV',kind:'direct',url:u.href}]}
   else{tell('Baixando playlist M3U…');list=parseM3u(await request(u.href,false))}}
  if(!list.length)throw Error('Nenhum filme encontrado; confira o link ou o formato M3U');
  state={items:list,config:{kind:'m3u'},updated:Date.now()};await persist();
  return {count:list.length,kind:state.config.kind}}
 function videoUrl(item){if(!item)return '';
  if(item.kind==='direct')return validURL(item.url)?.href||'';
  if(item.kind==='xtream'&&state.config&&state.config.kind==='xtream'){
   const c=state.config;return c.origin+'/movie/'+encodeURIComponent(c.username)+'/'+encodeURIComponent(c.password)+'/'+item.streamId+'.'+item.ext}
  return ''}
 async function remove(){await load();state={items:[],config:null,updated:0};await persist()}
 window.MophieIptvVod={load,items,info,importSource,remove,videoUrl,parseM3u,normalizeXtream,xtreamFromVideo};
})();
