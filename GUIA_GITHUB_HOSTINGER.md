# MOPHIE TV v1.6.3 — Atualizações diretamente na TCL (sem abrir site)

## 1. O que muda

Na abertura, a Mophie TV consulta obrigatoriamente o `latest.json` na sua Hostinger. Quando detectar nova versão, oferece **Baixar e instalar nesta TV**: o Android baixa o APK e abre o instalador na própria TV, sem navegador, pendrive ou Downloader. O sistema ainda solicita confirmação da instalação e, em alguns aparelhos, permissão de fonte desconhecida.

## 2. Compilação gratuita no GitHub Actions

1. Crie um repositório **privado** no GitHub.
2. Extraia o ZIP no seu PC; envie o conteúdo da pasta `MophieTV_v1.6.3` **inclusive a pasta oculta `.github`** ao repositório. O método mais simples para muitos arquivos é GitHub Desktop.
3. Abra a aba **Actions**, clique em **Compilar Mophie TV Android — APK sem assinatura** e depois em **Run workflow**.
4. Ao concluir, baixe o artefato `MophieTV_v1.6.3_APK_NATIVO_SEM_ASSINATURA` e extraia o arquivo `MophieTV_TCL_v1.6.3_NATIVE_UNSIGNED.apk`.
5. **Envie esse APK sem assinatura de volta nesta conversa** para a etapa de assinatura. Não tente instalá-lo: não instala sem assinatura.

**Vantagem:** este workflow compila sem precisar cadastrar nem publicar a chave privada no GitHub. A chave original continua fora do ZIP e do repositório.

## 3. A assinatura é obrigatória

Um APK novo só atualiza a Mophie TV já instalada se for assinado com a **mesma chave da linha v1.1.0–1.6.2**. Certificado original SHA-256:

`44e68db74dc23534ee375f73941bc12d1d189da40a3bdd47cedf92359f385766`

Não utilize a assinatura automática de debug do GitHub nem gere nova chave. Ela faria o Android recusar a atualização por cima da v1.6.2. Nunca publique a chave privada no repositório.

## 4. Primeira instalação e Hostinger

1. Só depois que o APK **assinado** v1.6.3 estiver pronto, instale-o uma única vez na TCL pelo método de instalação atual.
2. No computador, execute `python tools/gerar_latest.py caminho/do/MophieTV_TCL_v1.6.3_NATIVE_ATUALIZADOR.apk 1.6.3 32`.
3. Envie os arquivos da pasta `upload_hostinger/` para `public_html/mophietv/` da Hostinger.
4. Em futuras versões **superiores** (v1.6.4, versionCode 33 etc.), a Mophie TV poderá baixar o APK e abrir a instalação na própria TV, mediante autorização do Android.

**NÃO publique um latest.json anunciando v1.6.3 antes de existir um APK assinado e acessível.** A v1.6.2 bloqueia o uso quando detecta atualização obrigatória e não sabe instalá-la diretamente.

## 5. RedeCanais

A busca por título já está presente, mas pesquisa **apenas os itens carregados localmente**. A opção **Carregar mais títulos** lê páginas públicas adicionais e preserva os resultados em cache. O código 16 significa que o servidor recusou acesso; o APK não pode prometer capas, catálogo completo ou vídeo nesse caso. Não foram implementados métodos para contornar o bloqueio.

## 6. Versões futuras

Atualize **juntos**: `versionCode`/`versionName` em `android_native/app/build.gradle`, `CODE`/`VERSION` em `app/js/updater.js`, nome do APK no workflow e no `latest.json`. A atualização **não é silenciosa**: confirmação do Android ainda é necessária.

## Validação e limitações

- Sintaxe JavaScript e navegação simulada foram testadas localmente.
- O ambiente original não possui Android SDK, então **nenhum APK nativo v1.6.3 foi compilado aqui**.
- O GitHub Actions ainda precisa ser executado no seu repositório.
- A instalação física na TCL e os players externos ainda não foram validados.
