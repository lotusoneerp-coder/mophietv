/* Mophie TV • Android TV — interface para controle remoto (D-pad): TV ao Vivo, Filmes, Séries, Favoritos e Continuar assistindo.
   Contrato com a camada nativa (MainActivity, inalterada): window.mophieRemoteKey(key), window.mophieBack(), window.mophieMenu(). */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const DATA=window.MOPHIE_DATA||{},CAT=window.MophieCatalog,SOURCES=window.MophieSources,EPG=window.MophieEPG,ic=window.icon;
const VERSION='1.6.5';
const BANKS={BCN1:'Rei dos Canais',BCN2:'TV a Cabo',BCN3:'IPTV-org',BCN4:'CXTV Brasil',BCNALL:'Todos os bancos'};
const BANK_IDS=['BCN1','BCN2','BCN3','BCN4','BCNALL'];
const LIVE_PAGE_SIZE=80; // Exibe 80 por vez; mantém todos os canais na memória.
const KEY='mophietv_tcl_1';
const HOLD_BACK_MS=3000;
const PROFILE_FIELDS=['vodFav','vodProg','vodWatched','vodSeriesLast','sourceProg'];
const PROVIDERS=[{name:'Pluto TV',desc:'Filmes e séries · catálogo oficial',available:true},{name:'RedeCanais',desc:'Lista de títulos · reprodução conforme disponibilidade',available:true,metadataOnly:true}];
const AVATAR_FILES=Array.from({length:107},(_,i)=>'avatars/'+(i+1)+'.png');
const store=(()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){return {}}})();
['favorites','vodFav','vodProg','vodWatched','vodSeriesLast','sourceProg'].forEach(k=>{if(!store[k]||typeof store[k]!=='object'||Array.isArray(store[k]))store[k]={}});
if(!Array.isArray(store.mophieProfiles))store.mophieProfiles=[];
if(!store.profileData||typeof store.profileData!=='object')store.profileData={};
store.uiScale=Math.max(80,Math.min(130,Math.round((Number(store.uiScale)||100)/5)*5));

function normalizeAvatar(v){
 if(typeof v==='string'&&AVATAR_FILES.includes(v))return v;
 if(typeof v==='number'&&AVATAR_FILES[v])return AVATAR_FILES[v];
 return AVATAR_FILES[0]
}
(store.mophieProfiles||[]).forEach((p,i)=>{p.avatar=normalizeAvatar(p.avatar!=null?p.avatar:i)});
function avatarIndex(v){const x=AVATAR_FILES.indexOf(normalizeAvatar(v));return x>=0?x:0}
function avatarMarkup(v,alt){const src=normalizeAvatar(v);return '<img class="avatar-photo" loading="lazy" decoding="async" src="'+esc(src)+'" alt="'+esc(alt||'Avatar')+'">'}

let currentProfileId=null;
function emptyProfileData(){return {vodFav:{},vodProg:{},vodWatched:{},vodSeriesLast:{},sourceProg:{}}}
function profileRecord(id){if(!store.profileData[id])store.profileData[id]=emptyProfileData();PROFILE_FIELDS.forEach(f=>{if(!store.profileData[id][f]||typeof store.profileData[id][f]!=='object')store.profileData[id][f]={}});return store.profileData[id]}
function selectProfile(id){const p=store.mophieProfiles.find(x=>x.id===id);if(!p)return false;currentProfileId=id;store.activeProfileId=id;const data=profileRecord(id);PROFILE_FIELDS.forEach(f=>store[f]=data[f]);persist();return true}
function addProfile(name){if(store.mophieProfiles.length>=5)return null;let id='p'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);const p={id,name:name||'',avatar:normalizeAvatar(store.mophieProfiles.length)};store.mophieProfiles.push(p);if(store.mophieProfiles.length===1&&!store.oldVodMigrated){let data=profileRecord(id);PROFILE_FIELDS.forEach(f=>{data[f]=store[f]&&typeof store[f]==='object'?JSON.parse(JSON.stringify(store[f])):{}});store.oldVodMigrated=true}return p}
function applyScale(){document.documentElement.style.setProperty('--ui-scale',(store.uiScale/100).toFixed(2))}
applyScale();
let embeddedCatalog=JSON.parse(JSON.stringify(DATA));
embeddedCatalog.BCN4=(window.MophieCXTV&&MophieCXTV.seed?MophieCXTV.seed:[]).slice();
// Substituição específica do BCN1; prevalece inclusive após atualização automática dos bancos.
const CARTOONITO_BCN1='https://canaistop1.beer/aovivo/cartoonito-ao-vivo-online-gratis-live/';
function applyChannelOverrides(){
 const list=embeddedCatalog.BCN1||[];
 let c=list.find(x=>normal(x.name)==='cartoonito');
 if(!c){c={id:'BCN1:cartoonito',bank:'BCN1',name:'Cartoonito',category:'Infantil',url:'',embed:''};list.push(c)}
 c.url='';c.embed=CARTOONITO_BCN1;c.category='Infantil';c.playerLabel='Player 1 (seleção na página)';embeddedCatalog.BCN1=list;
}

function persist(){try{localStorage.setItem(KEY,JSON.stringify(store))}catch(e){console.warn('Persistência indisponível',e)}}

