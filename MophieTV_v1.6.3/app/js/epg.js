/* Mophie TV EPG 1.4.4 — conservador: horários reais do XMLTV, sem associação por prefixo.
   Diferentes feeds de um mesmo canal podem ter grades diferentes. Sem tvg-id ou nome exato e
   inequívoco, preferimos mostrar 'Programação indisponível' a atribuir a grade de outro canal. */
(function(){
 'use strict';
 const SOURCES=[
  'https://epg.pw/xmltv/epg_BR.xml',
  'https://raw.githubusercontent.com/iptv-com/epg/main/guides/brazil.xml'
 ];
 const CACHE_KEY='mophietv_epg_strict_v144';
 const MAX_AGE=3*3600000, MAX_PROGRAM_AGE=24*3600000;
 let saved=null, pending=null;
 function norm(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/\[[^\]]*\]/g,' ').replace(/\((?:\d{3,4}p|hd|fhd|4k|sd)\)/gi,' ')
  .replace(/(?:\s|\b)(?:uhd|fhd|hd|4k|1080p|720p|480p)$/gi,'')
  .replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
 function xmlDate(value){
  const m=String(value||'').trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?/);
  if(!m)return NaN;
  const tz=m[7]?m[7].slice(0,3)+':'+m[7].slice(3):'Z';
  return Date.parse(m[1]+'-'+m[2]+'-'+m[3]+'T'+m[4]+':'+m[5]+':'+(m[6]||'00')+tz);
 }
 function val(el,tag){const n=el.getElementsByTagName(tag)[0];return n?String(n.textContent||'').trim():''}
 function parse(text){
  if(text.length>18*1024*1024)throw Error('XMLTV excede o limite de memória');
  const doc=new DOMParser().parseFromString(text,'application/xml');
  if(doc.getElementsByTagName('parsererror').length||doc.documentElement.nodeName!=='tv')throw Error('XMLTV inválido');
  const names={}, ids={};
  for(const ch of doc.getElementsByTagName('channel')){
   const id=ch.getAttribute('id');if(!id)continue;
   ids[id]=true;
   const variants=[...ch.getElementsByTagName('display-name')].map(x=>norm(x.textContent));
   variants.push(norm(id));
   for(const name of new Set(variants.filter(x=>x.length>=2))){
    if(!names[name])names[name]=[];
    if(names[name].indexOf(id)<0)names[name].push(id);
   }
  }
  const schedules={},now=Date.now(),before=now-4*3600000,after=now+3*86400000;
  for(const p of doc.getElementsByTagName('programme')){
   const id=p.getAttribute('channel');if(!ids[id])continue;
   const start=xmlDate(p.getAttribute('start')),stop=xmlDate(p.getAttribute('stop'));
   if(!Number.isFinite(start)||!Number.isFinite(stop)||stop<=start||stop<before||start>after||stop-start>12*3600000)continue;
   const title=val(p,'title');if(!title)continue;
   (schedules[id]||(schedules[id]=[])).push({title,desc:val(p,'desc').slice(0,400),category:val(p,'category'),start,stop});
  }
  for(const id of Object.keys(schedules))schedules[id].sort((a,b)=>a.start-b.start);
  return {at:Date.now(),names,ids,schedules};
 }
 async function request(url){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
  try{const r=await fetch(url,{signal:ctrl.signal,credentials:'omit'});if(!r.ok)throw Error('HTTP '+r.status);
   const data=await r.text(),guide=parse(data);guide.source=url;return guide;
  }finally{clearTimeout(timer)}
 }
 function fromCache(){try{const x=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');return x&&x.names&&x.ids&&x.schedules?x:null}catch(e){return null}}
 async function load(force){
  if(!force&&saved&&Date.now()-saved.at<MAX_AGE)return saved;
  if(!force&&!saved){saved=fromCache();if(saved&&Date.now()-saved.at<MAX_AGE)return saved}
  if(pending)return pending;
  pending=(async()=>{
   const errors=[];
   for(const url of SOURCES){try{const data=await request(url);
     if(!Object.keys(data.schedules).length)throw Error('XMLTV sem programação atual');
     saved=data;try{localStorage.setItem(CACHE_KEY,JSON.stringify(data))}catch(e){}
     return data;
    }catch(e){errors.push(String(e.message||e))}}
   if(saved&&Date.now()-saved.at<MAX_PROGRAM_AGE){saved.stale=true;return saved}
   throw Error('Guia não disponível: '+errors.join(' / ').slice(0,130));
  })();
  try{return await pending}finally{pending=null}
 }
 function matchId(channel,guide){
  if(!guide)return null;
  const id=channel&&typeof channel==='object'?(channel.tvgId||channel.tvg_id||channel.epgId||''):'';
  if(id&&guide.ids[id])return id;
  const name=typeof channel==='object'?channel.name:channel;
  const candidates=guide.names[norm(name)]||[];
  // IDs duplicados para o mesmo nome podem ser feeds regionais diferentes.
  // Não atribuir a programação do canal errado.
  return candidates.length===1?candidates[0]:null;
 }
 function find(channel,guide){const id=matchId(channel,guide);return id?(guide.schedules[id]||[]):[]}
 function current(channel,guide,now){
  if(!guide||guide.stale||Date.now()-guide.at>MAX_AGE)return null;
  const ts=now==null?Date.now():now;
  const list=find(channel,guide).filter(p=>p.start<=ts&&p.stop>ts);
  if(list.length!==1)return null;
  const p=list[0];return p.stop-p.start>12*3600000?null:p;
 }
 window.MophieEPG={load,find,current,parse,xmlDate,norm,matchId};
})();
