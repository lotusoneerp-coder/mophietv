# Mophie TV v1.6.3 — Fonte para compilação nativa

**NÃO É UM APK INSTALÁVEL:** este pacote contém o projeto Android e o código web, **não foi possível compilá-lo neste ambiente (Android SDK ausente)**. Não publique uma versão 1.6.3 no `latest.json` antes de compilar e assinar o APK.

## Atualização nativa, sem site e sem Downloader

A TV inicia o app, consulta `https://mophietv.lotusoneerp.com/latest.json` e bloqueia o acesso se existir uma versão superior. Ao selecionar **Baixar e instalar nesta TV**:

1. A WebView envia o comando interno `mophie-install://start` para a Activity (apenas da tela principal local).
2. `UpdateInstaller` baixa `latest.json` do domínio fixo, valida `appId`, canal, `versionCode`, filename, SHA-256 e tamanho.
3. Baixa o APK pela TV via HTTPS, confirma SHA-256, pacote e versão.
4. Passa o APK ao Android `PackageInstaller.Session`, que mostra a confirmação de instalação na TV.
5. O Android exige permissão para instalação de apps externos em alguns aparelhos, normalmente uma única vez.

O sistema operacional valida a **assinatura de atualização** do APK: a chave de assinatura **DEVE ser idêntica** à das versões 1.1.0–1.6.2. Ela **não acompanha este ZIP**.

## Compilar gratuitamente no GitHub Actions

1. Crie um repositório **privado** no GitHub e envie o conteúdo desta pasta.
2. Em Settings → Secrets and variables → Actions → New repository secret, cadastre `MOPHIE_SIGN_KEY_PEM` (conteúdo PEM da chave de assinatura que já usa) e `MOPHIE_SIGN_CERT_PEM` (certificado PEM correspondente). Não publique esses arquivos no repositório.
3. Em Actions → **Compilar Mophie TV Android** → Run workflow. O workflow usa o Android SDK no runner e assina o APK com a chave existente.
4. Baixe o artefato final `MophieTV_TCL_v1.6.3_NATIVE_ATUALIZADOR.apk` do GitHub Actions.
5. **Instale esta primeira versão nativa uma única vez manualmente** na TCL; as atualizações **posteriores** poderão usar o instalador interno.
6. No PC, execute `python tools/gerar_latest.py dist/MophieTV_TCL_v1.6.3_NATIVE_ATUALIZADOR.apk 1.6.3 32`.
7. Copie os dois arquivos de `upload_hostinger` para o diretório do subdomínio Mophie TV. Ative HTTPS válido.

### IMPORTANTE: ordem de publicação

Primeiro compile e assine o APK; só depois atualize `latest.json`. Senão, o bloqueio obrigatório da v1.6.2 fará as TVs pedirem uma versão que ainda não está disponível.

## RedeCanais

- A busca **já existia** e permanece na tela de catálogo. Agora a interface informa que busca somente títulos já importados.
- Adicionado botão **Carregar mais títulos** para consultar duas páginas adicionais por categoria, a cada solicitação do usuário, somente a partir de links públicos de paginação.
- Melhor leitura de capas em metadados Open Graph e JSON-LD quando a página individual é acessível.
- O número mostrado indica **títulos importados**, não o catálogo completo.
- Quando o site recusar acesso (inclusive código 16), o app mantém o cache e informa a falha. **Não há contorno de bloqueios nem extração de streaming protegido.**

## Testes

Os componentes JavaScript foram conferidos sintaticamente e o carregamento paginado/bloqueio foi simulado no Chromium. **Compilação nativa, instalação e reprodução em TCL física ainda NÃO validadas.**
