/* Testes offline da leitura de filmes IPTV, sem usar contas ou servidores reais. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../app/js/iptv-vod.js'),'utf8');
const context=vm.createContext({window:{},URL,Date,console});
vm.runInContext(source,context,{filename:'iptv-vod.js'});
const IPTV=context.window.MophieIptvVod;
test('identifica exemplo de URL Xtream sem acessar a rede',()=>{
 const x=IPTV.xtreamFromVideo('http://example.org/movie/cliente%40tv/senha-local/6250764.mp4');
 assert.equal(x.username,'cliente@tv');
 assert.equal(x.password,'senha-local');
 assert.equal(x.example.id,'6250764');
 assert.equal(x.origin,'http://example.org');
});
test('importa títulos de playlist M3U e ignora URLs inválidas',()=>{
 const content='#EXTM3U\n#EXTINF:-1 group-title="Filmes",Filme Azul\nhttps://example.org/filme1.mp4\n#EXTINF:-1 group-title="Filmes",Filme Verde\nhttps://example.org/filme2.mp4\n#EXTINF:-1,Inválido\njavascript:alert(1)';
 const rows=IPTV.parseM3u(content);
 assert.equal(rows.length,2);
 assert.equal(rows[0].name,'Filme Azul');
 assert.equal(rows[1].category,'Filmes');
});
test('importa lista Xtream e rejeita identificadores impróprios',()=>{
 const rows=IPTV.normalizeXtream([
  {stream_id:6250764,name:'Filme A',container_extension:'mp4'},
  {stream_id:6250765,name:'Filme B',container_extension:'mkv'},
  {stream_id:'invalido',name:'Não entra',container_extension:'mp4'}
 ]);
 assert.equal(rows.length,2);
 assert.equal(rows[1].streamId,6250765);
});
test('URL genérica não é interpretada como conta Xtream',()=>{
 assert.equal(IPTV.xtreamFromVideo('https://example.org/filme.mp4'),null);
});