/* ---------- utilitários ---------- */
function normal(s){return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function isURL(u){try{let x=new URL(u);return (x.protocol==='https:'||x.protocol==='http:')&&!!x.hostname&&!['localhost','127.0.0.1'].includes(x.hostname)}catch(e){return false}}
const ESC={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>ESC[c])}
function pad3(n){return String(n).padStart(3,'0')}
function toast(msg,icon){const t=$('toast');t.innerHTML=ic(icon||'info')+'<span>'+esc(msg)+'</span>';t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),4200)}
function fmtDur(ms){const m=Math.round((ms||0)/60000);if(!m)return '';return m>=60?Math.floor(m/60)+' h'+(m%60?' '+(m%60)+' min':''):m+' min'}
function fmtTime(s){s=Math.max(0,Math.floor(s||0));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0')}
function fmtDate(t){try{return new Date(t).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch(e){return ''}}
function joinMeta(parts){return parts.filter(Boolean).join('<span class="sep"></span>')}
function ratingBadge(r){return r?'<span class="rating r-'+esc(r)+'">'+esc(r)+'</span>':''}
function pct(p){return p&&p.d?Math.max(2,Math.min(100,Math.round(p.p/p.d*100))):0}
function img(src,alt){return src?'<img loading="lazy" decoding="async" src="'+esc(src)+'" onerror="this.remove()" alt="'+esc(alt||'')+'">':''}

/* ---------- canais (lógica preservada da v1.0.2) ---------- */
const CAT_PT={news:'Notícias',movies:'Filmes',kids:'Infantil',music:'Música',sports:'Esportes',entertainment:'Entretenimento',religious:'Religiosos',documentary:'Documentários',animation:'Animação',shop:'Compras',cooking:'Culinária',education:'Educação',lifestyle:'Estilo de vida',culture:'Cultura',general:'Geral',legislative:'Legislativo',business:'Negócios',comedy:'Comédia',series:'Séries',classic:'Clássicos',family:'Família',travel:'Viagens',outdoor:'Ar livre',auto:'Automóveis',undefined:'Outros',public:'Públicos'};
function catLabel(c){const first=String(c||'Outros').split(';')[0].trim();return CAT_PT[first.toLowerCase()]||first||'Outros'}
function allChannels(bank){let list=bank==='BCNALL'?[...(embeddedCatalog.BCN1||[]),...(embeddedCatalog.BCN2||[]),...(embeddedCatalog.BCN3||[]),...(embeddedCatalog.BCN4||[])]:[...(embeddedCatalog[bank]||[])];let by=new Map();
 for(let ch of list){if(!ch)continue;let k=normal(ch.name);if(!by.has(k)||(!(by.get(k).url||by.get(k).embed)&&(ch.url||ch.embed)))by.set(k,ch)}
 return [...by.values()].map(x=>({...x,label:catLabel(x.category),favorite:!!store.favorites[normal(x.name)]})).sort((a,b)=>normal(a.name).localeCompare(normal(b.name),'pt-BR')).map((x,i)=>({...x,number:i+1}))}
function bankCounts(){const o={};BANK_IDS.forEach(b=>o[b]=allChannels(b).length);return o}
function sourceType(c){return c.url?'Transmissão direta':c.embed?'Player externo':'Sem player disponível'}

/* ---------- estado ---------- */
const S={section:'live',sideCurrent:'live',zone:null,zones:{},contentZone:null,focusEl:null,lastZone:{},playing:null,ctx:null,hls:null,
 volume:Math.max(0,Math.min(100,Number(store.volume??65))),playerTimer:null,lastSave:0,drawer:{open:false,idx:0,items:[]},menuOverlay:false,overlayReturnPending:false,flixError:'',detail:null,numBuf:'',numTimer:null,refreshRunning:false};
const L={bank:BANKS[store.lastBank]?store.lastBank:'BCN1',channels:[],list:[],cats:[],filter:'all',idx:0,counts:{}};
const V={movie:{cat:1,grid:0,q:'',kb:0,res:0},series:{cat:1,grid:0,q:'',kb:0,res:0},error:'',timer:null};
const F={tab:0,idx:[0,0,0]};
const ST={idx:0,confirmAt:0};
const FL={profileIdx:0,providerIdx:0,provider:'Pluto TV',homeRow:0,homeIndexes:{},editId:null,editName:'',editIdx:0,avatarDraft:null,editorForId:null,avatarIdx:0};
const SRC={error:'',rows:[],row:0,listKind:'all',listPage:0,indices:{},item:null,playerError:'',choiceResult:null,choiceError:'',choiceLoading:false,choiceItems:[],choiceIdx:0,choiceItem:null,choiceOrigin:null};
const DIAG={open:false,idx:0};
let srcFrameTimer=null;
const GUIDE={open:false,idx:0,items:[],channel:null,description:false,data:null,loading:false};

/* ---------- foco por zonas ----------
   Zona = lista (cols 1), linha (cols 'row') ou grade (cols N). Nas bordas, a seta leva à zona vizinha. */
function len(z){return z&&z.items?z.items().length:0}
function zone(){return S.zones[S.zone]}
function activate(id,idx){const z=S.zones[id];if(!z||(!len(z)))return false;
 if(z.enter)z.enter();if(idx!=null)z.idx=idx;z.idx=Math.max(0,Math.min(len(z)-1,z.idx||0));
 S.zone=id;if(id!=='side'){S.contentZone=id;S.lastZone[S.section]=id}
 document.body.classList.toggle('side-open',id==='side');
 setHints(z.hints||HINTS[S.section]||[]);applyFocus();return true}
function applyFocus(){if(S.focusEl)S.focusEl.classList.remove('focused');const z=zone();if(!z)return;const el=z.items()[z.idx];S.focusEl=el||null;
 if(el){el.classList.add('focused');if(z.scroll)ensureVisible(el,z.scroll(),z.cols==='row')}
 if(z.change)z.change(z.idx,el)}
function ensureVisible(el,box,horizontal){if(!el||!box)return;const r=el.getBoundingClientRect(),b=box.getBoundingClientRect();
 if(horizontal){const m=Math.min(b.width*.12,r.width);if(r.left<b.left+m)box.scrollLeft-=b.left+m-r.left;else if(r.right>b.right-m)box.scrollLeft+=r.right-(b.right-m);return}
 const m=Math.min(b.height*.16,r.height*.7);if(r.top<b.top+m)box.scrollTop-=b.top+m-r.top;else if(r.bottom>b.bottom-m)box.scrollTop+=r.bottom-(b.bottom-m)}
function move(dir){const z=zone();if(!z)return;const n=len(z);let i=z.idx,t;
 const r=z.nav?z.nav(dir,i):undefined;if(r===true)return;
 if(typeof r==='number')i=r;else if(typeof r==='string')t=r;else{const cols=z.cols==='row'?n:z.cols;
  if(dir==='left'){if(cols===1||i%cols===0)t=z.left;else i--}
  else if(dir==='right'){if(cols===1||i%cols===cols-1||i===n-1)t=z.right;else i++}
  else if(dir==='up'){if(z.cols==='row'||i<cols)t=z.up;else i-=cols}
  else if(dir==='down'){if(z.cols==='row')t=z.down;else if(i+cols<n)i+=cols;else if(Math.floor(i/cols)<Math.floor((n-1)/cols))i=n-1;else t=z.down}}
 if(t){if(typeof t==='function')t=t();if(t)activate(t);return}
 if(i!==z.idx&&i>=0&&i<n){z.idx=i;applyFocus()}}
/* Navegação em grades reais de canais (linha a linha), sem inverter os eixos.
   A quantidade de colunas é lida do CSS calculado, inclusive em viewports pequenos. */
function channelGridColumns(gridId){
 const box=$(gridId);
 if(!box)return 2;
 const template=getComputedStyle(box).gridTemplateColumns;
 const parts=template.trim().split(/\s+/).filter(Boolean);
 return Math.max(1,parts.length||2);
}
function channelGridNav(dir,i,count,gridId,topZone){
 if(!count)return true;
 const cols=channelGridColumns(gridId),col=i%cols;
 if(dir==='left')return col===0?'side':i-1;
 if(dir==='right')return col<cols-1&&i+1<count?i+1:i;
 if(dir==='up')return i<cols?topZone:i-cols;
 if(dir==='down'){
  if(i+cols<count)return i+cols;
  // Na última linha incompleta, não salta para outra coluna do mesmo nível.
  return i;
 }
 return true;
}
function ok(){const z=zone();if(z&&z.ok)z.ok(z.idx,S.focusEl)}
function markSelected(boxId,i){const box=$(boxId);if(!box)return;[...box.children].forEach((e,j)=>e.classList.toggle('selected',j===i))}
function setHints(list){$('hints').innerHTML=list.map(([k,l])=>'<span class="hint"><span class="key">'+esc(k)+'</span>'+esc(l)+'</span>').join('')}
function setTitle(t,sub){$('pageTitle').textContent=t;$('pageSub').textContent=sub||''}

/* ---------- navegação principal ---------- */
const SECTIONS={live:{title:'TV ao Vivo',icon:'tv'},mophieflix:{title:'MophieFlix',icon:'clapper'},movies:{title:'Filmes',icon:'film'},series:{title:'Séries',icon:'clapper'},favorites:{title:'Favoritos',icon:'heart'},continue:{title:'Continuar assistindo',icon:'history'},settings:{title:'Configurações',icon:'settings',bottom:true}};
const SIDE=['live','mophieflix','favorites','continue','settings'];
const RENDER={live:renderLive,mophieflix:renderProfiles,profileEdit:renderProfileEdit,avatarPicker:renderAvatarPicker,providers:renderProviders,flixhome:renderFlixHome,providerUnavailable:renderProviderUnavailable,sourceCatalog:renderSourceCatalog,sourceSearch:renderSourceSearch,sourceDetails:renderSourceDetails,sourceChoices:renderSourceChoices,movies:()=>renderCatalog('movie'),series:()=>renderCatalog('series'),favorites:renderFavorites,continue:renderContinue,settings:renderSettings,about:renderAbout,details:renderDetails};
const HINTS={mophieflix:[['OK','Selecionar perfil'],['VOLTAR segurar 3 s','Opções']],providers:[['OK','Selecionar catálogo'],['VOLTAR','Perfis']],flixhome:[['OK','Abrir título'],['VOLTAR','Provedores'],['← →','Navegar']],profileEdit:[['OK','Digitar / selecionar'],['↓','Foto e salvar'],['VOLTAR','Perfis']],avatarPicker:[['← → ↑ ↓','Escolher foto'],['OK','Confirmar foto'],['VOLTAR','Editar nome']],providerUnavailable:[['VOLTAR','Provedores']],sourceCatalog:[['OK','Informações'],['← →','Navegar'],['VOLTAR','Provedores']],sourceSearch:[['OK','Digitar / abrir'],['VOLTAR','Catálogo']],sourceDetails:[['OK','Selecionar opção'],['VOLTAR','Catálogo']],sourceChoices:[['↑ ↓','Escolher opção'],['OK','Abrir'],['VOLTAR','Detalhes']],live:[['OK','Assistir'],['VOLTAR','Bancos'],['VOLTAR segurar 3 s','Opções e favoritos']],movies:[['OK','Detalhes'],['VOLTAR','Categorias'],['VOLTAR segurar 3 s','Opções']],series:[['OK','Detalhes'],['VOLTAR','Categorias'],['VOLTAR segurar 3 s','Opções']],favorites:[['OK','Abrir'],['VOLTAR segurar 3 s','Opções']],continue:[['OK','Continuar'],['VOLTAR segurar 3 s','Opções']],settings:[['OK','Selecionar'],['← →','Ajustar volume'],['VOLTAR segurar 3 s','Opções']],about:[['VOLTAR','Configurações']],details:[['OK','Selecionar'],['VOLTAR','Voltar'],['VOLTAR segurar 3 s','Opções']]};
function buildSide(){const box=$('sideItems');
 box.innerHTML=SIDE.map(id=>'<div class="side-item'+(SECTIONS[id].bottom?' bottom':'')+'">'+ic(SECTIONS[id].icon)+'<span>'+esc(SECTIONS[id].title)+'</span></div>').join('');
 S.zones.side={items:()=>box.children,cols:1,idx:0,enter(){this.idx=Math.max(0,SIDE.indexOf(S.sideCurrent))},right:()=>S.contentZone&&len(S.zones[S.contentZone])?S.contentZone:null,ok:i=>go(SIDE[i]),hints:[['OK','Abrir'],['→','Conteúdo'],['VOLTAR segurar 3 s','Opções']]}}
function markSide(){[...$('sideItems').children].forEach((e,i)=>e.classList.toggle('current',SIDE[i]===S.sideCurrent))}
function go(section,want){if(S.focusEl)S.focusEl.classList.remove('focused');S.section=section;S.zones={side:S.zones.side};S.focusEl=null;if(SIDE.indexOf(section)>=0)S.sideCurrent=section;markSide();
 const v=$('view');v.classList.remove('anim');void v.offsetWidth;v.classList.add('anim');
 const def=RENDER[section]();let target=null;
 for(const id of [want,S.lastZone[section],def].concat(Object.keys(S.zones)))if(id&&id!=='side'&&len(S.zones[id])){target=id;break}
 S.contentZone=target;if(want==='side'||!target)activate('side');else activate(target)}

/* ---------- MophieFlix: perfis locais e provedores ---------- */
function renderProfiles(){S.sideCurrent='mophieflix';markSide();setTitle('MophieFlix','Quem está assistindo? · Até cinco perfis locais');
 const profiles=store.mophieProfiles;const create=profiles.length<5;
 $('view').innerHTML='<div class="flix-welcome"><h2>Quem está assistindo?</h2><div class="profile-grid" id="profileGrid">'+profiles.map(p=>'<div class="profile-card"><div class="profile-avatar">'+avatarMarkup(p.avatar,p.name)+'</div><b>'+esc(p.name)+'</b><small>Entrar</small></div>').join('')+(create?'<div class="profile-card add-profile"><div class="profile-avatar">'+ic('plus')+'</div><b>Adicionar perfil</b><small>Até 5 perfis</small></div>':'')+'</div><p class="flix-note">Cada perfil tem sua própria Minha Lista e Continue de onde parou.</p><div class="profile-actions" id="profileActions"><div class="btn">'+ic('settings')+'Gerenciar perfis</div></div></div>';
 S.zones.profiles={items:()=>$('profileGrid').children,cols:Math.max(1,Math.min(5,profiles.length+(create?1:0))),idx:FL.profileIdx,left:'side',down:'profileActions',hints:[['OK','Entrar'],['↓','Gerenciar'],['VOLTAR segurar 3 s','Opções']],change:i=>{FL.profileIdx=i},ok:i=>{if(i>=profiles.length){const p=addProfile();if(p){selectProfile(p.id);FL.editId=p.id;FL.editName=p.name;go('profileEdit')}return}selectProfile(profiles[i].id);go('providers')}};
 S.zones.profileActions={items:()=>$('profileActions').children,cols:'row',up:'profiles',left:'side',ok:()=>{if(profiles.length){FL.editId=profiles[Math.min(FL.profileIdx,profiles.length-1)].id;FL.editName=profiles.find(p=>p.id===FL.editId).name;go('profileEdit')}else toast('Crie um perfil primeiro','info')}};
 return 'profiles'}
const NAME_KEYS='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
function clearProfileDraft(){FL.editName='';FL.editId=null;FL.avatarDraft=null;FL.editorForId=null;FL.avatarIdx=0;FL.editIdx=0}
function cancelProfileEdit(){const p=store.mophieProfiles.find(x=>x.id===FL.editId);if(p&&!p.name){store.mophieProfiles=store.mophieProfiles.filter(x=>x.id!==p.id);delete store.profileData[p.id];if(currentProfileId===p.id){currentProfileId=null;store.activeProfileId=null}persist()}clearProfileDraft();go('mophieflix')}
function renderProfileEdit(){
 const p=store.mophieProfiles.find(x=>x.id===(FL.editId||currentProfileId));
 if(!p){cancelProfileEdit();return null}
 FL.editId=p.id;
 if(FL.editorForId!==p.id){FL.editorForId=p.id;FL.editName=p.name;FL.avatarDraft=normalizeAvatar(p.avatar);FL.avatarIdx=avatarIndex(p.avatar);FL.editIdx=0}
 setTitle(p.name?'Editar perfil':'Criar perfil','Digite o nome e escolha uma foto');
 $('view').innerHTML='<div class="profile-name-editor" id="profileNameScroll">'+
 '<div class="profile-edit-heading"><h2>Como vamos chamar você?</h2><p>Digite o nome usando o controle TCL. Depois escolha sua foto.</p></div>'+
 '<div class="profile-edit-preview"><div class="profile-preview-photo" id="editPreviewPhoto" role="button" aria-label="Escolher foto do perfil">'+avatarMarkup(FL.avatarDraft,FL.editName)+'<span class="profile-photo-overlay">'+ic('image')+' Escolher foto</span></div><div class="profile-preview-copy"><div class="profile-preview-label">NOME DO PERFIL</div><h3 id="editTitle">'+esc(FL.editName||'Digite o nome')+'</h3><span>Selecione a foto acima ou o botão ESCOLHER FOTO</span></div></div>'+
 '<div class="profile-keyboard" id="nameKeys">'+NAME_KEYS.map(k=>'<div class="kb-key">'+k+'</div>').join('')+'<div class="kb-key">Espaço</div><div class="kb-key">Apagar</div></div>'+
 '<div class="profile-editor-actions" id="editActions"><div class="btn">'+ic('image')+'Escolher foto de perfil</div><div class="btn">'+ic('check')+'Salvar perfil</div><div class="btn profile-delete">'+ic('x')+'Excluir perfil</div></div>'+
 '</div>';
 const redraw=()=>{$('editTitle').textContent=FL.editName||'Digite o nome'};
  $('editPreviewPhoto').addEventListener('click',()=>{FL.avatarIdx=avatarIndex(FL.avatarDraft);go('avatarPicker')});
 S.zones.editKeys={items:()=>$('nameKeys').children,cols:6,idx:FL.editIdx,scroll:()=>$('profileNameScroll'),down:'editActions',back:cancelProfileEdit,left:'side',change:i=>{FL.editIdx=i},ok:i=>{
  if(i<NAME_KEYS.length){if(FL.editName.length<18)FL.editName+=NAME_KEYS[i]}
  else if(i===36){if(FL.editName.length<18)FL.editName+=' '}
  else FL.editName=FL.editName.slice(0,-1);
  redraw()}};
 S.zones.editActions={items:()=>$('editActions').children,cols:'row',idx:0,scroll:()=>$('profileNameScroll'),up:'editKeys',back:cancelProfileEdit,left:'side',ok:i=>{
  if(i===0){FL.avatarIdx=avatarIndex(FL.avatarDraft);go('avatarPicker');return}
  if(i===1){if(!FL.editName.trim()){toast('Digite o nome do perfil para continuar','alert');activate('editKeys');return}p.name=FL.editName.trim().slice(0,18);p.avatar=normalizeAvatar(FL.avatarDraft);selectProfile(p.id);clearProfileDraft();persist();go('providers');return}
  if(Date.now()-(ST.profileConfirmAt||0)>3500){ST.profileConfirmAt=Date.now();toast('Pressione OK novamente para excluir o perfil','alert');return}
  if(store.mophieProfiles.length===1){toast('Crie outro perfil antes de excluir este','alert');return}
  store.mophieProfiles=store.mophieProfiles.filter(x=>x.id!==p.id);delete store.profileData[p.id];
  if(currentProfileId===p.id){currentProfileId=null;store.activeProfileId=null}
  clearProfileDraft();persist();go('mophieflix')
 }};
 return 'editKeys'
}
function renderAvatarPicker(){
 const p=store.mophieProfiles.find(x=>x.id===FL.editId);
 if(!p){go('mophieflix');return null}
 setTitle('Escolher foto de perfil','107 fotos · selecione com OK para voltar à edição');
 const selected=normalizeAvatar(FL.avatarDraft);
 $('view').innerHTML='<div class="profile-photo-picker">'+
 '<div class="avatar-picker-heading"><div><h2>Escolha sua foto</h2><p>Use as setas e aperte OK para confirmar.</p></div><span id="avatarCounter">Foto '+(Math.max(0,FL.avatarIdx)+1)+' de '+AVATAR_FILES.length+'</span></div>'+
 '<div class="avatar-gallery-scroll" id="avatarGalleryScroll"><div class="avatar-gallery" id="avatarChoice">'+
 AVATAR_FILES.map((src,i)=>'<div class="avatar-option'+(src===selected?' selected':'')+'">'+avatarMarkup(src,'Foto '+(i+1))+'</div>').join('')+
 '</div></div><div class="avatar-picker-actions" id="avatarPickerActions"><div class="btn">'+ic('chevronLeft')+'Voltar sem alterar</div></div></div>';
 const cols=7;
 S.zones.avatars={items:()=>$('avatarChoice').children,cols,idx:FL.avatarIdx,scroll:()=>$('avatarGalleryScroll'),down:'avatarPickerActions',back:()=>go('profileEdit','editActions'),left:'side',change:i=>{FL.avatarIdx=i;$('avatarCounter').textContent='Foto '+(i+1)+' de '+AVATAR_FILES.length},ok:i=>{
  FL.avatarDraft=AVATAR_FILES[i]||AVATAR_FILES[0];FL.avatarIdx=i;go('profileEdit','editActions');toast('Foto selecionada. Salve o perfil para confirmar.','check')
 }};
 S.zones.avatarPickerActions={items:()=>$('avatarPickerActions').children,cols:'row',idx:0,up:'avatars',back:()=>go('profileEdit','editActions'),ok:()=>go('profileEdit','editActions')};
 return 'avatars'
}
function renderProviders(){if(!currentProfileId){go('mophieflix');return null}const p=store.mophieProfiles.find(x=>x.id===currentProfileId);setTitle('MophieFlix','Perfil: '+(p?p.name:'')+' · Escolha um catálogo');
 $('view').innerHTML='<div class="provider-page"><div class="flix-subtitle">Escolha onde assistir</div><div class="provider-grid" id="providerGrid">'+PROVIDERS.map(x=>'<div class="provider-card"><div class="provider-symbol">'+ic(x.available?'play':'film')+'</div><b>'+esc(x.name)+'</b><small>'+esc(x.desc)+'</small>'+(x.metadataOnly?'<span class="provider-status">Catálogo público · site externo</span>':x.available?'<span class="provider-status">Catálogo integrado</span>':'<span class="provider-status pending">Indisponível</span>')+'</div>').join('')+'</div><div class="actions" id="providerActions"><div class="btn">'+ic('users')+'Trocar perfil</div></div></div>';
 S.zones.providers={items:()=>$('providerGrid').children,cols:3,idx:FL.providerIdx,left:'side',down:'providerActions',back:()=>go('mophieflix'),change:i=>{FL.providerIdx=i},ok:i=>{const p=PROVIDERS[i];FL.provider=p.name;go(p.metadataOnly?'sourceCatalog':p.available?'flixhome':'providerUnavailable')}};
 S.zones.providerActions={items:()=>$('providerActions').children,cols:'row',up:'providers',left:'side',back:()=>go('mophieflix'),ok:()=>go('mophieflix')};return 'providers'}
/* Catálogos públicos: prévia de metadados. Não direcionar para sites externos nem fingir reprodução integrada. */
function renderSourceCatalog(){if(!currentProfileId){go('mophieflix');return null}
 const name=FL.provider;setTitle('MophieFlix',name+' · filmes e séries · catálogo de consulta');
 const data=SOURCES&&SOURCES.get(name);
 if(!data){$('view').innerHTML='<div class="empty">'+ic('refresh')+'Consultando títulos públicos de '+esc(name)+'…<p>O carregamento depende da disponibilidade e das permissões do site. Não há redirecionamento externo.</p></div>';
  if(!SRC.loading){SRC.loading=name;SOURCES.load(name).then(()=>{SRC.error='';if(S.section==='sourceCatalog'&&FL.provider===name)go('sourceCatalog')}).catch(e=>{SRC.error=e.message||'Falha ao consultar o site';if(S.section==='sourceCatalog'&&FL.provider===name)go('sourceCatalog')}).finally(()=>{SRC.loading=null})}
  if(SRC.error){$('view').innerHTML='<div class="empty">'+ic('wifiOff')+'Não foi possível consultar '+esc(name)+'<p>'+esc(SRC.error)+' — algumas fontes não permitem acesso pela WebView.</p><div class="actions" id="srcErrActions"><div class="btn">'+ic('refresh')+'Tentar novamente</div><div class="btn">'+ic('chevronRight')+'Voltar</div></div></div>';
   S.zones.srcErr={items:()=>$('srcErrActions').children,cols:'row',idx:0,ok:i=>{if(i){SRC.error='';go('providers')}else{SRC.error='';SRC.loading=null;SOURCES.load(name,true).then(()=>{if(S.section==='sourceCatalog')go('sourceCatalog')}).catch(e=>{SRC.error=e.message;go('sourceCatalog')})}},back:()=>go('providers')};return 'srcErr'}return null}
 if(name==='RedeCanais')return renderRedeList(data);
 const items=data.items||[];
 // Um título por fileira: destaques não são duplicados em Filmes/Séries/Animes.
 const unique=new Map();for(const it of items){const id=(it.url||'').toLowerCase()||normal(it.name)+'|'+it.type;if(!unique.has(id))unique.set(id,it)}
 const distinct=[...unique.values()].filter(x=>!(name==='MegaFilmes'&&x.type==='anime'));const highlighted=distinct.filter(x=>!!x.poster).slice(0,Math.min(18,Math.ceil(distinct.length*.18)));
 const shown=new Set(highlighted.map(x=>(x.url||'').toLowerCase()||normal(x.name)+'|'+x.type));
 const rails=[{name:'Em destaque',items:highlighted}];
 const recently=Object.values(store.sourceProg||{}).filter(x=>x.provider===name&&x.item).sort((a,b)=>b.t-a.t);
 const resumable=recently.filter(x=>x.kind==='video'&&x.p>0).map(x=>x.item);
 const visited=recently.filter(x=>x.kind!=='video'||!x.p).map(x=>x.item);
 if(resumable.length)rails.unshift({name:'Continue de onde parou',items:resumable.slice(0,30)});
 if(visited.length)rails.push({name:'Visitados recentemente',items:visited.slice(0,30)});
 for(const [kind,label] of [['movie','Filmes'],['series','Séries'],...((name==='MegaFilmes')?[]:[['anime','Animes']])]){
  const list=distinct.filter(x=>x.type===kind);
  for(let start=0;start<list.length;start+=42){
   const part=list.slice(start,start+42);if(part.length)rails.push({name:start?label+' · Mais títulos '+(Math.floor(start/42)+1):label,items:part});
  }
 }
 const byYear=distinct.filter(x=>/^(?:19|20)\d\d$/.test(x.year||''));
 const years=[...new Set(byYear.map(x=>x.year))].sort((a,b)=>b.localeCompare(a));
 for(const y of years.slice(0,6)){const list=byYear.filter(x=>x.year===y);if(list.length>=3)rails.push({name:'De '+y,items:list.slice(0,42)})}
 // Categorias adicionais baseadas SOMENTE nos metadados recuperados; um filme pode aparecer em vários gêneros.
 const genreWords=[['Ação',/\ba[cç][aã]o\b/i],['Comédia',/com[eé]dia/i],['Drama',/\bdrama\b/i],['Terror',/terror|horror/i],['Suspense',/suspense|thriller/i],['Romance',/romance/i],['Documentários',/document[aá]rio/i],['Aventura',/aventura/i],['Ficção científica',/fic[cç][aã]o cient[ií]fica|sci.fi/i],['Doramas',/doramas?/i],['Desenhos',/desenhos?/i],['Novelas',/novelas?/i]];
 for(const [label,pattern] of genreWords){const filtered=distinct.filter(x=>pattern.test(x.genre||'')&&x.poster).slice(0,32);if(filtered.length>=3)rails.push({name:label,items:filtered})}
 SRC.rows=rails.filter(r=>r.items.length);
 $('view').innerHTML='<div class="flix-home src-home" id="srcScroll"><div class="flix-hero"><div class="flix-hero-title">'+esc(name)+'</div><p>Explore os títulos publicados na fonte selecionada.</p><div class="flix-hero-source">CATÁLOGO PÚBLICO · REPRODUÇÃO SOB DISPONIBILIDADE</div></div><div class="flix-topactions" id="srcActions"><div class="btn">'+ic('search')+'Buscar títulos</div><div class="btn">'+ic('refresh')+'Atualizar</div><div class="btn">'+ic('users')+'Trocar fonte</div>'+(name==='RedeCanais'?'<div class="btn">'+ic('plus')+'Carregar mais títulos</div>':'')+'</div>'+ 
 (data.stale?'<p class="src-note">Exibindo últimos títulos salvos: a fonte não respondeu agora.</p>':'')+
 '<p class="src-note">'+distinct.length+' títulos carregados de '+(data.pages||1)+' página(s) consultada(s). Isto NÃO representa o total do site. Capas dependem do acesso à fonte. A reprodução depende das permissões do provedor.</p>'+ 
 SRC.rows.map((r,i)=>'<section class="flix-rail"><h2>'+esc(r.name)+'</h2><div class="flix-rail-scroll" id="sourceScroll'+i+'"><div class="flix-rail-items" id="sourceRail'+i+'">'+r.items.map(it=>'<div class="poster"><div class="art"><div class="ph">'+esc(it.name)+'</div>'+img(it.poster,it.name)+'</div><div class="cap">'+esc(it.name)+'</div></div>').join('')+'</div></div></section>').join('')+
 '<div class="flix-footer">'+esc(name)+' · catálogo público</div></div>';
 S.zones.srcActions={items:()=>$('srcActions').children,cols:'row',idx:0,down:SRC.rows.length?'source0':null,left:'side',back:()=>go('providers'),ok:i=>{if(i===0){SRC.search='';SRC.searchIdx=0;SRC.searchResultIdx=0;go('sourceSearch');return}if(i===2){go('providers');return}if(i===3&&name==='RedeCanais'){toast('Consultando mais páginas públicas…','info');SOURCES.loadMore(name).then(r=>{toast(r.added+' títulos novos encontrados','check');if(S.section==='sourceCatalog')go('sourceCatalog')}).catch(e=>toast('Fonte indisponível: '+e.message,'alert'));return}SOURCES.load(name,true).then(()=>{if(S.section==='sourceCatalog')go('sourceCatalog')}).catch(e=>{SRC.error=e.message;toast('Não foi possível atualizar: '+e.message,'alert')})}};
 SRC.rows.forEach((r,i)=>{S.zones['source'+i]={items:()=>$('sourceRail'+i).children,cols:'row',idx:Math.min(SRC.indices[name+'_'+i]||0,r.items.length-1),scroll:()=>$('sourceScroll'+i),up:i?'source'+(i-1):'srcActions',down:i<SRC.rows.length-1?'source'+(i+1):null,left:'side',back:()=>go('providers'),change:j=>{SRC.row=i;SRC.indices[name+'_'+i]=j;ensureVisible($('sourceRail'+i),$('srcScroll'),false)},ok:j=>{SRC.item=r.items[j];SRC.playerError='';go('sourceDetails')},hints:[['OK','Informações'],['← →','Títulos'],['↑ ↓','Categorias'],['VOLTAR','Provedores']]}});
 return SRC.rows.length?'source'+Math.min(SRC.row,SRC.rows.length-1):'srcActions'}

/* RedeCanais: lista paginada com todos os metadados no cache. */
function renderRedeList(data){
 const all=data.items||[],kind=SRC.listKind||'all',filtered=kind==='all'?all:all.filter(x=>x.type===kind);
 const size=64,pages=Math.max(1,Math.ceil(filtered.length/size));
 SRC.listPage=Math.max(0,Math.min(SRC.listPage||0,pages-1));
 const start=SRC.listPage*size,shown=filtered.slice(start,start+size);
 const tabs=[['all','Todos'],['movie','Filmes'],['series','Séries'],['anime','Animes']];
 setTitle('RedeCanais','Lista de títulos · '+all.length.toLocaleString('pt-BR')+' registrados · sem capas');
 $('view').innerHTML='<div class="source-list-layout">'+
 '<div class="source-list-heading"><h2>RedeCanais</h2><p>Todos os títulos no catálogo local; vídeo somente ao abrir</p></div>'+
 '<div class="source-list-toolbar" id="srcActions"><div class="btn">'+ic('search')+'Buscar</div>'+
 tabs.map(([k,v])=>'<div class="btn'+(kind===k?' chosen':'')+'">'+esc(v)+'</div>').join('')+
 '<div class="btn">'+ic('refresh')+'Sincronizar</div><div class="btn">'+ic('users')+'Fontes</div></div>'+
 '<div class="source-list-summary">'+filtered.length.toLocaleString('pt-BR')+' títulos · '+(data.pages||0)+' páginas consultadas'+((data.states||[]).some(x=>x.next)?' · atualização em segundo plano':'')+'</div>'+
 '<div class="source-title-scroll" id="sourceScroll0"><div class="source-title-list" id="sourceRail0">'+
 shown.map((it,i)=>'<div class="source-title-row"><span class="source-title-index">'+String(start+i+1).padStart(3,'0')+'</span><span class="source-title-name">'+esc(it.name)+'</span><span class="source-title-chevron">›</span></div>').join('')+
 '</div></div><div class="source-list-pager" id="sourcePages"><div class="btn">'+ic('chevronLeft')+'Anterior</div><div class="btn">Página '+(SRC.listPage+1)+' / '+pages+'</div><div class="btn">Próxima'+ic('chevronRight')+'</div></div>'+
 ((data.errors||[]).length?'<p class="src-note source-error">A coleta sofreu restrições; títulos salvos seguem disponíveis.</p>':'')+'</div>';
 S.zones.srcActions={items:()=>$('srcActions').children,cols:'row',idx:0,down:shown.length?'source0':'sourcePages',left:'side',back:()=>go('providers'),ok:i=>{
  if(i===0){SRC.search='';SRC.searchIdx=0;SRC.searchResultIdx=0;go('sourceSearch');return}
  if(i>=1&&i<=4){SRC.listKind=tabs[i-1][0];SRC.listPage=0;go('sourceCatalog','srcActions');return}
  if(i===5){toast('Sincronizando catálogo público','info');SOURCES.syncAll('RedeCanais').then(()=>{if(S.section==='sourceCatalog')go('sourceCatalog','srcActions')}).catch(e=>toast('Falha de sincronização: '+e.message,'alert'));return}
  go('providers');}};
 S.zones.source0={items:()=>$('sourceRail0').children,cols:2,idx:0,scroll:()=>$('sourceScroll0'),up:'srcActions',down:'sourcePages',left:'side',back:()=>go('providers'),ok:i=>{SRC.item=shown[i];SRC.playerError='';go('sourceDetails')}};
 S.zones.sourcePages={items:()=>$('sourcePages').children,cols:'row',idx:2,up:shown.length?'source0':'srcActions',left:'side',back:()=>go('providers'),ok:i=>{
  if(i===0&&SRC.listPage>0)SRC.listPage--;else if(i===2&&SRC.listPage<pages-1)SRC.listPage++;else return;go('sourceCatalog','source0')}};
 return shown.length?'source0':'srcActions';
}

/* Busca local por título, pelo teclado virtual do controle remoto. */
function renderSourceSearch(){const data=SOURCES&&SOURCES.get(FL.provider);
 if(!data){go('sourceCatalog');return null}
 setTitle('Buscar em '+FL.provider,'Busque pelo nome · apenas títulos já carregados');
 const q=normal(SRC.search);const matches=(data.items||[]).filter(it=>!q||normal(it.name).includes(q)).slice(0,120);
 const letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('').concat(['Espaço','Apagar']);
 $('view').innerHTML='<div class="source-search-layout"><div class="source-search-side"><h2>Buscar títulos</h2><div class="source-search-query">'+esc(SRC.search||'Digite usando o controle')+'</div><div class="source-search-keys" id="srcSearchKeys">'+letters.map(k=>'<div class="kb-key">'+k+'</div>').join('')+'</div><p class="src-note">OK seleciona a letra. ↓ abre os resultados.</p></div><div class="source-search-results" id="srcSearchResults"><h2>'+matches.length+' resultado(s)</h2><div class="source-search-grid source-results-list" id="srcResultGrid">'+matches.map(it=>'<div class="source-title-row"><span class="source-title-name">'+esc(it.name)+'</span><span class="source-title-chevron">›</span></div>').join('')+'</div></div></div>';
 S.zones.srcSearchKeys={items:()=>$('srcSearchKeys').children,cols:6,idx:Math.min(SRC.searchIdx,letters.length-1),down:matches.length?'srcSearchResults':null,left:'side',back:()=>go('sourceCatalog'),change:i=>{SRC.searchIdx=i},ok:i=>{if(i<36){SRC.search+=letters[i]}else if(i===36){SRC.search+=' '}else SRC.search=SRC.search.slice(0,-1);SRC.searchResultIdx=0;go('sourceSearch','srcSearchKeys')}};
 S.zones.srcSearchResults={items:()=>$('srcResultGrid').children,cols:2,idx:Math.min(SRC.searchResultIdx,Math.max(0,matches.length-1)),up:'srcSearchKeys',left:'srcSearchKeys',scroll:()=>$('srcSearchResults'),back:()=>go('sourceCatalog'),change:i=>{SRC.searchResultIdx=i},ok:i=>{SRC.item=matches[i];SRC.playerError='';go('sourceDetails')}};
 return matches.length&&SRC.searchResultIdx?'srcSearchResults':'srcSearchKeys'}


/* Diagnóstico Mophie: códigos curtos facilitam localizar a falha na TCL. */
function reportSource(code,detail,uri){
 const item=(S.playing&&S.playing.kind==='sourceVod'?S.playing.meta:SRC.item)||{};
 const x=window.MophieDiagnostics&&MophieDiagnostics.add(code,FL.provider,item.name,detail,uri||item.url);
 if($('playerDiagBadge')&&!$('player').hidden){$('playerDiagBadge').hidden=false;$('playerDiagBadge').textContent=(x?x.code:code)+' · OK: opções'}
 return x?x.code:code;
}
function beginSourceChoices(it,following){
 if(!following){SRC.choiceVisited=new Set();SRC.choiceDepth=0}
 const here=String(it&&it.url||'');
 if(SRC.choiceVisited.has(here)||SRC.choiceDepth>=6){const code=reportSource('M115','Loop entre páginas de opções bloqueado',here);SRC.choiceError=code+' · Esta opção voltou a uma página já visitada; tente outro servidor';SRC.choiceLoading=false;SRC.choiceItems=[];go('sourceChoices');return}
 SRC.choiceVisited.add(here);SRC.choiceDepth++;
 SRC.choiceItem=it;SRC.choiceOrigin=SRC.choiceOrigin||SRC.item||it;SRC.choiceLoading=true;SRC.choiceResult=null;SRC.choiceError='';SRC.choiceItems=[];SRC.choiceIdx=0;
 go('sourceChoices');
 if(!window.MophieSourcePlayer){SRC.choiceLoading=false;SRC.choiceError='M104 · Leitor de player ausente';go('sourceChoices');return}
 MophieSourcePlayer.inspect(it,FL.provider).then(data=>{
  if(SRC.choiceItem!==it)return;
  SRC.choiceLoading=false;SRC.choiceResult=data;
  const choices=(data.options||[]).slice();
  if(data.primary&&!choices.some(c=>c.url===data.primary.url))choices.unshift({kind:data.primary.kind,url:data.primary.url,label:'Reproduzir no player identificado'});
  SRC.choiceItems=choices;
  if(choices.length>1||choices.some(x=>x.kind==='page'))reportSource('M107','Seleção de episódio, áudio ou player publicada no site',data.page);
  if(!choices.length){const code=reportSource('M104','Nenhum player ou episódio utilizável foi identificado',data.page);SRC.choiceError=code+' · Nenhuma opção publicada na página'}
  if(S.section==='sourceChoices')go('sourceChoices',choices.length?'choiceList':'choiceBack');
 }).catch(e=>{
  if(SRC.choiceItem!==it)return;SRC.choiceLoading=false;
  const code=reportSource(e.code||'M104',e.message||'Falha ao consultar título',it.url);
  SRC.choiceError=code+' · '+String(e.message||'Reprodução indisponível');
  if(S.section==='sourceChoices')go('sourceChoices');
 });
}
function renderSourceChoices(){
 const item=SRC.choiceItem||SRC.item;if(!item){go('sourceDetails');return null}
 setTitle('Episódios, áudio e players',FL.provider+' · '+item.name);
 const choices=SRC.choiceItems||[];
 const info=SRC.choiceLoading?'Buscando opções publicadas na página…':SRC.choiceError||'Selecione o episódio, idioma ou servidor usando as setas e OK.';
 $('view').innerHTML='<div class="source-choice-page"><div class="source-choice-head"><h2>'+esc(item.name)+'</h2><p>'+esc(info)+'</p></div>'+
 '<div class="source-choice-scroll" id="srcChoiceScroll"><div class="source-choice-items" id="srcChoiceList">'+
 choices.map((c,i)=>'<div class="source-choice-entry"><span class="source-choice-num">'+String(i+1).padStart(2,'0')+'</span><div><b>'+esc(c.label||'Opção '+(i+1))+'</b><small>'+esc(c.kind==='page'?'Abrir página de episódio/opções':c.kind==='video'?'Vídeo direto':'Player incorporado')+'</small></div></div>').join('')+
 '</div></div><div id="srcChoiceBack" class="actions"><div class="btn">'+ic('chevronLeft')+'Voltar aos detalhes</div></div>'+
 '<p class="src-note">A Mophie TV exibe apenas opções com endereço publicado. Botões controlados exclusivamente pelo site podem não funcionar por limitações de origem.</p></div>';
 if(choices.length)S.zones.choiceList={items:()=>$('srcChoiceList').children,cols:1,idx:Math.min(SRC.choiceIdx,choices.length-1),scroll:()=>$('srcChoiceScroll'),down:'choiceBack',left:'side',back:()=>go('sourceDetails'),change:i=>{SRC.choiceIdx=i},ok:i=>{
  const o=choices[i];if(o.kind==='page')beginSourceChoices({...item,url:o.url,name:o.label||item.name},true);
  else playSourceVod(item,{kind:o.kind,url:o.url});
 }};
 S.zones.choiceBack={items:()=>$('srcChoiceBack').children,cols:'row',up:choices.length?'choiceList':null,left:'side',back:()=>go('sourceDetails'),ok:i=>{if(i===1){showDiagnostic();return}SRC.choiceError='';go('sourceDetails')}};
 return choices.length?'choiceList':'choiceBack';
}
function showDiagnostic(){
 const root=$('diagPanel');if(!root)return;
 const list=window.MophieDiagnostics?MophieDiagnostics.list():[];
 const latest=list[0],item=(S.playing&&S.playing.meta)||SRC.item||{};
 $('diagTitle').textContent='Diagnóstico da Mophie TV';
 $('diagMain').innerHTML=latest?'<div class="diag-number">'+esc(latest.code)+'</div><strong>'+esc(MophieDiagnostics.CODES[latest.code])+'</strong><p>'+esc(latest.detail)+'</p><small>'+esc(latest.provider)+' · '+esc(latest.title)+'</small>':'<p>Nenhum erro registrado nesta sessão.</p>';
 $('diagRecent').innerHTML=list.slice(0,6).map(e=>'<div><b>'+esc(e.code)+'</b> · '+esc(e.detail)+'<small>'+esc(e.where)+'</small></div>').join('');
 $('diagActions').innerHTML='<div class="diag-action">Voltar ao filme</div><div class="diag-action">Escolher outro episódio/player</div><div class="diag-action">Testar vídeo da TCL (D201–D220)</div>';
 DIAG.open=true;DIAG.idx=0;root.hidden=false;renderDiagFocus();
}
function renderDiagFocus(){[...$('diagActions').children].forEach((x,i)=>x.classList.toggle('focused',i===DIAG.idx))}
function closeDiagnostic(){DIAG.open=false;$('diagPanel').hidden=true}
function diagnosticKey(key){
 if(key==='Escape'||key==='Backspace'||key==='Menu'){closeDiagnostic();return}
 if(key==='ArrowUp'||key==='ArrowDown'){DIAG.idx=Math.max(0,Math.min(2,DIAG.idx+(key==='ArrowDown'?1:-1)));renderDiagFocus();return}
 if(key==='Enter'||key==='NumpadEnter'){
  const i=DIAG.idx;closeDiagnostic();if(i===1){if(S.drawer.open)closeDrawer();if(S.playing&&S.playing.kind==='sourceVod'){leavePlayer();go('sourceChoices')}else if(SRC.item)beginSourceChoices(SRC.item)}else if(i===2){if(S.playing)leavePlayer();if(window.MophieVideoTest)MophieVideoTest.open()}
 }
}

function renderSourceDetails(){const it=SRC.item;if(!it){go('sourceCatalog');return null}
 const canPlay=!!(window.MophieSourcePlayer&&window.MophieSourcePlayer.providerPage(it,FL.provider));
 const originalMode=FL.provider==='RedeCanais'&&canPlay;
 const hist=store.sourceProg[sourceHistoryKey(it,FL.provider)];
 setTitle(it.type==='series'?'Série':it.type==='anime'?'Anime':'Filme',FL.provider+' · MophieFlix');
 $('view').innerHTML='<div class="detail"><div class="detail-bg">'+(it.poster?img(it.poster,it.name):'')+'</div><div class="detail-body"><h2>'+esc(it.name)+'</h2><div class="meta-line">'+esc([it.year,it.genre].filter(Boolean).join(' · '))+'</div><p class="syn">'+(hist?(hist.kind==='video'&&hist.p?'Continuar de '+fmtTime(hist.p)+' · ':'Visto recentemente · '):'')+'O aplicativo tenta reproduzir este título internamente quando o provedor disponibiliza um player incorporável. Alguns títulos podem não ter um vídeo disponível.</p><div id="sourceDetailActions" class="actions"><div class="btn">'+ic(canPlay?'play':'info')+(canPlay?'Escolher episódio / player':'Player indisponível')+'</div>'+
 (originalMode?'<div class="btn">'+ic('info')+'Página original (teste)</div>':'')+
 '<div class="btn">'+ic('chevronRight')+'Voltar ao catálogo</div></div>'+
 (SRC.playerError?'<p class="src-note source-error">'+esc(SRC.playerError)+'</p>':'')+
 '<p class="src-note">'+(originalMode?'A opção Página original abre o site fora do iframe da Mophie TV. Use VOLTAR na TV para tentar retornar; se necessário, reabra o aplicativo. Não contorna bloqueios do provedor.':'Vídeos com bloqueio de incorporação ou DRM podem ficar indisponíveis.')+'</p></div></div>';
 S.zones.srcDetail={items:()=>$('sourceDetailActions').children,cols:'row',idx:0,left:'side',back:()=>go('sourceCatalog'),ok:i=>{
  if(i===0){if(canPlay){SRC.choiceOrigin=it;beginSourceChoices(it)}else{const code=reportSource('M101','Sem página individual para '+it.name,it.url);SRC.playerError=code+' · Este título não possui uma página individual para reprodução';go('sourceDetails')}return}
  if(originalMode&&i===1){const url=MophieSourcePlayer.providerPage(it,FL.provider);if(url){persist();window.location.assign(url)}return}
  SRC.playerError='';go('sourceCatalog');
 }};
 return 'srcDetail'}
function renderProviderUnavailable(){setTitle(FL.provider,'MophieFlix · Catálogo indisponível');$('view').innerHTML='<div class="empty">'+ic('alert')+'O catálogo '+esc(FL.provider)+' não está integrado<p>Não há integração autorizada de catálogo e reprodução configurada para esta fonte.</p><div class="actions" id="unavailableBack"><div class="btn">'+ic('chevronRight')+'Voltar aos catálogos</div></div></div>';
 S.zones.unavailable={items:()=>$('unavailableBack').children,cols:'row',left:'side',ok:()=>go('providers'),back:()=>go('providers')};return 'unavailable'}
function renderFlixHome(){if(!currentProfileId){go('mophieflix');return null}setTitle('MophieFlix','Pluto TV · Perfil: '+(store.mophieProfiles.find(p=>p.id===currentProfileId)||{}).name);
 if(!CAT.loaded()){$('view').innerHTML='<div class="empty">'+ic('refresh')+'Carregando catálogo da Pluto TV…</div>';if(!S.flixError)CAT.load().then(()=>{if(S.section==='flixhome'&&!S.drawer.open)go('flixhome')}).catch(e=>{S.flixError=e.message;if(S.section==='flixhome')go('flixhome')});if(S.flixError){$('view').innerHTML='<div class="empty">'+ic('wifiOff')+'Catálogo indisponível<p>'+esc(S.flixError)+'</p><div id="flixRetry" class="actions"><div class="btn">Tentar novamente</div></div></div>';S.zones.flixRetry={items:()=>$('flixRetry').children,cols:'row',ok:()=>{S.flixError='';go('flixhome')},back:()=>go('providers')};return 'flixRetry'}return null}
 const movieCats=CAT.categories('movie'),seriesCats=CAT.categories('series');const continueList=continueItems().map(x=>x.m.type==='episode'?{...x.m,id:x.m.sid,name:x.m.sname,type:'series'}:x.m);
 const myList=Object.values(store.vodFav).map(x=>CAT.item(x.id)||x).filter(Boolean);
 const rails=[{name:'Continue de onde parou',items:continueList,cont:true},{name:'Minha Lista',items:myList},{name:'Filmes em destaque',items:(movieCats[0]||{ids:[]}).ids.map(CAT.item).filter(Boolean).slice(0,28)},{name:'Séries para maratonar',items:(seriesCats[0]||{ids:[]}).ids.map(CAT.item).filter(Boolean).slice(0,28)}];
 movieCats.slice(1,4).forEach(c=>rails.push({name:c.name,items:c.ids.map(CAT.item).filter(Boolean).slice(0,25)}));seriesCats.slice(1,3).forEach(c=>rails.push({name:'Séries · '+c.name,items:c.ids.map(CAT.item).filter(Boolean).slice(0,25)}));
 const shown=rails.filter(x=>x.items.length);const lead=(shown[0]||{items:[]}).items[0];
 $('view').innerHTML='<div class="flix-home" id="flixScroll"><div class="flix-hero">'+(lead&&lead.wide?'<div class="flix-hero-bg">'+img(lead.wide)+'</div>':'')+'<div class="flix-hero-title">MophieFlix</div><p>Descubra filmes, séries e continue de onde parou.</p><div class="flix-hero-source">PLUTO TV · GRÁTIS COM ANÚNCIOS</div></div><div class="flix-topactions" id="flixActions"><div class="btn">'+ic('film')+'Filmes</div><div class="btn">'+ic('clapper')+'Séries</div><div class="btn">'+ic('search')+'Buscar</div><div class="btn">'+ic('heart')+'Minha Lista</div><div class="btn">'+ic('users')+'Trocar perfil</div></div>'+shown.map((r,i)=>'<section class="flix-rail"><h2>'+esc(r.name)+'</h2><div class="flix-rail-scroll" id="railScroll'+i+'"><div class="flix-rail-items" id="rail'+i+'">'+r.items.map(it=>r.cont?continuePosterHTML(it):posterHTML(it)).join('')+'</div></div></section>').join('')+'<div class="flix-footer">'+ic('user')+' Perfil: '+esc((store.mophieProfiles.find(p=>p.id===currentProfileId)||{}).name||'')+' · '+esc(CAT.source)+'</div></div>';
 FL.homeRails=shown;S.zones.flixActions={items:()=>$('flixActions').children,cols:'row',idx:0,down:shown.length?'rail0':null,left:'side',back:()=>go('providers'),ok:i=>{if(i===0)go('movies');else if(i===1)go('series');else if(i===2){V.movie.cat=0;go('movies','cats')}else if(i===3)go('favorites');else go('mophieflix')}};
 const key='flix_'+currentProfileId;shown.forEach((r,i)=>{S.zones['rail'+i]={items:()=>$('rail'+i).children,cols:'row',idx:Math.min(FL.homeIndexes[key+'_'+i]||0,r.items.length-1),scroll:()=>$('railScroll'+i),up:i?'rail'+(i-1):'flixActions',down:i<shown.length-1?'rail'+(i+1):null,left:'side',back:()=>go('providers'),change:j=>{FL.homeRow=i;FL.homeIndexes[key+'_'+i]=j;const el=$('rail'+i);if(el)ensureVisible(el,$('flixScroll'),false)},ok:j=>{if(r.cont){const item=r.items[j];const rec=Object.values(store.vodProg).find(x=>x&&x.m&&(x.m.id===item.id||x.m.sid===item.id));if(rec){playVod(rec.m,{resume:true});return}}openDetails(r.items[j])},ctx:j=>vodCtx(r.items[j]),hints:[['← →','Títulos'],['↑ ↓','Categorias'],['OK','Detalhes'],['VOLTAR','Catálogos']]}});
 return shown.length?'rail'+Math.min(FL.homeRow,shown.length-1):'flixActions'}
function continuePosterHTML(it){const rec=Object.values(store.vodProg).find(x=>x&&x.m&&(x.m.id===it.id||x.m.sid===it.id));let art=posterHTML(it);if(!rec)return art;return art.replace('</div><div class="cap">','<div class="progress"><i style="width:'+pct(rec)+'%"></i></div></div><div class="cap">')}

/* ---------- TV ao Vivo ---------- */
function loadBank(bank){L.bank=bank;L.channels=allChannels(bank);buildLiveCats();applyLiveFilter()}
function buildLiveCats(){const m=new Map();for(const c of L.channels)m.set(c.label,(m.get(c.label)||0)+1);
 L.cats=[{id:'all',label:'Todos',n:L.channels.length},{id:'fav',label:'Favoritos',n:L.channels.filter(c=>c.favorite).length,icon:'heart'}].concat([...m].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR')).map(([l,n])=>({id:'c:'+l,label:l,n})));
 if(!L.cats.some(c=>c.id===L.filter))L.filter='all'}
function applyLiveFilter(){L.list=L.filter==='all'?L.channels:L.filter==='fav'?L.channels.filter(c=>c.favorite):L.channels.filter(c=>'c:'+c.label===L.filter)}
function reloadLive(){const cur=L.list[L.idx];L.channels=allChannels(L.bank);buildLiveCats();applyLiveFilter();const j=cur?L.list.findIndex(x=>x.id===cur.id):-1;L.idx=j>=0?j:Math.max(0,Math.min(L.idx,L.list.length-1))}
function chooseBank(bank){if(!BANKS[bank])return;store.lastBank=bank;persist();L.filter='all';loadBank(bank);const j=L.list.findIndex(c=>normal(c.name)===store['lastChannel_'+bank]);L.idx=j>=0?j:0;go('live','grid');warmVisibleGuide(bank).catch(()=>{})}
// Programação do MeuGuia/mi.tv substitui integralmente os dados XMLTV anteriores.
// Sem correspondência exata e atualização vigente, nunca mostrar a antiga grade IPTV.
const publishedCache=new Map(),pendingProgramProbes=new Map();let publishedTimer=null;
const GUIDE_SNAPSHOT_KEY='mophie_published_guide_v153', GUIDE_TTL=30*60000;
// Mesma emissora em vários bancos: consultar uma única vez, preservando o tvg-id quando existir.
function programCacheKey(c){return c?(normal(c.name||'')+'|'+String(c.tvgId||c.tvg_id||c.epgId||'')):''}
function restoreProgramSnapshot(){
 try{const snapshot=JSON.parse(localStorage.getItem(GUIDE_SNAPSHOT_KEY)||'null');
  if(!snapshot||!Array.isArray(snapshot.rows))return;
  snapshot.rows.forEach(x=>{if(!x||typeof x.key!=='string'||!Array.isArray(x.items)||Date.now()-x.at>GUIDE_TTL)return;
   const items=x.items.filter(p=>typeof p.title==='string'&&Number.isFinite(p.start)&&Number.isFinite(p.stop)&&p.stop>Date.now());
   if(items.length)publishedCache.set(x.key,{at:x.at,source:x.source,items});
  });
 }catch(e){console.warn('Falha ao restaurar grade salva',e)}
}
let guideSaveTimer=null;
function saveProgramSnapshot(){
 if(guideSaveTimer)return;
 guideSaveTimer=setTimeout(()=>{guideSaveTimer=null;
  try{const rows=[...publishedCache].filter(([k,v])=>v&&v.items&&v.items.length&&Date.now()-v.at<GUIDE_TTL)
   .slice(-250).map(([key,x])=>({key,at:x.at,source:x.source,items:x.items.filter(p=>p.stop>Date.now()).slice(0,60).map(p=>({title:p.title,start:p.start,stop:p.stop,desc:p.desc||'',category:p.category||''}))}));
   localStorage.setItem(GUIDE_SNAPSHOT_KEY,JSON.stringify({rows,at:Date.now()}));
  }catch(e){console.warn('Não foi possível salvar o EPG',e)}
 },1800);
}
restoreProgramSnapshot();
function currentProgram(c){const x=c&&publishedCache.get(programCacheKey(c));if(!x||Date.now()-x.at>GUIDE_TTL)return null;
 const now=Date.now(),matches=x.items.filter(p=>p.start<=now&&p.stop>now);
 return matches.length===1?matches[0]:null}
function probeProgram(c,force){if(!c||!window.MophiePublishedGuide)return Promise.resolve(null);
 const cacheKey=programCacheKey(c),old=publishedCache.get(cacheKey);
 if(!force&&old&&Date.now()-old.at<GUIDE_TTL)return Promise.resolve(old);
 if(!navigator.onLine)return Promise.resolve(old||null);
 if(pendingProgramProbes.has(cacheKey))return pendingProgramProbes.get(cacheKey);
 const pending=MophiePublishedGuide.find(c,!!force).then(x=>{
  if(!x||!Array.isArray(x.items))return null;
  const rec={at:Date.now(),items:x.items,source:x.source};
  publishedCache.set(cacheKey,rec);if(rec.items.length)saveProgramSnapshot();refreshProgramTiles();return rec;
 }).catch(e=>{console.warn('Guia não disponível',c.name,String(e));return old||null})
 .finally(()=>pendingProgramProbes.delete(cacheKey));
 pendingProgramProbes.set(cacheKey,pending);return pending;
}
function scheduleProgramProbe(c){clearTimeout(publishedTimer);publishedTimer=setTimeout(()=>probeProgram(c,false),350)}
function programHTML(c){const p=currentProgram(c);return p?esc(p.title)+' <span class="program-time">'+guideTime(p.start)+' - '+guideTime(p.stop)+'</span>':'Programação indisponível'}
function tileHTML(c){const playing=store.lastLive&&normal(store.lastLive.name)===normal(c.name);
 return '<div class="tile'+(playing?' playing':'')+'"><span class="num">'+pad3(c.number)+'</span><div class="channel-copy"><div class="channel-top"><span class="name">'+esc(c.name)+'</span><span class="program">'+programHTML(c)+'</span></div><div class="meta">'+(c.favorite?'<span class="fav">'+ic('heart')+'</span>':'')+(playing?ic('radio'):'')+esc(c.label)+'</div></div></div>'}
function refreshProgramTiles(){
 for(const pair of [['chGrid',L.list.slice(Math.floor((L.idx||0)/LIVE_PAGE_SIZE)*LIVE_PAGE_SIZE,Math.floor((L.idx||0)/LIVE_PAGE_SIZE)*LIVE_PAGE_SIZE+LIVE_PAGE_SIZE)],['fGrid',F.tab===0?L.channels.filter(c=>c.favorite):[]]]){
  const el=$(pair[0]);if(!el)continue;
  const tiles=el.querySelectorAll('.tile');tiles.forEach((node,i)=>{const c=pair[1][i];const program=node.querySelector('.program');if(program&&c)program.innerHTML=programHTML(c)})
 }
 if(S.playing&&S.playing.kind==='live'){
  const p=currentProgram(S.playing.c);
  if(p)$('osdMeta').textContent=p.title+' · '+guideTime(p.start)+'–'+guideTime(p.stop);
 }
}
function fetchGuideForTiles(force){const c=L.list[L.idx]||L.channels[L.idx];return probeProgram(c,!!force)}
// Sincronizar o banco ativo primeiro e os demais sem bloquear o aplicativo indefinidamente.
let guideSyncInProgress=false, syncRun=0;
function allGuideChannels(){const seen=new Set(),out=[];
 const banks=[L.bank,...BANK_IDS.filter(b=>b!=='BCNALL'&&b!==L.bank)];
 for(const b of banks){for(const c of allChannels(b)){
  const key=programCacheKey(c);if(!key||seen.has(key))continue;seen.add(key);out.push(c);
 }}
 return out;
}
async function warmVisibleGuide(bank){
 // Em trocas de banco, prioriza as primeiras linhas mesmo durante outra sincronização.
 const list=allChannels(bank).slice(0,28),seen=new Set();
 const unique=list.filter(c=>{const key=programCacheKey(c);if(seen.has(key))return false;seen.add(key);return true});
 let cursor=0;
 await Promise.all(Array.from({length:Math.min(3,unique.length)},async()=>{
  while(cursor<unique.length){const c=unique[cursor++];await probeProgram(c,false)}
 }));
}
function syncSplash(done,total,matched,stage){
 const e=$('guideSync');if(!e||e.hidden)return;
 $('guideSyncText').textContent=stage||'Buscando programação dos canais…';
 $('guideSyncCount').textContent=done+' / '+total+' canais consultados · '+matched+' com programa atual';
 $('guideSyncFill').style.width=(total?Math.min(100,Math.round(done*100/total)):0)+'%';
}
function hideGuideSplash(){if($('guideSync'))$('guideSync').hidden=true}
async function startGuideSync(showSplash){
 if(guideSyncInProgress)return;
 guideSyncInProgress=true;const run=++syncRun;
 const all=allGuideChannels().slice(0,72),total=all.length,priority=Math.min(10,total);
 if(showSplash){$('guideSync').hidden=false;syncSplash(0,total,0,'Preparando os canais principais…')}
 let done=0,matched=0,frontDone=0;
 const timer=setTimeout(()=>{if(run===syncRun)hideGuideSplash()},16000);
 try{
  if(!navigator.onLine){syncSplash(0,total,0,'Sem internet · utilizando os dados já salvos');return}
  if(window.MophiePublishedGuide&&MophiePublishedGuide.prepare){
   syncSplash(0,total,0,'Identificando os canais no MeuGuia…');
   await Promise.race([MophiePublishedGuide.prepare(),new Promise(resolve=>setTimeout(resolve,7000))]);
  }
  let next=0;
  async function worker(){
   while(next<total&&run===syncRun){const index=next++,c=all[index];
    const rec=await probeProgram(c,false);done++;
    if(rec&&rec.items&&rec.items.some(p=>p.start<=Date.now()&&p.stop>Date.now()))matched++;
    if(index<priority)frontDone++;
    if(showSplash)syncSplash(done,total,matched,frontDone<priority?'Sincronizando canais iniciais…':'Sincronizando outros bancos…');
    if(frontDone>=priority)hideGuideSplash();
    await new Promise(resolve=>setTimeout(resolve,40));
   }
  }
  await Promise.all(Array.from({length:Math.min(2,total)},()=>worker()));
 }finally{clearTimeout(timer);hideGuideSplash();guideSyncInProgress=false;
  if(done)toast('EPG: '+matched+' de '+done+' canais com programação confirmada','info');}
}


function liveInfo(c){const el=$('chInfo');if(!el)return;if(!c){el.innerHTML='';return}
 const playing=store.lastLive&&normal(store.lastLive.name)===normal(c.name);
 el.innerHTML=joinMeta(['<b>'+esc(c.name)+'</b>',esc(c.label),esc(BANKS[c.bank]||c.bank),esc(sourceType(c)),c.favorite?'<span class="pill">'+ic('heart')+'Favorito</span>':'',playing?'<span class="pill">'+ic('radio')+'Último assistido</span>':''])}
function renderLive(){setTitle('TV ao Vivo',L.bank+' · '+BANKS[L.bank]+' · '+L.channels.length+' canais');
 $('view').innerHTML='<div class="live-wrap"><div class="chips" id="bankChips"></div><div class="chips cats" id="catChips"></div><div class="grid-scroll" id="chScroll"><div class="ch-grid" id="chGrid"></div></div><div class="info-bar" id="chInfo"></div></div>';
 $('bankChips').innerHTML=BANK_IDS.map(b=>'<div class="chip bank-chip'+(b===L.bank?' selected':'')+(b==='BCNALL'?' bank-all':'')+'"><b>'+b+'</b><span>'+esc(BANKS[b])+'</span><small>'+(L.counts[b]||0)+'</small></div>').join('');
 $('catChips').innerHTML=L.cats.map(c=>'<div class="chip'+(c.id===L.filter?' selected':'')+'">'+(c.icon?ic(c.icon):'')+esc(c.label)+'<small>'+c.n+'</small></div>').join('');
 const pageStart=Math.floor(Math.max(0,Math.min(L.idx||0,L.list.length-1))/LIVE_PAGE_SIZE)*LIVE_PAGE_SIZE;
  const visibleChannels=L.list.slice(pageStart,pageStart+LIVE_PAGE_SIZE);
  $('chGrid').innerHTML=visibleChannels.map(tileHTML).join('');
 if(!L.list.length)$('chScroll').insertAdjacentHTML('beforeend','<div class="empty">'+ic(L.filter==='fav'?'heart':'tv')+(L.filter==='fav'?'Nenhum canal favorito neste banco<p>Selecione um canal, pressione VOLTAR duas vezes e escolha Favoritar canal.</p>':'Nenhum canal nesta seleção')+'</div>');
 S.zones.banks={items:()=>$('bankChips').children,cols:2,idx:BANK_IDS.indexOf(L.bank),scroll:()=>$('bankChips'),nav:(dir,i)=>{if(dir==='up')return i<2?i:i-2;if(dir==='down')return i>=4?'cats':Math.min(4,i+2);if(dir==='left')return i%2===1?i-1:'side';if(dir==='right')return i<4&&i%2===0?i+1:i;},down:'cats',left:'side',ok:i=>chooseBank(BANK_IDS[i]),hints:[['OK','Abrir banco'],['↓','Categorias e canais'],['VOLTAR segurar 3 s','Opções']]};
 S.zones.cats={items:()=>$('catChips').children,cols:'row',idx:Math.max(0,L.cats.findIndex(c=>c.id===L.filter)),scroll:()=>$('catChips'),up:'banks',down:'grid',left:'side',back:()=>activate('banks'),hints:[['OK','Filtrar'],['↑','Bancos'],['↓','Canais']],
  ok:i=>{L.filter=L.cats[i].id;applyLiveFilter();L.idx=0;go('live',L.list.length?'grid':'cats')}};
 S.zones.grid={items:()=>$('chGrid').children,cols:2,idx:Math.max(0,(L.idx||0)-pageStart),scroll:()=>$('chScroll'),up:'cats',left:'side',back:()=>activate('banks'),nav:(dir,i)=>{
   const cols=channelGridColumns('chGrid');
   if(dir==='down'&&i+cols>=visibleChannels.length&&pageStart+visibleChannels.length<L.list.length){L.idx=pageStart+visibleChannels.length;go('live','grid');return true}
   if(dir==='up'&&i<cols&&pageStart>0){L.idx=pageStart-1;go('live','grid');return true}
   return channelGridNav(dir,i,visibleChannels.length,'chGrid','cats')},
   ok:i=>{const actual=pageStart+i;if(S.menuOverlay&&S.playing&&S.playing.kind==='live'&&S.playing.c.id===L.list[actual].id){closeVideoMenu();return}playLive(L.list,actual,'live')},change:i=>{L.idx=pageStart+i;liveInfo(L.list[L.idx]);scheduleProgramProbe(L.list[L.idx])},ctx:i=>chanCtx(L.list[pageStart+i]),hints:[['OK','Assistir'],['↑ ↓ ← →','Navegar'],['VOLTAR','Bancos'],['VOLTAR segurar 3 s','Opções e favoritos']]};
 if(!L.list.length)liveInfo(null);
 fetchGuideForTiles(false);
 return 'grid'}
function chanCtx(c){if(!c)return null;const fav=!!store.favorites[normal(c.name)];return {icon:'heart',label:(fav?'Remover dos favoritos':'Favoritar canal')+' · '+c.name,run:()=>toggleChannelFav(c)}}
function toggleChannelFav(c){const k=normal(c.name);store.favorites[k]=!store.favorites[k];if(!store.favorites[k])delete store.favorites[k];persist();reloadLive();
 toast(store.favorites[k]?'Adicionado aos favoritos':'Removido dos favoritos','heart');if(!S.playing)go(S.section,S.zone)}
function jumpNumber(d){S.numBuf+=d;clearTimeout(S.numTimer);toast('Canal '+S.numBuf,'tv');
 S.numTimer=setTimeout(()=>{const n=Number(S.numBuf);S.numBuf='';const j=L.list.findIndex(c=>c.number===n);if(j>=0){L.idx=j;if(S.zone==='grid'){S.zones.grid.idx=j;applyFocus()}else activate('grid',j)}else toast('Número de canal indisponível','alert')},900)}

/* ---------- Filmes e Séries ---------- */
const KB='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
function kindSection(kind){return kind==='movie'?'movies':'series'}
function renderCatalog(kind){const title=kind==='movie'?'Filmes':'Séries',st=V[kind];
 if(!CAT.loaded()){
  if(V.error){setTitle(title,'Catálogo indisponível');$('view').innerHTML='<div class="empty">'+ic('wifiOff')+'Não foi possível carregar o catálogo<p>'+esc(V.error)+'. Verifique a conexão com a internet e tente novamente.</p><div class="actions" id="retry"><div class="btn">'+ic('refresh')+'Tentar novamente</div></div></div>';
   S.zones.retry={items:()=>$('retry').children,cols:'row',left:'side',ok:()=>{V.error='';go(kindSection(kind))}};return 'retry'}
  setTitle(title,'Carregando catálogo…');
  $('view').innerHTML='<div class="cat-layout"><div class="cat-list">'+'<div class="cat skeleton" style="margin-bottom:.5rem"></div>'.repeat(9)+'</div><div class="cat-main"><div class="hero"></div><div class="poster-scroll"><div class="poster-grid">'+'<div class="skeleton poster-sk"></div>'.repeat(14)+'</div></div></div></div>';
  // Ao terminar o carregamento, o foco entra nas categorias — a menos que o usuário tenha escolhido outro item da barra lateral.
  CAT.load().then(()=>{const sec=kindSection(kind),side=S.zones.side;if(S.section===sec&&!S.playing&&!S.drawer.open)go(sec,S.zone==='side'&&SIDE[side.idx]!==sec?'side':'cats')}).catch(e=>{V.error=e.message||'Erro de rede';if(S.section===kindSection(kind)&&!S.playing)go(S.section,'retry')});
  return null}
 st.cats=CAT.categories(kind);if(st.cat>st.cats.length)st.cat=1;
 const total=new Set();st.cats.forEach(c=>c.ids.forEach(id=>total.add(id)));
 setTitle(title,CAT.source+' · '+total.size.toLocaleString('pt-BR')+' títulos · gratuito com anúncios');
 $('view').innerHTML='<div class="cat-layout"><div class="cat-list" id="catList"></div><div class="cat-main" id="catMain"></div></div>';
 $('catList').innerHTML='<div class="cat'+(st.cat===0?' selected':'')+'">'+ic('search')+'<span>Buscar</span></div>'+st.cats.map((c,i)=>'<div class="cat'+(st.cat===i+1?' selected':'')+'"><span>'+esc(c.name)+'</span><small>'+c.ids.length+'</small></div>').join('');
 S.zones.cats={items:()=>$('catList').children,cols:1,idx:st.cat,scroll:()=>$('catList'),left:'side',hints:[['↑ ↓','Categorias'],['→','Títulos'],['VOLTAR segurar 3 s','Opções']],
  right:()=>{flushCatMain(kind);return st.cat===0?'kb':'grid'},ok:()=>{flushCatMain(kind);activate(st.cat===0?'kb':'grid')},
  change:i=>{if(i===st.cat)return;st.cat=i;st.grid=0;markSelected('catList',i);clearTimeout(V.timer);V.timer=setTimeout(()=>renderCatMain(kind),140)}};
 renderCatMain(kind);
 return 'cats'}
function flushCatMain(kind){if(V.timer){clearTimeout(V.timer);V.timer=null;renderCatMain(kind)}}
function renderCatMain(kind){V.timer=null;const st=V[kind];delete S.zones.grid;delete S.zones.kb;delete S.zones.res;if(st.cat===0)return renderSearch(kind);
 const cat=st.cats[st.cat-1];if(!cat)return;const items=cat.ids.map(CAT.item).filter(Boolean);
 $('catMain').innerHTML='<div class="hero" id="hero"></div><div class="poster-scroll" id="pScroll"><div class="poster-grid" id="pGrid">'+items.map(posterHTML).join('')+'</div></div>';
 S.zones.grid={items:()=>$('pGrid').children,cols:7,idx:st.grid,scroll:()=>$('pScroll'),left:'cats',back:()=>activate('cats'),ok:i=>openDetails(items[i]),change:i=>{st.grid=i;hero(items[i])},ctx:i=>vodCtx(items[i])};
 hero(items[Math.min(st.grid,items.length-1)])}
function posterHTML(it){const p=store.vodProg[it.id];
 return '<div class="poster"><div class="art"><div class="ph">'+esc(it.name)+'</div>'+img(it.poster)+(store.vodFav[it.id]?'<span class="badge">'+ic('heart')+'</span>':store.vodWatched[it.id]?'<span class="badge">'+ic('check')+'</span>':'')+(p?'<div class="progress"><i style="width:'+pct(p)+'%"></i></div>':'')+'</div><div class="cap">'+esc(it.name)+'</div></div>'}
function itemMeta(it){return joinMeta([esc(it.year),esc(it.genre),it.type==='series'?(it.seasons?it.seasons+(it.seasons>1?' temporadas':' temporada'):''):esc(fmtDur(it.dur)),ratingBadge(it.rating)])}
function hero(it){const el=$('hero');if(!el)return;if(!it){el.innerHTML='';return}el.innerHTML='<h2>'+esc(it.name)+'</h2><div class="meta-line">'+itemMeta(it)+'</div>'+(it.summary?'<p>'+esc(it.summary)+'</p>':'')}
function renderSearch(kind){const st=V[kind];
 $('catMain').innerHTML='<div class="search-wrap"><div class="kb-side"><div class="query">'+ic('search')+'<span id="q"></span></div><div class="kb" id="kb">'+KB.map(k=>'<div class="kb-key">'+k+'</div>').join('')+'<div class="kb-key wide2">'+ic('space')+'</div><div class="kb-key wide2">'+ic('backspace')+'</div><div class="kb-key wide2">Limpar</div></div></div><div class="search-results"><div class="section-label" id="resLabel"></div><div class="poster-scroll" id="rScroll"><div class="poster-grid" id="rGrid"></div></div></div></div>';
 $('q').textContent=st.q;let hits=[],timer=null;
 const results=()=>{hits=CAT.search(st.q,kind);const what=kind==='movie'?'filme':'série';
  $('resLabel').textContent=!st.q?'Digite o nome de um'+(kind==='movie'?' ':'a ')+what:hits.length?hits.length+(hits.length>1?' resultados':' resultado')+' para “'+st.q+'”':'Nenhum resultado para “'+st.q+'”';
  $('rGrid').innerHTML=hits.map(posterHTML).join('');st.res=Math.min(st.res,Math.max(0,hits.length-1))};
 results();
 S.zones.kb={items:()=>$('kb').children,cols:6,idx:st.kb,left:'cats',right:()=>hits.length?'res':null,back:()=>activate('cats'),change:i=>{st.kb=i},hints:[['OK','Digitar'],['→','Resultados'],['VOLTAR','Categorias']],
  nav:(dir,i)=>{if(dir==='down'&&i>=30&&i<36)return 36+Math.floor((i-30)/2);if(dir==='up'&&i>=36)return 30+(i-36)*2},
  ok:i=>{if(i<36){if(st.q.length<40)st.q+=KB[i]}else if(i===36){if(st.q&&!/ $/.test(st.q))st.q+=' '}else if(i===37)st.q=st.q.slice(0,-1);else st.q='';
   $('q').textContent=st.q;clearTimeout(timer);results()}};
 S.zones.res={items:()=>$('rGrid').children,cols:5,idx:st.res,scroll:()=>$('rScroll'),left:'kb',back:()=>activate('kb'),ok:i=>openDetails(hits[i]),change:i=>{st.res=i},ctx:i=>vodCtx(hits[i]),hints:[['OK','Detalhes'],['VOLTAR','Teclado']]}}

/* ---------- detalhes ---------- */
function movieMeta(it){return {id:it.id,type:'movie',name:it.name,poster:it.poster,wide:it.wide,genre:it.genre,year:it.year,rating:it.rating,dur:it.dur,path:it.path,summary:String(it.summary||'').slice(0,320)}}
function seriesMeta(it){return {id:it.id,type:'series',name:it.name,poster:it.poster,wide:it.wide,genre:it.genre,year:it.year,rating:it.rating,seasons:it.seasons,summary:String(it.summary||'').slice(0,320)}}
function epMeta(series,ep){return {id:ep.id,type:'episode',sid:series.id,sname:series.name,season:ep.season,num:ep.num,name:ep.name,thumb:ep.thumb,poster:series.poster,wide:series.wide,path:ep.path,dur:ep.dur}}
function openDetails(it){if(!it)return;const full=CAT.loaded()&&CAT.item(it.id);S.detail={item:full||it,from:S.section,act:0,season:0,ep:0,data:null,loading:false,err:''};go('details','acts')}
function flatEpisodes(data){return data?[].concat(...data.seasons.map(s=>s.episodes)):[]}
function seriesTarget(it,data){const flat=flatEpisodes(data);if(!flat.length)return null;const last=store.vodSeriesLast[it.id];let i=last?flat.findIndex(e=>e.id===last.id):-1;
 if(i<0)return {ep:flat[0],label:'Assistir'};if(store.vodProg[flat[i].id])return {ep:flat[i],label:'Continuar'};if(flat[i+1])return {ep:flat[i+1],label:'Próximo episódio'};return {ep:flat[i],label:'Assistir novamente'}}
function renderDetails(){const D=S.detail,it=D.item,series=it.type==='series';
 S.sideCurrent=SIDE.indexOf(D.from)>=0?D.from:S.sideCurrent;markSide();setTitle(series?'Séries':'Filmes','');
 if(series&&!D.data&&!D.loading&&!D.err){D.loading=true;CAT.seasons(it.id).then(data=>{D.data=data;D.loading=false;const t=seriesTarget(it,data);
   if(t){D.season=Math.max(0,data.seasons.findIndex(s=>s.episodes.indexOf(t.ep)>=0));D.ep=Math.max(0,data.seasons[D.season].episodes.indexOf(t.ep))}
   if(S.section==='details'&&S.detail===D&&!S.playing&&!S.drawer.open)go('details',S.zone)}).catch(e=>{D.loading=false;D.err=e.message||'Erro de rede';if(S.section==='details'&&S.detail===D&&!S.playing)go('details',S.zone)})}
 const syn=it.summary||(D.data&&D.data.summary)||'',credits=[];
 if(it.dir&&it.dir.length)credits.push('<b>Direção:</b> '+esc(it.dir.join(', ')));if(it.cast&&it.cast.length)credits.push('<b>Elenco:</b> '+esc(it.cast.join(', ')));
 $('view').innerHTML='<div class="detail'+(series?' series':'')+'"><div class="detail-bg">'+(it.wide?'<img src="'+esc(it.wide)+'" onerror="this.remove()" alt="">':'')+'</div><div class="detail-body"><h2>'+esc(it.name)+'</h2><div class="meta-line">'+itemMeta(it)+'</div>'+(syn?'<p class="syn">'+esc(syn)+'</p>':'')+(credits.length?'<div class="credits">'+credits.join('<br>')+'</div>':'')+'<div class="actions" id="acts"></div></div>'+
  (series?'<div class="seasons" id="seasons"></div><div class="eps-scroll" id="epScroll"><div class="eps" id="eps"></div></div><p class="ep-syn" id="epSyn"></p>':'')+'</div>';
 const acts=[],prog=store.vodProg[it.id],fav=!!store.vodFav[it.id];
 if(!series){if(prog){acts.push({icon:'play',label:'Continuar',small:fmtTime(prog.p),run:()=>playVod(movieMeta(it),{resume:true})});acts.push({icon:'restart',label:'Recomeçar',run:()=>playVod(movieMeta(it),{resume:false})})}
  else acts.push({icon:'play',label:'Assistir',small:fmtDur(it.dur),run:()=>playVod(movieMeta(it),{resume:false})})}
 else if(D.data){const t=seriesTarget(it,D.data);if(t)acts.push({icon:'play',label:t.label,small:'T'+t.ep.season+' · E'+t.ep.num,run:()=>playVod(epMeta(it,t.ep),{resume:true})})}
 else acts.push({icon:D.err?'alert':'refresh',label:D.err?'Tentar novamente':'Carregando episódios…',run:()=>{if(D.err){D.err='';go('details','acts')}}});
 acts.push({icon:'heart',label:fav?'Remover dos favoritos':'Favoritar',run:()=>toggleVodFav(it)});
 $('acts').innerHTML=acts.map(a=>'<div class="btn">'+ic(a.icon)+a.label+(a.small?' <small>'+esc(a.small)+'</small>':'')+'</div>').join('');
 const back=()=>{go(D.from)};
 S.zones.acts={items:()=>$('acts').children,cols:'row',idx:Math.min(D.act,acts.length-1),left:'side',down:series&&D.data&&D.data.seasons.length?'seasons':null,back,ok:i=>acts[i].run(),change:i=>{D.act=i},ctx:()=>vodCtx(it)};
 if(series&&D.data){const seasons=D.data.seasons;
  $('seasons').innerHTML=seasons.map((s,i)=>'<div class="season'+(i===D.season?' selected':'')+'">Temporada '+s.number+'</div>').join('');
  const renderEps=()=>{const eps=(seasons[D.season]||{episodes:[]}).episodes;
   $('eps').innerHTML=eps.map(e=>{const p=store.vodProg[e.id],w=store.vodWatched[e.id];return '<div class="ep"><div class="thumb"><div class="ph">Episódio '+e.num+'</div>'+img(e.thumb)+(w?'<span class="badge">'+ic('check')+'</span>':'')+(p?'<div class="progress"><i style="width:'+pct(p)+'%"></i></div>':'')+'</div><div class="t">'+e.num+'. '+esc(e.name)+'</div><div class="d">'+(w?ic('checkCircle')+'Assistido · ':'')+esc(fmtDur(e.dur))+'</div></div>'}).join('');
   $('epScroll').scrollLeft=0;$('epSyn').textContent=eps[D.ep]?eps[D.ep].summary:''};
  renderEps();
  S.zones.seasons={items:()=>$('seasons').children,cols:'row',idx:D.season,scroll:()=>$('seasons'),up:'acts',down:'eps',left:'side',back,ctx:()=>vodCtx(it),hints:[['← →','Temporadas'],['↓','Episódios'],['VOLTAR','Voltar']],
   change:i=>{if(i===D.season)return;D.season=i;D.ep=0;markSelected('seasons',i);renderEps()}};
  S.zones.eps={items:()=>$('eps').children,cols:'row',idx:D.ep,scroll:()=>$('epScroll'),up:'seasons',left:'side',back,ctx:()=>vodCtx(it),hints:[['OK','Assistir episódio'],['← →','Episódios'],['VOLTAR','Voltar']],
   ok:i=>{const e=seasons[D.season].episodes[i];if(e)playVod(epMeta(it,e),{resume:true})},change:i=>{D.ep=i;const e=seasons[D.season].episodes[i];$('epSyn').textContent=e?e.summary:''}}}
 return 'acts'}
function vodCtx(it){if(!it)return null;const fav=!!store.vodFav[it.id];return {icon:'heart',label:(fav?'Remover dos favoritos':'Favoritar')+' · '+it.name,run:()=>toggleVodFav(it)}}
function toggleVodFav(it){if(store.vodFav[it.id]){delete store.vodFav[it.id];toast('Removido dos favoritos','heart')}else{store.vodFav[it.id]=it.type==='series'?seriesMeta(it):movieMeta(it);toast('Adicionado aos favoritos','heart')}persist();if(!S.playing)go(S.section,S.zone)}

/* ---------- Favoritos ---------- */
function renderFavorites(){const chans=allChannels('BCNALL').filter(c=>c.favorite);const byName=(a,b)=>a.name.localeCompare(b.name,'pt-BR');
 const movies=Object.values(store.vodFav).filter(m=>m.type==='movie').sort(byName),series=Object.values(store.vodFav).filter(m=>m.type==='series').sort(byName);
 const tabs=[['tv','Canais',chans],['film','Filmes',movies],['clapper','Séries',series]];setTitle('Favoritos',chans.length+movies.length+series.length+' itens salvos neste televisor');
 $('view').innerHTML='<div class="live-wrap"><div class="chips" id="favTabs">'+tabs.map((t,i)=>'<div class="chip'+(i===F.tab?' selected':'')+'">'+ic(t[0])+t[1]+'<small>'+t[2].length+'</small></div>').join('')+'</div><div id="favBody" style="flex:1;min-height:0;display:flex;flex-direction:column"></div></div>';
 const body=()=>{const list=tabs[F.tab][2];delete S.zones.grid;
  if(!list.length){$('favBody').innerHTML='<div class="empty">'+ic('heart')+'Nenhum item em '+tabs[F.tab][1]+'<p>Para favoritar, selecione um '+(F.tab===0?'canal':'título')+', pressione VOLTAR duas vezes e escolha Favoritar.</p></div>';return}
  if(F.tab===0){$('favBody').innerHTML='<div class="grid-scroll" id="fScroll"><div class="ch-grid" id="fGrid">'+list.map(tileHTML).join('')+'</div></div>';
   S.zones.grid={items:()=>$('fGrid').children,cols:2,idx:F.idx[0],scroll:()=>$('fScroll'),up:'tabs',left:'side',back:()=>activate('tabs'),nav:(dir,i)=>channelGridNav(dir,i,list.length,'fGrid','tabs'),ok:i=>playLive(list,i,'favorites'),change:i=>{F.idx[0]=i},ctx:i=>chanCtx(list[i]),hints:[['OK','Assistir'],['VOLTAR segurar 3 s','Remover dos favoritos']]}}
  else{$('favBody').innerHTML='<div class="poster-scroll" id="fScroll"><div class="poster-grid" id="fGrid" style="grid-template-columns:repeat(8,minmax(0,1fr))">'+list.map(posterHTML).join('')+'</div></div>';const t=F.tab;
   S.zones.grid={items:()=>$('fGrid').children,cols:8,idx:F.idx[t],scroll:()=>$('fScroll'),up:'tabs',left:'side',back:()=>activate('tabs'),ok:i=>openDetails(list[i]),change:i=>{F.idx[t]=i},ctx:i=>vodCtx(list[i]),hints:[['OK','Detalhes'],['VOLTAR segurar 3 s','Remover dos favoritos']]}}};
 body();
 S.zones.tabs={items:()=>$('favTabs').children,cols:'row',idx:F.tab,left:'side',down:'grid',hints:[['← →','Tipo'],['↓','Itens'],['VOLTAR segurar 3 s','Opções']],change:i=>{if(i===F.tab)return;F.tab=i;markSelected('favTabs',i);body()}};
 return 'grid'}

/* ---------- Continuar assistindo ---------- */
function continueItems(){const recs=Object.values(store.vodProg).filter(r=>r&&r.m&&r.m.path).sort((a,b)=>b.t-a.t),seen=new Set(),out=[];
 for(const r of recs){const k=r.m.type==='episode'?'s:'+r.m.sid:r.m.id;if(seen.has(k))continue;seen.add(k);out.push(r)}return out}
function renderContinue(){const recs=continueItems(),ll=store.lastLive,cards=[];if(ll&&ll.name)cards.push({live:ll});recs.forEach(r=>cards.push({rec:r}));
 setTitle('Continuar assistindo',recs.length?recs.length+(recs.length>1?' títulos em andamento':' título em andamento'):'');
 if(!cards.length){$('view').innerHTML='<div class="empty">'+ic('history')+'Nada para continuar ainda<p>Filmes, episódios e o último canal assistido aparecem aqui automaticamente.</p></div>';return null}
 $('view').innerHTML='<div class="wide-scroll" id="wScroll"><div class="wide-grid" id="wGrid">'+cards.map(c=>{if(c.live)return '<div class="wide live"><div class="thumb"><div class="live-in">'+ic('radio')+'<b>'+esc(c.live.name)+'</b></div></div><div class="t">Voltar ao canal</div><div class="d">TV ao Vivo · '+esc(BANKS[c.live.bank]||c.live.bank)+'</div></div>';
  const r=c.rec,m=r.m,ep=m.type==='episode';return '<div class="wide"><div class="thumb"><div class="ph">'+esc(ep?m.sname:m.name)+'</div>'+img(ep?(m.thumb||m.wide):(m.wide||m.poster))+'<div class="progress"><i style="width:'+pct(r)+'%"></i></div></div><div class="t">'+esc(ep?m.sname:m.name)+'</div><div class="d">'+(ep?'T'+m.season+' · E'+m.num+' · '+esc(m.name):'Faltam '+esc(fmtDur((r.d-r.p)*1000)||'poucos minutos'))+'</div></div>'}).join('')+'</div></div>';
 S.zones.grid={items:()=>$('wGrid').children,cols:4,idx:0,scroll:()=>$('wScroll'),left:'side',
  ok:i=>{const c=cards[i];if(c.live)playLastLive();else playVod(c.rec.m,{resume:true})},
  ctx:i=>{const c=cards[i];if(!c||c.live)return null;const m=c.rec.m;return {icon:'x',label:'Remover de Continuar assistindo',run:()=>{Object.keys(store.vodProg).forEach(k=>{const r=store.vodProg[k];if(r&&r.m&&(r.m.id===m.id||(m.sid&&r.m.sid===m.sid)))delete store.vodProg[k]});persist();go('continue')}}}};
 return 'grid'}
function playLastLive(){const ll=store.lastLive;if(!ll)return;const list=allChannels(BANKS[ll.bank]?ll.bank:'BCNALL');const i=list.findIndex(c=>normal(c.name)===normal(ll.name));if(i<0){toast('Canal não encontrado no banco atual','alert');return}playLive(list,i,'continue')}

/* ---------- Configurações e Sobre ---------- */
function renderSettings(){setTitle('Configurações','Salvas automaticamente neste televisor');const n=continueItems().length;
 const rows=[['volume','Volume padrão','Use ← e → para ajustar','<div class="mini"><i style="width:'+S.volume+'%"></i></div>'+S.volume+'%'],
  ['tv','Ao abrir o aplicativo','Tela exibida ao ligar a Mophie TV',store.openBanks?'Seleção de bancos':'Último banco e canal'],
  ['refresh','Atualizar canais','BCN1, BCN3 e BCN4 (CXTV)',S.refreshRunning?'Atualizando…':store.updated?'Atualizado '+esc(fmtDate(store.updated)):''],
  ['film','Atualizar filmes e séries','Catálogo '+CAT.source,CAT.loaded()?'Carregado':'Sob demanda'],
  ['history','Limpar Continuar assistindo',n+(n===1?' item':' itens')+' em andamento',''],
  ['info','Sobre a Mophie TV','Versão '+VERSION,''],
  ['settings','Tamanho da Interface','← menor · → maior · ajuste de 5%',store.uiScale+'%'],
  ['restart','Restaurar tamanho padrão','Retornar a interface para 100%','100%'],
  ['refresh','Atualizações da Mophie TV','Consultar versão na Hostinger','Verificar agora']];
 $('view').innerHTML='<div class="settings" id="setList">'+rows.map(r=>'<div class="setting">'+ic(r[0])+'<div class="lbl"><b>'+r[1]+'</b><small>'+r[2]+'</small></div><div class="val">'+r[3]+'</div></div>').join('')+'</div><div class="settings-credit">Desenvolvido por Luiz Vinicius · Mophie TV '+VERSION+'</div>';
 S.zones.list={items:()=>$('setList').children,cols:1,idx:ST.idx,scroll:()=>$('setList'),left:'side',change:i=>{ST.idx=i},
  nav:(dir,i)=>{if(i===0&&(dir==='left'||dir==='right')){volume(dir==='right'?5:-5);go('settings','list');return true}if(i===6&&(dir==='left'||dir==='right')){store.uiScale=Math.max(80,Math.min(130,store.uiScale+(dir==='right'?5:-5)));persist();applyScale();go('settings','list');return true}},
  ok:i=>{if(i===0){volume(5);go('settings','list')}
   else if(i===1){store.openBanks=!store.openBanks;persist();go('settings','list')}
   else if(i===2)refreshAll()
   else if(i===3){toast('Atualizando filmes e séries…','refresh');V.error='';CAT.load(true).then(()=>{toast('Catálogo de filmes e séries atualizado','check');if(S.section==='settings')go('settings','list')}).catch(e=>toast('Não foi possível atualizar: '+e.message,'alert'))}
   else if(i===4){if(Date.now()-ST.confirmAt<3500){store.vodProg={};store.vodSeriesLast={};persist();ST.confirmAt=0;toast('Continuar assistindo foi limpo','check');go('settings','list')}else{ST.confirmAt=Date.now();toast('Pressione OK novamente para confirmar','alert')}}
   else if(i===5)go('about')
   else if(i===6){store.uiScale=store.uiScale>=130?80:store.uiScale+5;persist();applyScale();go('settings','list')}
   else if(i===7){store.uiScale=100;persist();applyScale();toast('Tamanho padrão restaurado','check');go('settings','list')}
   else if(i===8){if(window.MophieUpdater)MophieUpdater.check(true);else toast('Atualizador indisponível','alert')}}};
 return 'list'}
function renderAbout(){S.sideCurrent='settings';markSide();setTitle('Sobre','');
 $('view').innerHTML='<div class="about"><div class="about-brand"><img src="logo.png" alt=""><div><b>Mophie <em>TV</em></b><small>Entretenimento para Android TV · versão '+VERSION+'</small></div></div>'+
  '<dl><dt>Plataforma</dt><dd>Android TV / Google TV · edição TCL</dd><dt>Pacote</dt><dd>com.mophie.tv</dd><dt>TV ao Vivo</dt><dd>BCN1 Rei dos Canais · BCN2 TV a Cabo · BCN3 IPTV-org · BCNALL todos</dd><dt>Filmes e séries</dt><dd>'+esc(CAT.source)+' — catálogo gratuito, licenciado e financiado por anúncios</dd><dt>Controle remoto</dt><dd>Setas navegam · OK seleciona · VOLTAR retorna · VOLTAR segurar 3 s abre opções</dd></dl>'+
  '<p>Desenvolvido por Luiz Vinicius</p><p>Fontes de vídeo e players de terceiros podem expirar, bloquear a incorporação ou exigir interação. O zoom de 1,14× é aplicado somente aos players da TV a Cabo (BCN2), exceto Chaves 24H. A reprodução depende da internet e da disponibilidade de cada provedor.</p>'+
  '<div class="actions" id="aboutAct"><div class="btn">'+ic('settings')+'Voltar às configurações</div></div></div>';
 S.zones.about={items:()=>$('aboutAct').children,cols:'row',left:'side',ok:()=>go('settings','list'),back:()=>go('settings','list')};
 return 'about'}

/* ---------- player ---------- */
function showPlayer(){hideGuideSplash();if($('playerDiagBadge'))$('playerDiagBadge').hidden=true;if(GUIDE.open)closeEpg();S.menuOverlay=false;document.body.classList.remove('menu-over-video');$('player').hidden=false;$('app').style.display='none'}
function openVideoMenu(){if(!S.playing||S.playing.kind!=='live')return;S.menuOverlay=true;S.overlayReturnPending=true;document.body.classList.add('menu-over-video');$('app').style.display='';if(S.playing.kind==='live'){
 const x=S.ctx,c=x.list[x.i];if(x.from==='live'){const j=L.list.findIndex(ch=>ch.id===c.id);if(j>=0)L.idx=j;go('live','grid')}else go(x.from==='favorites'?'favorites':'live','grid')
 }else go(currentProfileId?'flixhome':'mophieflix');
 setHints([['OK','Selecionar'],['VOLTAR','Voltar ao vídeo'],['CH +/-','Trocar canal']]);}
function closeVideoMenu(){if(!S.menuOverlay)return;S.menuOverlay=false;S.overlayReturnPending=false;document.body.classList.remove('menu-over-video');$('app').style.display='none';osd()}

function stopPlayer(){if(window.MophieVirtualMouse)MophieVirtualMouse.disable();if(DIAG.open)closeDiagnostic();if($('playerDiagBadge'))$('playerDiagBadge').hidden=true;clearTimeout(srcFrameTimer);clearTimeout(S.playerTimer);if(S.hls){S.hls.destroy();S.hls=null}const v=$('video');v.ontimeupdate=null;v.onended=null;v.onerror=null;v.pause();v.removeAttribute('src');v.load();
 const f=$('embed');f.onload=null;f.onerror=null;f.removeAttribute('src');f.style.display='none';v.style.display='none';$('pauseMark').classList.add('hidden')}
function setOsd(o){$('osdBadge').innerHTML=ic(o.icon)+esc(o.badge);$('osdNumber').textContent=o.number||'';$('osdTitle').textContent=o.title||'';$('osdMeta').textContent=o.meta||'';
 const onDemand=!!S.playing&&(S.playing.kind==='vod'||S.playing.kind==='sourceVod');
 const showProgress=onDemand&&!!o.progress;
 $('osdProgress').hidden=!showProgress;
 $('osdProgress').setAttribute('aria-hidden',showProgress?'false':'true');
 $('osdHelp').innerHTML=o.help.map(([k,l])=>'<span class="hint"><span class="key">'+esc(k)+'</span>'+esc(l)+'</span>').join('')}
function osd(keep){clearTimeout(S.playerTimer);$('osd').classList.remove('hidden');updateProgress();if(!keep)S.playerTimer=setTimeout(()=>{if(!(S.playing&&S.playing.kind==='vod'&&$('video').paused))$('osd').classList.add('hidden')},5500)}
function volume(delta){S.volume=Math.min(100,Math.max(0,S.volume+delta));store.volume=S.volume;persist();$('video').volume=S.volume/100;$('volumeValue').textContent=S.volume;$('volumeFill').style.width=S.volume+'%';
 $('volIcon').innerHTML=ic(S.volume?'volume':'volumeOff');$('volumeOsd').classList.remove('hidden');clearTimeout($('volumeOsd')._hide);$('volumeOsd')._hide=setTimeout(()=>$('volumeOsd').classList.add('hidden'),1900)}
function attachSource(u,o){const v=$('video');
 if(/\.m3u8(?:[?#]|$)/i.test(u)&&window.Hls&&Hls.isSupported()){let net=0,media=0;
  const h=S.hls=new Hls(o.live?{enableWorker:true,lowLatencyMode:false,maxBufferLength:12}:{enableWorker:true,maxBufferLength:30,startPosition:o.start>0?o.start:-1});
  h.loadSource(u);h.attachMedia(v);h.on(Hls.Events.MANIFEST_PARSED,()=>v.play().catch(()=>{}));prepareSubtitleEvents();
  h.on(Hls.Events.ERROR,(_e,d)=>{if(!d.fatal||S.hls!==h)return;if(d.type===Hls.ErrorTypes.NETWORK_ERROR&&net++<2){h.startLoad();return}if(d.type===Hls.ErrorTypes.MEDIA_ERROR&&media++<1){h.recoverMediaError();return}(o.live?toast('Transmissão indisponível: '+o.name,'alert'):(S.playing&&S.playing.kind==='sourceVod'?reportSource('M108',String(d.details||d.reason||'Falha HLS'),u):null,toast('Vídeo indisponível: '+o.name,'alert')))})}
 else{v.src=u;prepareSubtitleEvents();if(o.start>0)v.addEventListener('loadedmetadata',()=>{try{v.currentTime=o.start}catch(e){}},{once:true});v.play().catch(()=>toast('O player exige interação para iniciar','alert'))}}
/* Reprodução no próprio APK: o resolvedor aceita vídeo direto ou iframe público quando a fonte permitir.
   Não tenta obter cookies, DRM, sessões nem contornar políticas de origem. */
function sourceHistoryKey(item,provider){return provider+'|'+(item.id||item.url||item.name)}
function rememberSource(item,provider,kind,url,position,duration){
 if(!currentProfileId||!item)return;
 const key=sourceHistoryKey(item,provider),old=store.sourceProg[key]||{};
 store.sourceProg[key]={provider,item:{...item},kind:kind||old.kind||'embed',url:url||old.url||'',p:position!=null?Math.floor(position):(old.p||0),d:duration!=null?Math.floor(duration):(old.d||0),t:Date.now()};
 const keys=Object.keys(store.sourceProg);if(keys.length>75)keys.sort((a,b)=>store.sourceProg[a].t-store.sourceProg[b].t).slice(0,keys.length-75).forEach(k=>delete store.sourceProg[k]);
 persist();
}
async function playSourceVod(item,selection){
 if(!window.MophieSourcePlayer){SRC.playerError='M104 · Player não instalado.';go('sourceDetails');return}
 saveProgress();stopPlayer();SRC.playerError='';
 const P=S.playing={kind:'sourceVod',meta:item},provider=FL.provider;
 S.ctx={kind:'sourceVod',from:'sourceDetails'};showPlayer();
 setOsd({icon:'film',badge:provider.toUpperCase(),number:'',title:item.name,meta:'Procurando player compatível…',progress:false,help:[['OK','Diagnóstico e opções'],['VOLTAR','Voltar ao catálogo']]});reportSource('M114','Abrindo player selecionado',selection&&selection.url||item.url);osd(true);
 try{
  const result=selection||await MophieSourcePlayer.resolve(item,provider);
  if(S.playing!==P)return;
  const previous=store.sourceProg[sourceHistoryKey(item,provider)];
  rememberSource(item,provider,result.kind,result.url,null,null);
  const v=$('video'),f=$('embed');
  if(!result){throw Error('Este título não disponibilizou uma fonte incorporável.')}
  if(result.kind==='video'){
    v.style.display='block';v.volume=S.volume/100;
    const start=previous&&previous.url===result.url&&previous.d>0&&previous.p>15&&previous.p<previous.d-30?previous.p:0;
    attachSource(result.url,{live:false,name:item.name,start});
    // attachSource() tenta reproduzir imediatamente para vídeo direto e após
    // MANIFEST_PARSED no HLS. Caso a mídia só fique pronta depois, tenta de novo
    // quando a WebView confirmar canplay, sem tentar tocar um iframe inacessível.
    v.addEventListener('canplay',()=>{
      if(S.playing!==P||!v.paused)return;
      try{const attempt=v.play();if(attempt&&attempt.catch)attempt.catch(e=>{
        if(S.playing!==P)return;
        const code=reportSource('M119','Reprodução automática recusada: '+String(e&&e.name||e),result.url);
        $('osdMeta').textContent=code+' · Escolha o botão Play se o site exigir interação';
      })}catch(e){reportSource('M119',String(e),result.url)}
    },{once:true});
    v.ontimeupdate=()=>{if(S.playing!==P)return;if(!P.savedAt||Date.now()-P.savedAt>5000){P.savedAt=Date.now();if(isFinite(v.currentTime)&&isFinite(v.duration)&&v.duration>0)rememberSource(item,provider,'video',result.url,v.currentTime,v.duration)}};
    v.onended=()=>{if(S.playing===P){delete store.sourceProg[sourceHistoryKey(item,provider)];persist();closePlayer()}};
    v.onerror=()=>{if(S.playing===P){const code=reportSource('M108','O vídeo apresentou erro de decodificação ou rede',result.url);$('osdMeta').textContent=code+' · Falha ao carregar vídeo. OK: diagnóstico.'}};
    $('osdMeta').textContent='Reprodução interna · '+provider;
    setOsd({icon:'film',badge:provider.toUpperCase(),number:'',title:item.name,meta:'Reprodução interna · '+provider,progress:true,help:[['OK','Pausar'],['← →','Avançar/voltar'],['↑ ↓','Volume'],['VOLTAR','Sair']]});
  }else if(result.kind==='embed'){
    f.style.display='block';f.className='';
    // Sem permissão de popups nem navegação da janela principal: nunca abre sites fora do app.
    f.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-presentation');
    f.src=result.url;
    $('osdMeta').textContent='Player incorporado · '+provider+' · tentando iniciar automaticamente';
    f.onload=()=>{
      if(S.playing!==P)return;
      let localVideo=null;
      try {localVideo=f.contentDocument&&f.contentDocument.querySelector('video');}catch(_){/* outra origem: não inspecionar */}
      if(localVideo){
        try {const p=localVideo.play();if(p&&p.catch)p.catch(()=>{});}catch(_){}
        $('osdMeta').textContent='Reprodução automática solicitada ao player acessível · '+provider;
      }else{
        const code=reportSource('M105','Iframe abriu; player externo não confirma reprodução automática',result.url);
        $('osdMeta').textContent=code+' · Player externo: áudio, Play e tela cheia dependem do site/WebView';
      }
    };
    f.onerror=()=>{if(S.playing===P){const code=reportSource('M111','Falha reportada pelo iframe; pode haver bloqueio de incorporação',result.url);$('osdMeta').textContent=code+' · Player indisponível. Aperte OK para diagnóstico.'}};
  }
  osd();
 }catch(err){if(S.playing!==P)return;const code=reportSource(err.code||'M104',String(err&&err.message||err),item.url);SRC.playerError=code+' · Reprodução indisponível: '+String(err&&err.message||err);closePlayer();toast(SRC.playerError,'alert')}
}
function playLive(list,i,from){const c=list[i];if(!c)return;S.ctx={kind:'live',list,i,from};playChannel(c)}
function playChannel(c){saveProgress();stopPlayer();S.playing={kind:'live',c};const bank=S.ctx.from==='live'?L.bank:c.bank;
 store['lastChannel_'+bank]=normal(c.name);if(S.ctx.from==='live')store.lastBank=L.bank;store.lastLive={bank,name:c.name};persist();showPlayer();
 setOsd({icon:'radio',badge:'AO VIVO',number:'Canal '+pad3(c.number),title:c.name,meta:c.label+' · '+(BANKS[c.bank]||c.bank),help:[['↑ ↓','Trocar canal'],['← →','Volume'],['OK','Lista de canais'],['VOLTAR segurar 3 s','Opções']]});
 $('volumeOsd').classList.add('hidden');osd();const v=$('video'),f=$('embed');
 // Identifica o programa exibido somente quando existe uma correspondência real em XMLTV.
 probeProgram(c,false).then(()=>{if(S.playing&&S.playing.kind==='live'&&S.playing.c===c)refreshProgramTiles()});

 if(c.embed&&isURL(c.embed)&&!(c.url&&c.bank==='BCN2')){
  f.style.display='block';f.className=(c.bank==='BCN2'&&c.name!=='Chaves 24H'?'zoom-bcn2':'');f.removeAttribute('sandbox');if(c.bank==='BCN2')f.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-presentation');
  if(c.bank==='BCN1'&&normal(c.name)==='cartoonito'&&window.MophieLivePlayer){
   $('osdMeta').textContent='Cartoonito · procurando Player 1 publicado na página';
   MophieLivePlayer.cartoonito(c.embed).then(src=>{if(S.playing&&S.playing.kind==='live'&&S.playing.c===c){f.src=src||c.embed;if(!src)$('osdMeta').textContent='Cartoonito · escolha Player 1 na página caso apareça a seleção'}})
    .catch(()=>{if(S.playing&&S.playing.kind==='live'&&S.playing.c===c){f.src=c.embed;$('osdMeta').textContent='Cartoonito · Player 1 não detectado automaticamente'}});
   return;
  }
  f.src=c.embed;return}
 if(c.url&&isURL(c.url)){v.style.display='block';v.volume=S.volume/100;attachSource(c.url,{live:true,name:c.name});return}
 toast('Este canal consta no catálogo, mas está sem player. Atualize o banco.','alert');S.playerTimer=setTimeout(osd,2500)}
function tune(d){const x=S.ctx;if(!x||x.kind!=='live'||!x.list.length)return;x.i=(x.i+d+x.list.length)%x.list.length;playChannel(x.list[x.i])}
function playNumber(digit){S.numBuf+=digit;clearTimeout(S.numTimer);osd();toast('Canal '+S.numBuf,'tv');
 S.numTimer=setTimeout(()=>{const n=Number(S.numBuf);S.numBuf='';const x=S.ctx;let j=x.list.findIndex(c=>c.number===n);
  if(j<0&&n>0&&n<=L.channels.length){x.list=L.channels;x.from='live';j=n-1}if(j>=0){x.i=j;playChannel(x.list[j])}else toast('Número de canal indisponível','alert')},900)}
async function playVod(m,opt){opt=opt||{};saveProgress();stopPlayer();const from=S.playing&&S.ctx?S.ctx.from:S.section;S.ctx={kind:'vod',from};const P=S.playing={kind:'vod',meta:m};showPlayer();
 const ep=m.type==='episode';
 setOsd({icon:ep?'clapper':'film',badge:ep?'SÉRIE':'FILME',number:ep?'T'+m.season+' · E'+m.num:'',title:ep?m.sname:m.name,meta:ep?m.name:[m.year,m.genre].filter(Boolean).join(' · '),progress:true,help:[['OK','Pausar'],['← →','−10 s / +30 s'],['↑ ↓','Volume'],['VOLTAR','Sair']]});
 $('volumeOsd').classList.add('hidden');$('osdTime').textContent='Carregando…';$('osdDur').textContent='';$('osdFill').style.width='0';osd(true);
 let url;try{url=await CAT.streamUrl(m.path)}catch(e){if(S.playing===P){toast('Não foi possível abrir o vídeo: '+e.message,'alert');osd()}return}
 if(S.playing!==P)return;const prog=store.vodProg[m.id],pos=opt.resume&&prog&&prog.p>15&&prog.p<prog.d-30?prog.p:0;
 const v=$('video');v.style.display='block';v.volume=S.volume/100;S.lastSave=Date.now();attachSource(url,{live:false,start:pos,name:ep?m.sname:m.name});
 v.ontimeupdate=()=>{if(isFinite(v.duration)&&v.duration-v.currentTime<.6&&v.currentTime>5){vodEnded();return}if(Date.now()-S.lastSave>10000){S.lastSave=Date.now();saveProgress()}if(!$('osd').classList.contains('hidden'))updateProgress()};
 v.onended=vodEnded;osd()}
function updateProgress(){if(!S.playing||S.playing.kind!=='vod')return;const v=$('video'),d=v.duration;if(!isFinite(d)||d<=0)return;
 $('osdTime').textContent=fmtTime(v.currentTime);$('osdDur').textContent=fmtTime(d);$('osdFill').style.width=(v.currentTime/d*100)+'%'}
function saveProgress(){const P=S.playing;if(!P||P.kind!=='vod')return;const v=$('video'),pos=v.currentTime||0,dur=v.duration,m=P.meta;if(!isFinite(dur)||dur<=0||pos<5)return;
 if(pos/dur>=.93){store.vodWatched[m.id]=1;delete store.vodProg[m.id]}else store.vodProg[m.id]={p:Math.floor(pos),d:Math.floor(dur),t:Date.now(),m};
 if(m.type==='episode')store.vodSeriesLast[m.sid]={id:m.id,t:Date.now()};
 const keys=Object.keys(store.vodProg);if(keys.length>40)keys.sort((a,b)=>store.vodProg[a].t-store.vodProg[b].t).slice(0,keys.length-40).forEach(k=>delete store.vodProg[k]);
 persist()}
function seek(d){const v=$('video');if(!isFinite(v.duration))return;v.currentTime=Math.max(0,Math.min(v.duration-1,v.currentTime+d));osd()}
function togglePause(){const v=$('video');if(v.paused){v.play().catch(()=>{});$('pauseMark').classList.add('hidden');osd()}else{v.pause();$('pauseMark').innerHTML=ic('pause');$('pauseMark').classList.remove('hidden');saveProgress();osd(true)}}
async function vodEnded(){const P=S.playing;if(!P||P.kind!=='vod'||P.ended)return;P.ended=true;const m=P.meta;store.vodWatched[m.id]=1;delete store.vodProg[m.id];if(m.type==='episode')store.vodSeriesLast[m.sid]={id:m.id,t:Date.now()};persist();
 if(m.type==='episode'){try{const data=await CAT.seasons(m.sid),flat=flatEpisodes(data),i=flat.findIndex(e=>e.id===m.id);
   if(S.playing===P&&flat[i+1]){toast('Próximo episódio','skipNext');playVod(epMeta({id:m.sid,name:m.sname,poster:m.poster,wide:m.wide},flat[i+1]),{resume:false});return}}catch(e){}}
 if(S.playing===P)closePlayer()}
function leavePlayer(){clearTimeout(vodBackTimer);vodBackTimer=null;if(!S.playing)return;
 if(S.playing.kind==='sourceVod'&&S.playing.meta){const v=$('video');const prev=store.sourceProg[sourceHistoryKey(S.playing.meta,FL.provider)];if(prev&&prev.kind==='video'&&isFinite(v.currentTime)&&isFinite(v.duration)&&v.duration>0)rememberSource(S.playing.meta,FL.provider,'video',prev.url,v.currentTime,v.duration)}S.menuOverlay=false;document.body.classList.remove('menu-over-video');saveProgress();stopPlayer();$('player').hidden=true;$('app').style.display='';S.playing=null}
// Retorna à tela de origem mantendo o foco no item reproduzido.
function closePlayer(){const x=S.ctx;leavePlayer();if(!x){go(S.section);return}
 if(x.kind==='live'){const c=x.list[x.i];if(x.from==='live'){const j=c?L.list.findIndex(y=>y.id===c.id):-1;if(j>=0)L.idx=j;go('live','grid')}else{if(x.from==='favorites')F.idx[0]=x.i;go(x.from)}return}
 if(x.kind==='sourceVod'){go(SRC.choiceResult?'sourceChoices':'sourceDetails');return}
 go(x.from)}

/* ---------- legendas do player interno ---------- */
if(typeof store.subtitlesEnabled!=='boolean')store.subtitlesEnabled=false;
if(typeof store.subtitleLang!=='string')store.subtitleLang='pt';
function subtitleEntries(){
 if(!S.playing)return [];
 const v=$('video'),h=S.hls;
 if(v.style.display==='none'||$('embed').style.display==='block')return [];
 if(h&&Array.isArray(h.subtitleTracks)&&h.subtitleTracks.length)return h.subtitleTracks.map((x,i)=>({mode:'hls',index:i,lang:x.lang||'',name:x.name||x.lang||'Legenda '+(i+1)}));
 return [...v.textTracks].filter(x=>x.kind==='subtitles'||x.kind==='captions').map((x,i)=>({mode:'html',index:i,lang:x.language||'',name:x.label||x.language||'Legenda '+(i+1)}));
}
function activeSubtitleIndex(entries){const lang=store.subtitleLang.toLowerCase();const match=entries.findIndex(t=>lang&&(t.lang||'').toLowerCase().startsWith(lang));return match>=0?match:0}
function applySubtitlePreference(){
 const entries=subtitleEntries(),v=$('video');
 if(!entries.length)return false;
 const index=activeSubtitleIndex(entries);
 if(S.hls&&entries[0].mode==='hls'){
  S.hls.subtitleDisplay=store.subtitlesEnabled;
  S.hls.subtitleTrack=store.subtitlesEnabled?index:-1;
 }else{
  const tracks=[...v.textTracks].filter(x=>x.kind==='subtitles'||x.kind==='captions');
  tracks.forEach((track,i)=>{track.mode=store.subtitlesEnabled&&i===index?'showing':'disabled'});
 }
 return true;
}
function toggleSubtitles(){const entries=subtitleEntries();if(!entries.length){toast('Legendas indisponíveis neste player','info');return}
 store.subtitlesEnabled=!store.subtitlesEnabled;applySubtitlePreference();persist();toast('Legendas '+(store.subtitlesEnabled?'ativadas':'desativadas'),'info')}
function nextSubtitleLanguage(){const entries=subtitleEntries();if(entries.length<2){toast('Este vídeo não oferece outro idioma de legenda','info');return}
 const current=activeSubtitleIndex(entries),next=entries[(current+1)%entries.length];store.subtitleLang=next.lang||'';
 store.subtitlesEnabled=true;applySubtitlePreference();persist();toast('Legenda: '+next.name,'info')}
function prepareSubtitleEvents(){
 const v=$('video');v.addEventListener('loadedmetadata',applySubtitlePreference,{once:true});
 if(S.hls&&window.Hls){S.hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED,applySubtitlePreference)}
}
/* ---------- programação do MeuGuia/mi.tv; XMLTV deixou de ser fonte ---------- */
function refreshEpgNow(){const c=currentEpgChannel();if(!c){toast('Selecione primeiro um canal','info');return}
 toast('Atualizando MeuGuia/mi.tv…','refresh');
 probeProgram(c,true).then(x=>{toast(x&&x.items.length?'Programação do '+x.source+' atualizada':'Programação indisponível para este canal',x&&x.items.length?'check':'info')});
}
function currentEpgChannel(){if(S.playing&&S.playing.kind==='live')return S.playing.c;
 if(S.section==='live')return L.list[L.idx]||L.channels[0];return null}
function guideTime(ms){try{return new Date(ms).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'})}catch(e){return '--:--'}}
function renderGuide(){if(!GUIDE.open)return;
 const container=$('epgItems'),now=Date.now();
 container.innerHTML=GUIDE.items.map((p,i)=>'<div class="epg-item'+(p.start<=now&&p.stop>now?' on-air':'')+'"><span>'+guideTime(p.start)+'–'+guideTime(p.stop)+'</span><b>'+esc(p.title)+'</b>'+(p.start<=now&&p.stop>now?'<strong>AGORA</strong>':'')+'</div>').join('');
 [...container.children].forEach((el,i)=>el.classList.toggle('focused',i===GUIDE.idx));
 const item=GUIDE.items[GUIDE.idx];$('epgDescription').textContent=item&&GUIDE.description?(item.desc||item.category||'Sem sinopse disponível.'):'OK mostra detalhes · VOLTAR fecha';
 if(item){const el=container.children[GUIDE.idx];if(el&&el.scrollIntoView)el.scrollIntoView({block:'nearest'})}}
function closeEpg(){GUIDE.open=false;GUIDE.items=[];GUIDE.description=false;$('epgPanel').hidden=true}
async function tryPublishedGuide(channel){
 if(!window.MophiePublishedGuide){$('epgStatus').textContent='Guia MeuGuia/mi.tv indisponível';return}
 try{
  $('epgStatus').textContent='Consultando MeuGuia e mi.tv…';
  const rec=await probeProgram(channel,false);
  if(!GUIDE.open||GUIDE.channel!==channel)return;
  GUIDE.items=(rec&&rec.items||[]).filter(p=>p.stop>Date.now()-3600000&&p.start<Date.now()+86400000).slice(0,85);
  GUIDE.idx=Math.max(0,GUIDE.items.findIndex(x=>x.start<=Date.now()&&x.stop>Date.now()));
  $('epgStatus').textContent=GUIDE.items.length?'Fonte: '+rec.source+' · grade do canal ('+GUIDE.items.length+' programas)':'Programação indisponível: não foi possível confirmar no MeuGuia/mi.tv';
  renderGuide();
 }catch(e){if(GUIDE.open&&GUIDE.channel===channel)$('epgStatus').textContent='Não foi possível consultar o MeuGuia/mi.tv'}
}
function openEpg(){if(GUIDE.open){closeEpg();return}const c=currentEpgChannel();if(!c){toast('Selecione primeiro um canal de TV ao Vivo','info');return}
 GUIDE.open=true;GUIDE.idx=0;GUIDE.items=[];GUIDE.description=false;GUIDE.channel=c;
 $('epgPanel').hidden=false;$('epgChannel').textContent=c.name;$('epgStatus').textContent='Carregando programação MeuGuia/mi.tv…';$('epgItems').innerHTML='';$('epgDescription').textContent='Fonte: MeuGuia/mi.tv · apenas programas identificados para este canal.';
 tryPublishedGuide(c);
}
function guideKey(key){if(key==='Escape'||key==='Backspace'||key==='Info'||key==='Guide'){closeEpg();return}
 if(!GUIDE.items.length)return;
 if(key==='ArrowDown'||key==='ArrowUp'){GUIDE.idx=Math.max(0,Math.min(GUIDE.items.length-1,GUIDE.idx+(key==='ArrowDown'?1:-1)));GUIDE.description=false;renderGuide()}
 if(key==='Enter'||key==='NumpadEnter'){GUIDE.description=!GUIDE.description;renderGuide()}}

/* ---------- gaveta de opções ---------- */
// Ação contextual do item em foco (ou em reprodução): favoritar, remover etc.
function currentCtx(){const z=zone();
 if(S.playing){const P=S.playing;return P.kind==='live'?chanCtx(P.c):vodCtx(P.meta.type==='episode'?{id:P.meta.sid,type:'series',name:P.meta.sname,poster:P.meta.poster,wide:P.meta.wide}:P.meta)}
 return z&&z.ctx&&S.zone!=='side'?z.ctx(z.idx):null}
function openDrawer(ctx,restoreZone){const items=[],c=ctx===undefined?currentCtx():ctx,sec=S.section;
 if(c)items.push({ctx:true,icon:c.icon,label:c.label,run:()=>{c.run();if(restoreZone&&!S.playing&&S.section===sec&&S.zones[restoreZone])activate(restoreZone)}});
 if(S.playing&&S.playing.kind==='sourceVod'){
  items.push({icon:'info',label:'Ver código do diagnóstico',run:showDiagnostic});
  items.push({icon:'refresh',label:'Escolher outro episódio / player',run:()=>{leavePlayer();go(SRC.choiceResult?'sourceChoices':'sourceDetails')}});
  items.push({icon:'alert',label:'Tela preta / robô Android',run:()=>{reportSource('M106','Tela preta ou ícone do Android visto na TCL',S.playing&&S.playing.meta&&S.playing.meta.url);showDiagnostic()}});
  items.push({icon:'settings',label:'Player exige seleção manual',run:()=>{reportSource('M109','O iframe exige interação que não foi exposta ao aplicativo',S.playing&&S.playing.meta&&S.playing.meta.url);showDiagnostic()}});
 }
 if(S.playing&&(S.playing.kind==='sourceVod'||(S.playing.kind==='live'&&S.playing.c&&S.playing.c.embed))){
  items.push({icon:'mousePointer',label:'Mouse virtual: '+(window.MophieVirtualMouse&&MophieVirtualMouse.isActive()?'desativar':'ativar'),run:()=>{
   if(!window.MophieVirtualMouse||!MophieVirtualMouse.toggle()){toast('Mouse virtual desativado ou player externo ainda não aberto','info');return}
   toast('Mouse triangular: setas movem, OK aciona controles acessíveis; o cursor some após 10 s','info');
  }});
 }
 items.push({icon:'tv',label:'Testar tela preta (vídeo da TCL)',run:()=>{if(S.playing)leavePlayer();if(window.MophieVideoTest)MophieVideoTest.open()}});
 if(S.playing){
  const tracks=subtitleEntries();
  items.push({icon:'subtitles',label:tracks.length?'Legendas: '+(store.subtitlesEnabled?'Ativadas':'Desativadas'):'Legendas: indisponíveis',run:toggleSubtitles});
  if(tracks.length>1)items.push({icon:'languages',label:'Idioma da legenda: '+tracks[activeSubtitleIndex(tracks)].name,run:nextSubtitleLanguage});
 }
 if(currentEpgChannel()){items.push({icon:'info',label:'Guia de programação (EPG)',run:()=>openEpg()});items.push({icon:'refresh',label:'Atualizar programação EPG',run:refreshEpgNow})}
 SIDE.forEach(id=>{if(id==='settings')items.push({icon:'refresh',label:'Atualizar canais',run:()=>refreshAll()});items.push({icon:SECTIONS[id].icon,label:SECTIONS[id].title,run:()=>{leavePlayer();go(id)}})});
 items.push({icon:'info',label:'Sobre',run:()=>{leavePlayer();go('about')}},{icon:'x',label:'Fechar',run:()=>{}});
 S.drawer={open:true,idx:0,items};
 $('drawerItems').innerHTML=items.map(it=>'<div class="drawer-item'+(it.ctx?' ctx divider':'')+'">'+ic(it.icon)+'<span>'+esc(it.label)+'</span></div>').join('');
 $('drawer').hidden=false;document.body.classList.remove('side-open');drawerFocus()}
function drawerFocus(){[...$('drawerItems').children].forEach((e,i)=>e.classList.toggle('focused',i===S.drawer.idx))}
function closeDrawer(){S.drawer.open=false;$('drawer').hidden=true;document.body.classList.toggle('side-open',S.zone==='side'&&!S.playing)}
function drawerKey(key){const d=S.drawer;if(key==='ArrowUp'||key==='ArrowDown'){d.idx=Math.max(0,Math.min(d.items.length-1,d.idx+(key==='ArrowUp'?-1:1)));drawerFocus();return}
 if(key==='Enter'||key==='NumpadEnter'){const it=d.items[d.idx];closeDrawer();it.run()}}

/* ---------- atualização de bancos (fontes preservadas da v1.0.2) ---------- */
async function updateRei(){let errors=[];for(const host of ['https://api.reidoscanais.st/channels','https://api.reidoscanais.cam/channels']){try{const ctrl=new AbortController;const timer=setTimeout(()=>ctrl.abort(),9500);const r=await fetch(host,{signal:ctrl.signal});clearTimeout(timer);if(!r.ok)throw Error('HTTP '+r.status);let d=await r.json();if(!Array.isArray(d))d=d.data||d.channels||[];if(!Array.isArray(d)||!d.length||d.length>2000)throw Error('Resposta de catálogo inválida');let ch=[];for(const item of d){const name=String(item.name||item.nome||'').slice(0,120);if(!name)continue;const urls=(item.embeds||[]).map(x=>x&&x.embed_url).filter(isURL),direct=urls.find(x=>/\.m3u8(?:[?#]|$)/i.test(x))||'',iframe=urls.find(x=>x!==direct)||'';ch.push({id:'BCN1:'+normal(name),bank:'BCN1',name,category:String(item.category||'Outros'),url:direct,embed:iframe})}if(ch.length){const chaves=(DATA.BCN1||[]).find(c=>c.name==='Chaves 24H');if(chaves)ch.push(chaves);embeddedCatalog.BCN1=ch;applyChannelOverrides();store.rei=embeddedCatalog.BCN1;store.updated=Date.now();persist();return ch.length}throw Error('Sem canais válidos')}catch(e){errors.push(e.message)}}throw Error(errors.join(' / '))}
function parseM3u(t,bank){const lines=t.split(/\r?\n/);let rows=[],label='',group='Outros',tvgId='';for(let l of lines){l=l.trim();if(l.startsWith('#EXTINF')){label=l.split(',').slice(1).join(',').trim();group=(l.match(/group-title="([^"]+)"/)||[])[1]||'Outros';tvgId=(l.match(/tvg-id="([^"]+)"/)||[])[1]||''}else if(l&&!l.startsWith('#')&&isURL(l)&&label){rows.push({id:bank+':'+normal(label),bank,name:label,category:group,tvgId,url:l,embed:''});label=''}}return rows}
async function updateIptv(){let sources=['https://iptv-org.github.io/iptv/countries/br.m3u','https://iptv-org.github.io/iptv/languages/por.m3u'],uniq=new Map();for(let source of sources){try{const c=new AbortController(),ti=setTimeout(()=>c.abort(),11000),r=await fetch(source,{signal:c.signal});clearTimeout(ti);if(!r.ok)continue;const t=await r.text();for(const ch of parseM3u(t,'BCN3')){if(!uniq.has(normal(ch.name)))uniq.set(normal(ch.name),ch)}}catch(e){console.warn('IPTV atualização:',e)}}if(uniq.size){const ch=[...uniq.values()];const chaves=(DATA.BCN3||[]).find(c=>c.name==='Chaves 24H');if(chaves)ch.push(chaves);embeddedCatalog.BCN3=ch;store.iptv=ch;store.updated=Date.now();persist();return ch.length}throw Error('Playlists não permitiram atualização neste dispositivo')}

async function updateCxtv(){
 if(!window.MophieCXTV)throw Error('Leitor CXTV ausente');
 const fresh=await MophieCXTV.load();
 if(!Array.isArray(fresh)||!fresh.length)throw Error('CXTV: HTML indisponível ou sem canais reconhecidos');
 const merged=new Map();[...MophieCXTV.seed,...fresh].forEach(x=>{if(x&&isURL(x.embed))merged.set(x.embed,x)});
 embeddedCatalog.BCN4=[...merged.values()];store.cxtv=embeddedCatalog.BCN4;store.updatedCxtv=Date.now();persist();return embeddedCatalog.BCN4.length
}

async function refreshAll(){if(S.refreshRunning)return;S.refreshRunning=true;toast('Atualizando bancos públicos…','refresh');const results=await Promise.allSettled([updateRei(),updateIptv(),updateCxtv()]);S.refreshRunning=false;
 L.counts=bankCounts();reloadLive();if(!S.playing&&!S.drawer.open&&['live','favorites','settings'].indexOf(S.section)>=0)go(S.section,S.zone==='side'?'side':S.zone);
 let ok=results.filter(r=>r.status==='fulfilled'),fails=results.filter(r=>r.status==='rejected');
 toast(ok.length?'Atualização: '+ok.map(x=>x.value+' canais').join(' + ')+(fails.length?' • outras fontes mantidas':''):'Não foi possível atualizar pela rede. Catálogos locais preservados.',ok.length?'check':'alert');if(ok.length&&!guideSyncInProgress)startGuideSync(false).catch(()=>{})}

/* ---------- controle remoto ---------- */
let vodBackTimer=null,lastVodBack=0;
// Um toque VOLTAR navega normalmente. Segurar por 3 s abre opções quando o controle
// envia repetição de tecla; MENU físico permanece como alternativa sem repetição.
const HOLD_REPEAT_MAX_GAP=1000;
let holdBack={start:0,last:0,opened:false,ctx:null,zone:null};
function clearBackHold(){holdBack.start=0;holdBack.last=0;holdBack.opened=false;holdBack.ctx=null;holdBack.zone=null}
function remoteBack(){
 if(window.MophieUpdater&&MophieUpdater.isOpen()){MophieUpdater.key('Escape');return}
 if(window.MophieVirtualMouse&&MophieVirtualMouse.isActive()){MophieVirtualMouse.disable();return}
 if(window.MophieVideoTest&&MophieVideoTest.isOpen()){MophieVideoTest.close();return}
 if(DIAG.open){closeDiagnostic();return}
 const now=Date.now();
 if(holdBack.start&&now-holdBack.last<=HOLD_REPEAT_MAX_GAP){
  holdBack.last=now;
  if(!holdBack.opened&&now-holdBack.start>=HOLD_BACK_MS){
   holdBack.opened=true;
   clearTimeout(vodBackTimer);vodBackTimer=null;
   if(GUIDE.open)closeEpg();
   if(S.drawer.open)closeDrawer();
   openDrawer(holdBack.ctx,holdBack.zone);
  }
  return;
 }
 holdBack={start:now,last:now,opened:false,ctx:currentCtx(),zone:S.playing?null:S.zone};
 if(GUIDE.open){closeEpg();return}
 if(S.drawer.open){closeDrawer();return}
 if(S.playing&&(S.playing.kind==='vod'||S.playing.kind==='sourceVod')){
  // Um toque sai do filme; ao segurar, mantém as opções acessíveis através do menu físico.
  closePlayer();return;
 }
 back();
}
function back(){if(S.menuOverlay){closeVideoMenu();return}if(S.playing){openVideoMenu();return}const z=zone();if(z&&z.back&&S.zone!=='side'){z.back();return}
 if(S.zone!=='side'){activate('side');return}toast('Segure VOLTAR por 3 s ou use MENU para opções','info')}
function playerKey(key){const P=S.playing;
 if(key==='AudioVolumeMute'){if(S.volume){store.unmuted=S.volume;volume(-S.volume)}else volume(store.unmuted||65);return}
 if(P.kind==='live'){if(key==='ArrowUp'){tune(-1);return}if(key==='ArrowDown'){tune(1);return}if(key==='ArrowRight'){volume(5);return}if(key==='ArrowLeft'){volume(-5);return}
  if(key==='Enter'||key==='NumpadEnter'){openVideoMenu();return}if(/^[0-9]$/.test(key)){playNumber(key);return}return}
 if(P.kind==='sourceVod'){if(key==='Enter'||key==='NumpadEnter'){openDrawer();return}if(key==='MediaPlayPause'&&$('video').style.display==='block'){togglePause();return}return}
 if(key==='Enter'||key==='NumpadEnter'){togglePause();return}if(key==='MediaPlayPause'){togglePause();return}if(key==='ArrowLeft'){seek(-10);return}if(key==='ArrowRight'){seek(30);return}
 if(key==='ArrowUp'){volume(5);return}if(key==='ArrowDown'){volume(-5);return}}
const NAV=['ChannelUp','ChannelDown','Info','Guide','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter','NumpadEnter','Escape','Backspace','Menu','m','M','ContextMenu'];
const DIRS={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};
function onKey(ev){const key=ev.key;
 if(!S.playing&&!S.drawer.open&&!(window.MophieUpdater&&MophieUpdater.isOpen())&&
    (S.section==='sourceSearch'||S.section==='profileEdit'||((S.section==='movies'||S.section==='series')&&V[S.section==='movies'?'movie':'series'].cat===0))){
  const ch=key===' '?' ':key.length===1&&/[a-z0-9À-ÿ]/i.test(key)?key.toUpperCase():null;
  if(ch!==null||key==='Backspace'){
   if(ev.preventDefault)ev.preventDefault();if(ev.stopPropagation)ev.stopPropagation();
   if(S.section==='sourceSearch'){SRC.search=key==='Backspace'?SRC.search.slice(0,-1):(SRC.search+ch).slice(0,55);SRC.searchResultIdx=0;go('sourceSearch','srcSearchKeys');return}
   if(S.section==='profileEdit'){FL.editName=key==='Backspace'?FL.editName.slice(0,-1):(FL.editName+ch).slice(0,18);const t=$('editTitle');if(t)t.textContent=FL.editName||'Digite o nome';return}
   const st=V[S.section==='movies'?'movie':'series'];st.q=key==='Backspace'?st.q.slice(0,-1):(st.q+ch).slice(0,40);st.res=0;
   renderSearch(S.section==='movies'?'movie':'series');activate('kb',st.kb);return;
  }
 }
if(window.MophieUpdater&&MophieUpdater.isOpen()){if(ev.preventDefault)ev.preventDefault();if(ev.stopPropagation)ev.stopPropagation();MophieUpdater.key(key);return}if(window.MophieVideoTest&&MophieVideoTest.isOpen()){ev.preventDefault();ev.stopPropagation();MophieVideoTest.key(key);return}if(DIAG.open){if(ev.preventDefault)ev.preventDefault();diagnosticKey(key);return}if(!NAV.includes(key)&&!/^[0-9]$/.test(key)&&!['f','F','s','S','MediaPlayPause','AudioVolumeMute'].includes(key))return;ev.preventDefault();ev.stopPropagation();
 if(GUIDE.open){guideKey(key);return}
 if(key==='Escape'||key==='Backspace'){remoteBack();return}clearBackHold();if(vodBackTimer){clearTimeout(vodBackTimer);vodBackTimer=null}
 if(key==='Menu'||key==='ContextMenu'||key==='m'||key==='M'){clearTimeout(vodBackTimer);vodBackTimer=null;if(S.drawer.open)closeDrawer();else openDrawer();return}
 if(S.drawer.open){drawerKey(key);return}
 if(window.MophieVirtualMouse&&MophieVirtualMouse.isActive()&&MophieVirtualMouse.key(key)){if(MophieVirtualMouse.state.lastError==='M117'&&(key==='Enter'||key==='NumpadEnter'))toast('M117 · Player de outro site: este APK ainda precisa de suporte de toque nativo para clicar no iframe','alert');return}
 if(key==='ChannelUp'||key==='ChannelDown'){if(S.playing&&S.playing.kind==='live'){tune(key==='ChannelUp'?1:-1);return}return}
 if(key==='Info'||key==='Guide'){openEpg();return}
 if(S.menuOverlay&&(key==='Enter'||key==='NumpadEnter')&&S.overlayReturnPending){closeVideoMenu();return}
 if(S.menuOverlay&&DIRS[key])S.overlayReturnPending=false;
 if(S.playing&&!S.menuOverlay){playerKey(key);return}
 if(DIRS[key]){move(DIRS[key]);return}
 if(key==='Enter'||key==='NumpadEnter'){ok();return}
 if(key==='f'||key==='F'||key==='s'||key==='S'){const z=zone(),c=z&&z.ctx&&S.zone!=='side'?z.ctx(z.idx):null;if(c)c.run();return}
 if(/^[0-9]$/.test(key)&&S.section==='live'){jumpNumber(key)}}
document.addEventListener('keydown',onKey,true);
// Teclas nativas podem consumir keyup; por isso o relógio também mede repetição dos keydown.
document.addEventListener('keyup',ev=>{if(ev.key==='Escape'||ev.key==='Backspace')clearBackHold()},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden){saveProgress();try{$('video').pause()}catch(e){}}});
window.mophieBack=()=>remoteBack();window.mophieInfo=()=>{if(window.MophieUpdater&&MophieUpdater.isBlocking())return;openEpg()};window.mophieMenu=()=>{if(window.MophieUpdater&&MophieUpdater.isBlocking())return;if(S.drawer.open)closeDrawer();else openDrawer()};
// Chamado pela Activity.dispatchKeyEvent antes que a WebView consuma os eventos do controle da Android TV.
window.mophieRemoteKey=(key)=>onKey({key,preventDefault(){},stopPropagation(){}});
window.addEventListener('resize',()=>{if(S.zone)applyFocus()});
 let sourceRepaintTimer=null;
 window.addEventListener('mophie:catalog-updated',ev=>{
  if(!ev.detail||ev.detail.name!=='RedeCanais'||S.playing)return;
  if(S.section!=='sourceSearch'&&S.section!=='sourceCatalog')return;
  clearTimeout(sourceRepaintTimer);
  sourceRepaintTimer=setTimeout(()=>{if(!S.playing&&(S.section==='sourceSearch'||S.section==='sourceCatalog'))go(S.section,S.zone)},2200);
 });
function updateClock(){$('clock').textContent=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});const on=navigator.onLine;$('net').className=on?'':'off';$('net').innerHTML=on?ic('wifi'):ic('wifiOff')+'Sem conexão'}
window.addEventListener('online',updateClock);window.addEventListener('offline',updateClock);

function boot(){setInterval(()=>{refreshProgramTiles();if(S.section==='live')fetchGuideForTiles(false)},60000);setInterval(()=>startGuideSync(false).catch(()=>{}),60*60000);if(Array.isArray(store.rei)&&store.rei.length)embeddedCatalog.BCN1=store.rei;if(Array.isArray(store.iptv)&&store.iptv.length)embeddedCatalog.BCN3=store.iptv;
 if(Array.isArray(store.cxtv)&&store.cxtv.length)embeddedCatalog.BCN4=store.cxtv;
 applyChannelOverrides();
 buildSide();updateClock();setInterval(updateClock,20000);L.counts=bankCounts();loadBank(L.bank);
 const j=L.list.findIndex(c=>normal(c.name)===store['lastChannel_'+L.bank]);if(j>=0)L.idx=j;
 go('live',store.openBanks?'banks':'grid');
 startGuideSync(true).catch(e=>{hideGuideSplash();console.warn('Erro na sincronização EPG',e)});
 // Checagem de atualização já ocorreu antes de iniciar a TV (startGate).
 if(Date.now()-(store.updated||0)>6*3600000)setTimeout(()=>{if(navigator.onLine)refreshAll()},2500);
 // Pré-carrega o catálogo de filmes/séries em segundo plano, sem disputar a reprodução.
 setTimeout(()=>{if(navigator.onLine&&!CAT.loaded()&&!S.playing)CAT.load().catch(()=>{})},18000)}
window.__mophie={S,L,V,store,go,version:VERSION,mouse:window.MophieVirtualMouse};
if(window.MophieUpdater&&typeof MophieUpdater.startGate==='function')MophieUpdater.startGate(boot);else {console.error('Verificador obrigatorio ausente: aplicativo bloqueado');document.getElementById('mophie-update-modal').hidden=false;document.getElementById('mophie-update-status').textContent='Verificador indisponivel';document.getElementById('mophie-update-caption').textContent='Reinstale a Mophie TV oficial.';}})();
