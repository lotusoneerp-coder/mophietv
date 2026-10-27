/* Mophie TV 1.5.1 — MeuGuia como fonte primária e mi.tv como alternativa.
   EPG anterior (XMLTV) não é consultado para exibição. Só usa canal exato,
   dia correto em America/Sao_Paulo e programação realmente publicada.
   Se CORS ou o site impedir leitura, informa indisponibilidade. */
(function(){'use strict';
 const CATEGORIES=['Aberta','Filmes','Series','Esportes','Infantil','Variedades','Documentarios','Noticias'];
 const ROOT='https://meuguia.tv/programacao/';
 const VERIFIED_CHANNEL_PAGES={'cartoon network':'https://meuguia.tv/programacao/canal/CAR','tooncast':'https://meuguia.tv/programacao/canal/TOC','a e':'https://meuguia.tv/programacao/canal/MDO'};
 const CACHE=new Map(),CATEGORY_CACHE=new Map(),CATEGORY_PENDING=new Map(),CHANNEL_INDEX=new Map();
 let indexPrepared=false,indexPromise=null;
 const TTL=12*60000, CATEGORY_TTL=25*60000;
 const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/\[[^\]]*(?:not 24\/7|geo.blocked)[^\]]*\]/g,'')
  .replace(/\((?:br|brazil|brasil|latin america brazil|latin america|720p|1080p|4k)\)/g,'')
  .replace(/\b(?:latin america brazil|brasil|brazil|ao vivo|hd|fhd|1080p|720p|4k)\b/g,'')
  .replace(/[^a-z0-9]+/g,' ').trim();
 function brazil(d){return new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(d).reduce((a,p)=>(a[p.type]=Number(p.value)||p.value,a),{})}
 function timestamp(day,month,year,hour,minute){return Date.UTC(year,month-1,day,hour+3,minute)}
 async function page(url){const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),10500);
  try{const res=await fetch(url,{signal:ctrl.signal,credentials:'omit',redirect:'follow'});
   if(!res.ok)throw Error('HTTP '+res.status);
   if(!/^https:\/\/(?:www\.)?(?:meuguia\.tv|mi\.tv)\//i.test(res.url))throw Error('Redirecionamento inesperado');
   const html=await res.text();if(html.length>4200000)throw Error('Guia maior que o limite');
   return new DOMParser().parseFromString(html,'text/html');
  }finally{clearTimeout(timer)}
 }
 function dayFromText(txt,now){const m=String(txt||'').match(/(?:^|\D)([0-3]?\d)\s*\/\s*(0?[1-9]|1[0-2])(?:\D|$)/);if(!m)return null;
  const day=Number(m[1]),month=Number(m[2]);if(day<1||day>31)return null;
  const b=brazil(now);let y=b.year;
  // Virada de dezembro/janeiro: considerar apenas as datas próximas ao relógio atual.
  if(b.month===12&&month===1)y++;
  if(b.month===1&&month===12)y--;
  return {day,month,year:y};
 }
 function parseProgrammes(doc,now){now=now||new Date();const h=doc.querySelector('h1');const channel=h?h.textContent.trim():'';
  const root=doc.querySelector('main')||doc.body;
  const walker=doc.createTreeWalker(root,NodeFilter.SHOW_TEXT),tokens=[];
  while(walker.nextNode()){
   const n=walker.currentNode,p=n.parentElement;if(!p||p.closest('script,style,noscript,nav,header,footer'))continue;
   const s=(n.nodeValue||'').replace(/\s+/g,' ').trim();if(s&&s.length<160)tokens.push(s);
   if(tokens.length>26000)break;
  }
  const out=[];let date=null;
  for(let i=0;i<tokens.length;i++){
   const str=tokens[i],d=dayFromText(str,now);
   if(d){date=d;continue}
   const match=str.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
   if(!match||!date)continue;
   let title='',cat='';
   for(let j=i+1;j<Math.min(tokens.length,i+5);j++){
    const val=tokens[j];if(/^(no ar|publicidade|compartilhar)$/i.test(val))continue;
    if(/^\d{1,2}:\d{2}$/.test(val)||dayFromText(val,now))break;
    if(!title&&val.length>1){title=val;continue}
    if(title&&val!==title){cat=val;break}
   }
   if(!title||/^(programa[cç][aã]o|como assistir|in[ií]cio|mais)$/i.test(title))continue;
   const start=timestamp(date.day,date.month,date.year,Number(match[1]),Number(match[2]));
   if(!isFinite(start)||Math.abs(start-now.getTime())>3*86400000)continue;
   out.push({title,start,category:cat,desc:'',source:'MeuGuia'});
  }
  out.sort((a,b)=>a.start-b.start);
  const distinct=[];for(const p of out){const last=distinct[distinct.length-1];if(last&&last.start===p.start){
    if(last.title!==p.title)distinct.pop();else continue;
    continue;
   }distinct.push(p)}
  const items=[];
  for(let i=0;i<distinct.length;i++){
   const row=distinct[i];const next=distinct[i+1];
   // Duração só confirmada quando existe horário de início do programa seguinte.
   if(!next)continue;
   const span=next.start-row.start;
   if(span<60000||span>6*3600000)continue;
   items.push({...row,stop:next.start});
  }
  return {channel,items:items.filter(p=>p.stop>now.getTime()-3*3600000&&p.start<now.getTime()+30*3600000)};
 }
 function candidates(channel){const label=norm(channel.name||channel),cat=norm(channel.label||channel.category||'');
  if(/infantil|animac|desenho|cartoon|nick|gloob|discovery kids/i.test(label+' '+cat))return ['Infantil','Variedades'];
  if(/filme|telecine|cinema|hbo|tnt|megapix|cinemax/i.test(label+' '+cat))return ['Filmes','Series','Variedades'];
  if(/esport|espn|sportv|band sport/i.test(label+' '+cat))return ['Esportes'];
  if(/notic|jornal|news|cnn|globo news/i.test(label+' '+cat))return ['Noticias','Aberta'];
  if(/document|discovery|history|nat geo/i.test(label+' '+cat))return ['Documentarios','Variedades'];
  return CATEGORIES;
 }
 async function categoryPage(name,force){
  const old=CATEGORY_CACHE.get(name);
  if(!force&&old&&Date.now()-old.at<CATEGORY_TTL)return old.doc;
  if(CATEGORY_PENDING.has(name))return CATEGORY_PENDING.get(name);
  const request=page(ROOT+'categoria/'+name).then(doc=>{
   CATEGORY_CACHE.set(name,{doc,at:Date.now()});
   for(const a of doc.querySelectorAll('a[href*="/programacao/canal/"]')){
    let url;try{url=new URL(a.getAttribute('href'),'https://meuguia.tv')}catch(e){continue}
    if(!['meuguia.tv','www.meuguia.tv'].includes(url.hostname))continue;
    const text=(a.querySelector('b,strong,h2,h3')?.textContent||a.textContent||'').replace(/\s+\d\d?:\d\d[\s\S]*$/,'').trim();
    const label=norm(text);if(!label)continue;
    const links=CHANNEL_INDEX.get(label)||new Set();links.add(url.href);CHANNEL_INDEX.set(label,links);
   }
   return doc;
  }).finally(()=>CATEGORY_PENDING.delete(name));
  CATEGORY_PENDING.set(name,request);return request;
 }
 async function prepare(){
  if(indexPrepared)return {size:CHANNEL_INDEX.size};
  if(indexPromise)return indexPromise;
  indexPromise=(async()=>{
   // Dividir a descoberta em lotes limita as conexões simultâneas na Android TV.
   for(let i=0;i<CATEGORIES.length;i+=4){
    await Promise.allSettled(CATEGORIES.slice(i,i+4).map(c=>categoryPage(c,false)));
   }
   indexPrepared=true;
   return {size:CHANNEL_INDEX.size};
  })().finally(()=>{indexPromise=null});
  return indexPromise;
 }
 async function meuguia(channel,force){const label=norm(channel.name||channel),old=CACHE.get('meu:'+label);
  if(!force&&old&&Date.now()-old.at<TTL)return old.items;
  // Referências confirmadas, vinculadas ao nome exato; nunca preencher por semelhança.
  const verified=VERIFIED_CHANNEL_PAGES[label];
  if(verified){try{const data=parseProgrammes(await page(verified));
   if(norm(data.channel)===label&&data.items.length){CACHE.set('meu:'+label,{at:Date.now(),items:data.items});return data.items}
  }catch(e){/* prosseguir para a lista oficial de canais */}}
  // Quando a sincronização inicial criou o índice, não procurar 8 categorias de novo
  // por canal: consulta direta e inequívoca da página correta.
  const indexed=CHANNEL_INDEX.get(label);
  if(indexed&&indexed.size===1){
   try{const data=parseProgrammes(await page([...indexed][0]));
    if(norm(data.channel)===label&&data.items.length){CACHE.set('meu:'+label,{at:Date.now(),items:data.items});return data.items}
   }catch(e){/* Sem permissão do provedor para ler a página */}
  }
  for(const category of candidates(channel)){
   try{const doc=await categoryPage(category,!!force);
    const matches=[];
    for(const a of doc.querySelectorAll('a[href*="/programacao/canal/"]')){
     const href=new URL(a.getAttribute('href'),'https://meuguia.tv');
     if(!['meuguia.tv','www.meuguia.tv'].includes(href.hostname))continue;
     const text=(a.querySelector('b,strong,h2,h3')?.textContent||a.textContent||'').replace(/\s+\d\d?:\d\d[\s\S]*$/,'').trim();
     if(norm(text)===label&&!matches.includes(href.href))matches.push(href.href);
    }
    if(matches.length!==1)continue;
    const data=parseProgrammes(await page(matches[0]));
    if(norm(data.channel)!==label||!data.items.length)continue;
    CACHE.set('meu:'+label,{at:Date.now(),items:data.items});return data.items;
   }catch(e){/* Sem acesso pela WebView: não insistir nas oito categorias. */
     if(e instanceof TypeError||/failed to fetch|network|cors|abort/i.test(String(e.message||e)))break;}
  }
  return [];
 }
 let miCache={at:0,entries:[]},miPending=null;
 async function miIndex(){
  if(Date.now()-miCache.at<CATEGORY_TTL)return miCache.entries;
  if(miPending)return miPending;
  miPending=(async()=>{
   const doc=await page('https://mi.tv/br/programacao');let entries=[];
   for(const el of doc.querySelectorAll('script[type="application/ld+json"]')){
    let payload;try{payload=JSON.parse(el.textContent)}catch(e){continue}
    const stack=Array.isArray(payload)?payload:[payload];
    while(stack.length){const x=stack.pop();if(!x||typeof x!=='object')continue;
     if(Array.isArray(x['@graph']))stack.push(...x['@graph']);
     if(!String(x['@type']||'').includes('BroadcastEvent'))continue;
     const channel=norm(x.broadcastOfEvent?.name||x.publishedOn?.name||'');
     const start=Date.parse(x.startDate),stop=Date.parse(x.endDate);
     if(channel&&x.name&&isFinite(start)&&isFinite(stop)&&start<Date.now()+86400000&&stop>Date.now()-3*3600000&&stop>start){
      entries.push({channel,title:String(x.name),start,stop,desc:'',category:'',source:'mi.tv'});
     }
    }
   }
   miCache={at:Date.now(),entries};return entries;
  })().catch(e=>{miCache={at:Date.now(),entries:[]};return []}).finally(()=>miPending=null);
  return miPending;
 }
 async function mitv(channel){const entries=await miIndex(),key=norm(channel.name||channel);
  return entries.filter(x=>x.channel===key).map(({channel,...p})=>p).sort((a,b)=>a.start-b.start);
 }
 async function find(channel,force){const found=await meuguia(channel,!!force);
  if(found.length)return {items:found,source:'MeuGuia'};
  const alt=await mitv(channel);return {items:alt,source:alt.length?'mi.tv':'nenhuma fonte confirmada'};
 }
 window.MophiePublishedGuide={find,prepare,parseProgrammes,norm};
})();
