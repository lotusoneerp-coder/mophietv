package com.mophie.tv;

import android.app.Activity;
import android.content.Intent;
import android.widget.Toast;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import org.json.JSONArray;

/**
 * Camada Android proposta para clique REAL nos iframes:
 * O OK físico consulta o cursor do documento principal e envia MotionEvent
 * real à WebView; não disponibiliza ponte JS para iframes de terceiros.
 * Necessita compilação Android SDK/Gradle. APK legado não contém este recurso.
 */
public class MainActivity extends Activity {
    private WebView web;
    private FrameLayout frame;
    private View fullscreen;
    private WebChromeClient.CustomViewCallback fullscreenCallback;
    private long lastTap;
    private UpdateInstaller updates;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().getDecorView().setSystemUiVisibility(5894 | 1024 | 512);
        frame = new FrameLayout(this);
        web = new WebView(this);
        web.setBackgroundColor(0xFF09090B);
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setAllowFileAccess(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, android.webkit.WebResourceRequest req) {
                return handleInternalUpdateUrl(req.getUrl(), req.isForMainFrame());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleInternalUpdateUrl(android.net.Uri.parse(url), true);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreen != null) { callback.onCustomViewHidden(); return; }
                fullscreen = view;
                fullscreenCallback = callback;
                frame.addView(view, new FrameLayout.LayoutParams(-1,-1, Gravity.CENTER));
                view.setFocusable(true);
                view.requestFocus();
            }
            @Override public void onHideCustomView() { exitVideoFullscreen(false); }
        });
        // SEGURANÇA: não expor addJavascriptInterface a iframes externos.
        // O clique real é solicitado exclusivamente pelo evento físico OK do controle.
        frame.addView(web, new FrameLayout.LayoutParams(-1,-1));
        setContentView(frame);
        updates = new UpdateInstaller(this, web);
        web.loadUrl("file:///android_asset/index.html");
        web.requestFocus();
    }

    private boolean handleInternalUpdateUrl(android.net.Uri uri, boolean mainFrame) {
        // A página original usa o navegador instalado, não um iframe bloqueado.
        // Permite somente URLs HTTPS do provedor explicitamente suportado.
        if ("mophie-original".equals(uri.getScheme())) {
            if (!mainFrame || !"open".equals(uri.getHost()) || !isMophieHome()) return true;
            try {
                String requested=uri.getQueryParameter("url");
                android.net.Uri target=android.net.Uri.parse(requested);
                String host=target.getHost();
                if ("https".equals(target.getScheme()) && ("redecanais.by".equalsIgnoreCase(host) ||
                    "www.redecanais.by".equalsIgnoreCase(host))) {
                    startActivity(new Intent(Intent.ACTION_VIEW, target).addCategory(Intent.CATEGORY_BROWSABLE));
                } else Toast.makeText(this, "Página não autorizada", Toast.LENGTH_LONG).show();
            } catch (Exception e) {
                Toast.makeText(this, "Não foi possível abrir o navegador da TV", Toast.LENGTH_LONG).show();
            }
            return true;
        }
        if (!"mophie-install".equals(uri.getScheme())) return false;
        if (!mainFrame || !"start".equals(uri.getHost()) || web == null ||
            !"file:///android_asset/index.html".equals(web.getUrl())) return true;
        // A Activity só permite baixar do servidor Mophie fixo, após ação do usuário.
        if (updates != null) updates.startFromLocalUI();
        return true;
    }

    private void handleRemoteOk() {
        // A consulta avalia somente o documento principal carregado pela Mophie TV.
        // Scripts em iframes externos não possuem permissão para injetar toques.
        web.evaluateJavascript("(function(){var m=window.MophieVirtualMouse;"+
                "if(!m||!m.isActive())return null;"+
                "return [m.state.x/window.innerWidth,m.state.y/window.innerHeight]})()", result -> {
            if (result == null || "null".equals(result)) {
                js("window.mophieRemoteKey&&window.mophieRemoteKey('Enter')");
                return;
            }
            try {
                JSONArray pt=new JSONArray(result);
                float x=(float)pt.getDouble(0), y=(float)pt.getDouble(1);
                sendTap(x,y);
                js("window.MophieVirtualMouse&&window.MophieVirtualMouse.nativeClickFeedback&&window.MophieVirtualMouse.nativeClickFeedback()");
            } catch (Exception e) {
                js("window.mophieRemoteKey&&window.mophieRemoteKey('Enter')");
            }
        });
    }

    private void sendTap(float nx, float ny) {
        if (web == null || web.getVisibility()!=View.VISIBLE || fullscreen!=null) return;
        long now = SystemClock.uptimeMillis();
        if (now - lastTap < 140) return;
        lastTap=now;
        float x=nx*web.getWidth(), y=ny*web.getHeight();
        long down=SystemClock.uptimeMillis();
        MotionEvent evDown=MotionEvent.obtain(down,down,MotionEvent.ACTION_DOWN,x,y,0);
        MotionEvent evUp=MotionEvent.obtain(down,down+70,MotionEvent.ACTION_UP,x,y,0);
        try { web.dispatchTouchEvent(evDown); web.dispatchTouchEvent(evUp); }
        finally { evDown.recycle(); evUp.recycle(); }
    }

    private void exitVideoFullscreen(boolean callCallback) {
        if (fullscreen==null) return;
        frame.removeView(fullscreen);
        fullscreen=null;
        if (callCallback && fullscreenCallback != null) fullscreenCallback.onCustomViewHidden();
        fullscreenCallback=null;
        web.requestFocus();
    }

    private void js(String expr) {
        if (web != null) web.evaluateJavascript("javascript:" + expr, null);
    }

    private boolean isMophieHome() {
        return web != null && "file:///android_asset/index.html".equals(web.getUrl());
    }
    private void returnFromExternalPage() {
        if (web == null) return;
        web.loadUrl("file:///android_asset/index.html");
        web.requestFocus();
    }
    @Override public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction()!=KeyEvent.ACTION_DOWN) return super.dispatchKeyEvent(event);
        if (fullscreen!=null) return super.dispatchKeyEvent(event);
        if (!isMophieHome()) {
            if (event.getKeyCode()==KeyEvent.KEYCODE_BACK) {
                returnFromExternalPage();
                return true;
            }
            return super.dispatchKeyEvent(event);
        }
        String key=null;
        switch(event.getKeyCode()) {
            case KeyEvent.KEYCODE_DPAD_UP: key="ArrowUp"; break;
            case KeyEvent.KEYCODE_DPAD_DOWN: key="ArrowDown"; break;
            case KeyEvent.KEYCODE_DPAD_LEFT: key="ArrowLeft"; break;
            case KeyEvent.KEYCODE_DPAD_RIGHT: key="ArrowRight"; break;
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER: key="Enter"; break;
            case KeyEvent.KEYCODE_BACK: key="Escape"; break;
            case KeyEvent.KEYCODE_MENU: key="Menu"; break;
        }
        if (key!=null) {
            if (event.getRepeatCount()>0 && "Enter".equals(key)) return true;
            if ("Enter".equals(key)) handleRemoteOk();
            else js("window.mophieRemoteKey&&window.mophieRemoteKey('" + key + "')");
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    @Override public void onBackPressed() {
        if (fullscreen!=null) { exitVideoFullscreen(true); return; }
        if (!isMophieHome()) { returnFromExternalPage(); return; }
        js("window.mophieBack&&window.mophieBack()");
    }
    @Override protected void onDestroy() {
        if (web!=null) { frame.removeView(web); web.destroy(); web=null; }
        super.onDestroy();
    }
}
