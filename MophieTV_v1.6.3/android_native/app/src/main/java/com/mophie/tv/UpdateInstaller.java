package com.mophie.tv;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.webkit.WebView;
import android.widget.Toast;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;

/**
 * Atualizador first-party Mophie TV. A fonte e FIXA e HTTPS; nenhuma pagina externa
 * controla o download. O codigo Java nao expoe JavascriptInterface a iframes.
 * O Android verifica a assinatura do aplicativo ao instalar/atualizar.
 */
final class UpdateInstaller {
    private static final String BASE = "https://mophietv.lotusoneerp.com/";
    private static final String APP_ID = "com.mophie.tv";
    private static final String CHANNEL = "tcl-completa";
    private final Activity activity;
    private final WebView web;
    private volatile boolean busy = false;

    UpdateInstaller(Activity activity, WebView web) {
        this.activity = activity;
        this.web = web;
    }

    boolean startFromLocalUI() {
        if (busy) return true;
        if (Build.VERSION.SDK_INT >= 26 && !activity.getPackageManager().canRequestPackageInstalls()) {
            notifyJs("permission", "Ative a permissão de instalação para Mophie TV.");
            Intent permissionIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + activity.getPackageName()));
            try { activity.startActivity(permissionIntent); }
            catch (Exception e) { notifyJs("error", "Não foi possível abrir a permissão: " + e.getMessage()); }
            return true;
        }
        busy = true;
        new Thread(this::downloadAndInstall, "Mophie-TV-Updater").start();
        return true;
    }

    private void notifyJs(String state, String message) {
        String js = "window.MophieUpdater&&window.MophieUpdater.nativeStatus(" +
                JSONObject.quote(state) + "," + JSONObject.quote(message) + ")";
        activity.runOnUiThread(() -> { if (web != null) web.evaluateJavascript(js, null); });
    }

    private byte[] getManifestBytes() throws Exception {
        HttpURLConnection c = (HttpURLConnection)new URL(BASE + "latest.json").openConnection();
        c.setConnectTimeout(10000); c.setReadTimeout(12000);
        c.setUseCaches(false); c.setInstanceFollowRedirects(false);
        try {
            if (c.getResponseCode() != 200) throw new Exception("Manifesto HTTP " + c.getResponseCode());
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            try (InputStream in = c.getInputStream()) {
                byte[] buf = new byte[4096]; int n;
                while ((n = in.read(buf)) != -1) {
                    if (out.size() + n > 32768) throw new Exception("Manifesto muito grande");
                    out.write(buf, 0, n);
                }
            }
            return out.toByteArray();
        } finally { c.disconnect(); }
    }

    private static String hex(byte[] bytes) {
        StringBuilder b = new StringBuilder(bytes.length * 2);
        for (byte x : bytes) b.append(String.format(Locale.US, "%02x", x & 255));
        return b.toString();
    }

    private void downloadAndInstall() {
        File file = null;
        int sessionId = -1;
        try {
            notifyJs("working", "Consultando a versão publicada na Hostinger...");
            JSONObject j = new JSONObject(new String(getManifestBytes(), "UTF-8"));
            String id = j.getString("appId"), channel = j.getString("channel");
            String version = j.getString("version"), apk = j.getString("apk");
            String digest = j.getString("sha256").toLowerCase(Locale.US);
            long size = j.getLong("sizeBytes");
            int versionCode = j.getInt("versionCode");
            int installed = activity.getPackageManager().getPackageInfo(APP_ID, 0).versionCode;
            if (!APP_ID.equals(id) || !CHANNEL.equals(channel)) throw new Exception("Aplicativo/canal de atualização diferente");
            if (!version.matches("[0-9]+\\.[0-9]+\\.[0-9]+")) throw new Exception("Versão inválida");
            if (!apk.matches("MophieTV_TCL_v" + java.util.regex.Pattern.quote(version) + "_[A-Za-z0-9_-]+\\.apk"))
                throw new Exception("Nome de APK inválido");
            if (!digest.matches("[a-f0-9]{64}")) throw new Exception("SHA-256 inválido");
            if (size < 100000 || size > 350000000L) throw new Exception("Tamanho de APK fora do permitido");
            if (versionCode <= installed) { notifyJs("error", "Não há uma versão mais nova disponível."); return; }

            HttpURLConnection conn = (HttpURLConnection)new URL(BASE + apk).openConnection();
            conn.setConnectTimeout(12000); conn.setReadTimeout(20000);
            conn.setUseCaches(false); conn.setInstanceFollowRedirects(false);
            try {
                if (conn.getResponseCode() != 200) throw new Exception("Download HTTP " + conn.getResponseCode());
                file = new File(activity.getCacheDir(), "mophie_update_verified.apk");
                MessageDigest md = MessageDigest.getInstance("SHA-256");
                long count = 0; long last = 0;
                try (InputStream in = conn.getInputStream(); FileOutputStream out = new FileOutputStream(file)) {
                    byte[] buf = new byte[64 * 1024]; int n;
                    while ((n = in.read(buf)) != -1) {
                        count += n;
                        if (count > size) throw new Exception("Tamanho excede o manifesto");
                        md.update(buf, 0, n); out.write(buf, 0, n);
                        long now = System.currentTimeMillis();
                        if (now - last > 400) {
                            notifyJs("progress", "Baixando APK na TV: " + (count * 100 / size) + "%");
                            last = now;
                        }
                    }
                    out.getFD().sync();
                }
                if (count != size || !hex(md.digest()).equals(digest))
                    throw new Exception("Download não corresponde ao SHA-256/tamanho publicado");
            } finally { conn.disconnect(); }

            PackageInfo candidate = activity.getPackageManager().getPackageArchiveInfo(file.getAbsolutePath(), 0);
            if (candidate == null || !APP_ID.equals(candidate.packageName) || candidate.versionCode != versionCode)
                throw new Exception("O APK não corresponde ao pacote ou versão anunciada");

            notifyJs("working", "APK conferido. Preparando instalador do Android...");
            PackageInstaller installer = activity.getPackageManager().getPackageInstaller();
            PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
            params.setAppPackageName(APP_ID);
            params.setSize(size);
            sessionId = installer.createSession(params);
            try (PackageInstaller.Session session = installer.openSession(sessionId)) {
                try (FileInputStream input = new FileInputStream(file);
                     OutputStream output = session.openWrite("base.apk", 0, size)) {
                    byte[] b = new byte[64 * 1024]; int n;
                    while ((n = input.read(b)) != -1) output.write(b, 0, n);
                    session.fsync(output);
                }
                Intent status = new Intent(activity, UpdateInstallReceiver.class);
                status.setAction(APP_ID + ".PACKAGE_INSTALL_STATUS");
                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= 31) flags |= PendingIntent.FLAG_MUTABLE;
                PendingIntent pi = PendingIntent.getBroadcast(activity, sessionId, status, flags);
                notifyJs("installer", "Confirme a instalação na tela do Android.");
                session.commit(pi.getIntentSender());
            }
        } catch (Exception error) {
            notifyJs("error", "Atualização não instalada: " + error.getMessage());
            if (sessionId >= 0) {
                try { activity.getPackageManager().getPackageInstaller().abandonSession(sessionId); }
                catch (Exception ignored) { }
            }
        } finally {
            busy = false;
            if (file != null) file.delete();
        }
    }
}
