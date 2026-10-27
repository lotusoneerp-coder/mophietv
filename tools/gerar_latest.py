"""Gera o latest.json para publicar JUNTO com um APK assinado de fato.
Uso: python tools/gerar_latest.py caminho/do.apk 1.6.3 32
"""
import hashlib, json, pathlib, sys, shutil
if len(sys.argv)!=4:
    sys.exit('Uso: python tools/gerar_latest.py <apk_assinado> <versao> <versionCode>')
p=pathlib.Path(sys.argv[1]).resolve()
if not p.is_file() or p.suffix.lower()!='.apk':sys.exit('Informe um APK assinado existente')
version=sys.argv[2];code=int(sys.argv[3]);assert len(version.split('.'))==3
if not p.name.startswith('MophieTV_TCL_v'+version+'_'):
    sys.exit('Nome do APK nao corresponde a versao')
output=pathlib.Path('upload_hostinger');output.mkdir(exist_ok=True)
sha=hashlib.sha256(p.read_bytes()).hexdigest()
manifest={'appId':'com.mophie.tv','channel':'tcl-completa','version':version,'versionCode':code,
          'apk':p.name,'sha256':sha,'sizeBytes':p.stat().st_size,
          'notes':['Atualização nativa diretamente na TV','Confirmar a instalação no Android'], 'mandatory':True}
(output/'latest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
shutil.copy2(p,output/p.name)
print('Gerado:',output.resolve());print('SHA-256:',sha)
