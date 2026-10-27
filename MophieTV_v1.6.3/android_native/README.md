# Compilação do Android nativo

Código preparado para Android SDK 35, JDK 17, Gradle 8.9 (Android Gradle Plugin 8.7.3).

Execute `gradle :app:assembleRelease` na pasta `android_native`. O resultado é `app/build/outputs/apk/release/app-release-unsigned.apk`.

**Atenção:** o APK gerado é SEM ASSINATURA. Para atualizar uma instalação da Mophie TV existente, deve ser assinado com a chave original da v1.6.2 (SHA-256 do certificado público `44e68db74dc23534ee375f73941bc12d1d189da40a3bdd47cedf92359f385766`). O GitHub Actions deste pacote envia somente o APK unsigned, sem chave de assinatura.

`MainActivity.java`: WebView, D-pad, toque nativo, WebChromeClient de vídeo e interceptação do comando de atualização.
`UpdateInstaller.java`: download HTTPS do APK fixo da Hostinger e validação de versão, pacote, tamanho e SHA-256; usa `PackageInstaller.Session`.
`UpdateInstallReceiver.java`: abre a confirmação do instalador Android quando solicitada.

A instalação física ainda depende de teste na TCL.
