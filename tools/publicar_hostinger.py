"""Publica APK assinado e latest.json na pasta MophieTV da Hostinger, via FTPS.
Nao faz deploy de artefatos de teste, nao altera outros arquivos do site.
As credenciais sao lidas SOMENTE de variaveis de ambiente do GitHub Actions.
"""
import ftplib
import hashlib
import json
import os
import pathlib
import ssl
import sys

def fail(message):
    raise SystemExit(message)

def main():
    if len(sys.argv) != 3:
        fail("Uso: publicar_hostinger.py <latest.json> <apk_assinado>")
    manifest_path, apk_path = map(pathlib.Path, sys.argv[1:])
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("appId") != "com.mophie.tv" or manifest.get("channel") != "tcl-completa":
        fail("Manifesto com aplicativo/canal incorreto")
    if manifest.get("apk") != apk_path.name or "TESTE" in apk_path.name:
        fail("APK errado ou de teste; publicacao bloqueada")
    raw = apk_path.read_bytes()
    if manifest.get("sha256") != hashlib.sha256(raw).hexdigest() or manifest.get("sizeBytes") != len(raw):
        fail("Hash/tamanho divergente; publicacao bloqueada")
    host = os.environ.get("MOPHIE_FTPS_HOST", "").strip()
    user = os.environ.get("MOPHIE_FTPS_USER", "").strip()
    password = os.environ.get("MOPHIE_FTPS_PASSWORD", "")
    remote_dir = os.environ.get("MOPHIE_FTPS_DIR", "").strip()
    port = int(os.environ.get("MOPHIE_FTPS_PORT") or "21")
    if not all([host,user,password,remote_dir]):
        fail("Credenciais FTPS da Hostinger ausentes no GitHub: publicacao NAO realizada")
    if any(x in remote_dir for x in ("..", "\\", "\n", "\r")):
        fail("Diretorio remoto invalido")
    with ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=40) as ftp:
        ftp.connect(host=host, port=port)
        ftp.login(user=user, passwd=password)
        ftp.prot_p()
        ftp.cwd(remote_dir)  # Diretorio de deploy ja existente; nunca criar outro.
        # Publicar APK ANTES do manifesto para nao anunciar update inexistente.
        with apk_path.open("rb") as stream:
            ftp.storbinary("STOR " + apk_path.name, stream, blocksize=262144)
        remote_size = ftp.size(apk_path.name)
        if remote_size is not None and remote_size != len(raw):
            fail("O APK publicado ficou com tamanho incorreto; manifesto preservado")
        # Manifesto sempre por ultimo. Se falhar antes, o manifest antigo permanece.
        with manifest_path.open("rb") as stream:
            ftp.storbinary("STOR latest.json", stream, blocksize=8192)
        ftp.quit()
    print("PUBLICADO: APK e latest.json na pasta MophieTV da Hostinger")
    print("Versao: " + manifest["version"] + " | versionCode: " + str(manifest["versionCode"]))

if __name__ == "__main__":
    main()
