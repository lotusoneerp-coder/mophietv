package com.mophie.tv;

import android.app.Activity;
import android.content.Intent;
import android.content.Context;
import android.media.AudioManager;
import android.graphics.Color;
import android.widget.TextView;
import android.webkit.CookieManager;
import android.widget.Toast;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
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
    private WebView providerWeb;
    private TextView providerHint;
    private boolean providerNavigationMode=true;
    private final Handler providerHandler=new Handler(Looper.getMainLooper());
    private int providerPlayChecks=0;
    private boolean providerFullscreenRequested=false;
    private boolean providerPointerMode=false;
    private TextView providerCursor;
    private float providerCursorX=0;
    private float providerCursorY=0;

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
                    "www.redecanais.by".equalsIgnoreCase(host) || "watch.plex.tv".equalsIgnoreCase(host))) {
                    openProviderInsideApp(target);
                } else Toast.makeText(this, "Página não autorizada", Toast.LENGTH_LONG).show();
            } catch (Exception e) {
                Toast.makeText(this, "Não foi possível abrir o player na MophieTV", Toast.LENGTH_LONG).show();
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


    /** Mostra a pagina oficial dentro da MophieTV, nunca em outro navegador.
     * WebView separada preserva o estado do catalogo e nao expoe JS interfaces.
     * Nao altera anuncios, DRM, cookies nem o DOM de iframes de terceiros. */
    private boolean isProviderUrl(android.net.Uri u) {
        if (u==null || !"https".equalsIgnoreCase(u.getScheme())) return false;
        String host=u.getHost();
        return "redecanais.by".equalsIgnoreCase(host) || "www.redecanais.by".equalsIgnoreCase(host) || "watch.plex.tv".equalsIgnoreCase(host);
    }

    private void openProviderInsideApp(android.net.Uri target) {
        if (!isProviderUrl(target)) return;
        closeProviderInsideApp();
        final WebView p=new WebView(this);
        providerWeb=p;
        p.setBackgroundColor(Color.BLACK);
        p.setFocusable(true);
        p.setFocusableInTouchMode(true);
        WebSettings settings=p.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false); // impede popups em novas janelas
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(p,true);
        p.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, android.webkit.WebResourceRequest request) {
                return request.isForMainFrame() && !isProviderUrl(request.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return !isProviderUrl(android.net.Uri.parse(url));
            }
            @Override public void onPageFinished(WebView view,String url) {
                if (providerWeb!=view) return;
                providerPlayChecks=0;
                providerFullscreenRequested=false;
                // A maioria dos sites monta o player depois do evento onPageFinished.
                // Tentativas limitadas; nao clicam em anuncios nem em botoes da pagina.
                tryAutoPlayProvider();
            }
        });
        p.setWebChromeClient(new WebChromeClient() {
            @Override public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreen!=null) { callback.onCustomViewHidden(); return; }
                fullscreen=view;
                fullscreenCallback=callback;
                frame.addView(view,new FrameLayout.LayoutParams(-1,-1,Gravity.CENTER));
                view.setFocusable(true);
                view.requestFocus();
            }
            @Override public void onHideCustomView() { exitVideoFullscreen(false); }
        });
        frame.addView(p,new FrameLayout.LayoutParams(-1,-1));
        providerHint=new TextView(this);
        providerHint.setTextColor(Color.WHITE);
        providerHint.setTextSize(17);
        providerHint.setBackgroundColor(0xD7001820);
        providerHint.setPadding(18,12,18,12);
        providerHint.setFocusable(false);
        providerHint.setClickable(false);
        frame.addView(providerHint,new FrameLayout.LayoutParams(-1,-2,Gravity.BOTTOM));
        providerNavigationMode=true; // Permite OK no botao Play e setas no player do site desde o primeiro frame.
        providerPointerMode=false;
        providerCursor=new TextView(this);
        providerCursor.setText("➤");
        providerCursor.setTextSize(35);
        providerCursor.setTextColor(0xFF46CCB1);
        providerCursor.setShadowLayer(5,2,2,Color.BLACK);
        providerCursor.setFocusable(false);
        providerCursor.setClickable(false);
        providerCursor.setVisibility(View.GONE);
        frame.addView(providerCursor,new FrameLayout.LayoutParams(85,90,Gravity.TOP|Gravity.LEFT));
        p.post(() -> {
            if (providerWeb!=p)return;
            providerCursorX=p.getWidth()/2f;
            providerCursorY=p.getHeight()/2f;
            updateProviderCursor();
        });
        providerPlayChecks=0;
        providerFullscreenRequested=false;
        updateProviderHint("Player em tela cheia na MophieTV. Se o autoplay nao iniciar, use MENU e OK no Play.");
        p.loadUrl(target.toString());
        p.requestFocus();
    }

    private void updateProviderHint(String detail) {
        if (providerHint==null) return;
        if (providerPointerMode) {
            providerHint.setText("MOUSE DA TCL: setas movem | OK clica no Play | MENU: modo video | VOLTAR: sair\n"+detail);
        } else if (providerNavigationMode) {
            providerHint.setText("NAVEGAR: setas e OK | MENU: mouse virtual | VOLTAR: sair\n"+detail);
        } else {
            providerHint.setText("VIDEO: ESQ -10s | OK pausar | DIR +10s | CIMA/BAIXO volume | MENU: navegar\n"+detail);
        }
        providerHint.setVisibility(View.VISIBLE);
        final TextView current=providerHint;
        // Dica desaparece sozinha; nao deve cobrir o botao Play nem o filme.
        providerHandler.postDelayed(() -> {
            if (providerHint==current && current.getParent()!=null)current.setVisibility(View.GONE);
        }, 4500);
    }

    private void updateProviderCursor() {
        if (providerCursor==null || providerWeb==null)return;
        providerCursor.setVisibility(providerPointerMode?View.VISIBLE:View.GONE);
        providerCursor.setTranslationX(providerCursorX-18);
        providerCursor.setTranslationY(providerCursorY-20);
    }

    private void moveProviderCursor(int dx,int dy) {
        if (providerWeb==null)return;
        providerCursorX=Math.max(4,Math.min(providerWeb.getWidth()-5,providerCursorX+dx));
        providerCursorY=Math.max(4,Math.min(providerWeb.getHeight()-5,providerCursorY+dy));
        updateProviderCursor();
    }

    private void tapProviderCursor() {
        if (providerWeb==null)return;
        long t=SystemClock.uptimeMillis();
        MotionEvent down=MotionEvent.obtain(t,t,MotionEvent.ACTION_DOWN,providerCursorX,providerCursorY,0);
        MotionEvent up=MotionEvent.obtain(t,t+80,MotionEvent.ACTION_UP,providerCursorX,providerCursorY,0);
        try {
            providerWeb.dispatchTouchEvent(down);
            providerWeb.dispatchTouchEvent(up);
        } finally { down.recycle();up.recycle(); }
        // O clique no player do site e acao real do controle; nao simula anuncio.
        updateProviderHint("Toque enviado ao site. O proprio player decide se pode iniciar.");
    }

    private void tryAutoPlayProvider() {
        final WebView active=providerWeb;
        if (active==null || providerPlayChecks>=8) return;
        providerPlayChecks++;
        // HTML5 no documento do provedor: tentar play() e fullscreen oficial.
        // O navegador mantem isolamento de iframes de outros dominios.
        active.evaluateJavascript("(function(){try{var v=document.querySelector('video');"+
            "if(!v)return 'iframe';"+
            "v.autoplay=true;v.playsInline=true;"+
            "if(v.paused){var p=v.play();if(p&&p.catch)p.catch(function(){});return 'attempted'}"+
            "return 'playing'}catch(e){return 'error'}})()", result -> {
            if (providerWeb!=active)return;
            if ("\"playing\"".equals(result)) {
                providerNavigationMode=false; // Ao confirmar reproducao, habilita atalhos de transporte.
                providerPointerMode=false;
                updateProviderCursor();
                updateProviderHint("Video HTML5 iniciado. Controle da TCL habilitado.");
                if (!providerFullscreenRequested) {
                    providerFullscreenRequested=true;
                    active.evaluateJavascript("(function(){var v=document.querySelector('video');"+
                        "if(!v||document.fullscreenElement||!v.requestFullscreen)return false;"+
                        "try{var p=v.requestFullscreen();if(p&&p.catch)p.catch(function(){});return true}"+
                        "catch(e){return false}})()",null);
                }
                return;
            }
            // A chamada play() nao garante reproducao: conferir novamente apos carregamento.
            if (providerPlayChecks<8) providerHandler.postDelayed(() -> {
                if(providerWeb==active)tryAutoPlayProvider();
            }, 1400);
            if (providerPlayChecks==2 && "\"iframe\"".equals(result))
                updateProviderHint("Player de outro dominio. Use OK no botao Play do site; autoplay nao pode ser imposto.");
        });
    }

    private void providerVideoCommand(String command) {
        if (providerWeb==null) return;
        final WebView active=providerWeb;
        // So ha controle de tempo quando a pagina expõe um video HTML5 acessivel.
        String script="(function(){try{var v=document.querySelector('video');if(!v)return 'iframe';"+
            "if('"+command+"'==='pause'){if(v.paused){var p=v.play();if(p&&p.catch)p.catch(function(){});}else v.pause();}"+
            "if('"+command+"'==='back'&&Number.isFinite(v.currentTime))v.currentTime=Math.max(0,v.currentTime-10);"+
            "if('"+command+"'==='forward'&&Number.isFinite(v.currentTime))v.currentTime=Math.min(Number.isFinite(v.duration)?v.duration:v.currentTime+10,v.currentTime+10);"+
            "return 'ok';}catch(e){return 'error'}})()";
        active.evaluateJavascript(script, result -> {
            if (providerWeb!=active) return;
            if ("\"iframe\"".equals(result)) {
                providerNavigationMode=true; // Nao bloquear o controle da TV quando iframe é inacessivel.
                updateProviderHint("Iframe externo: setas e OK agora navegam pelos controles do player.");
            } else if ("\"error\"".equals(result)) {
                updateProviderHint("O player recusou este comando.");
            }
        });
    }

    private void closeProviderInsideApp() {
        if (providerHint!=null) {
            frame.removeView(providerHint);
            providerHint=null;
        }
        if (providerCursor!=null) {
            frame.removeView(providerCursor);
            providerCursor=null;
        }
        if (providerWeb!=null) {
            WebView old=providerWeb;
            providerWeb=null;
            old.stopLoading();
            frame.removeView(old);
            old.loadUrl("about:blank");
            old.destroy();
        }
        providerNavigationMode=true;
        providerPointerMode=false;
        providerPlayChecks=0;
        providerFullscreenRequested=false;
        if (web!=null)web.requestFocus();
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
        if (providerWeb!=null) providerWeb.requestFocus(); else web.requestFocus();
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
        if (fullscreen!=null) {
            if (event.getKeyCode()==KeyEvent.KEYCODE_BACK) { exitVideoFullscreen(true); return true; }
            // Player em fullscreen do site recebe os eventos fisicos do controle.
            return super.dispatchKeyEvent(event);
        }
        if (providerWeb!=null) {
            int code=event.getKeyCode();
            if (code==KeyEvent.KEYCODE_BACK) { closeProviderInsideApp(); return true; }
            if (code==KeyEvent.KEYCODE_MENU) {
                if (providerPointerMode) {
                    providerPointerMode=false;
                    providerNavigationMode=false;
                } else if (providerNavigationMode) {
                    providerPointerMode=true;
                    providerNavigationMode=true;
                } else {
                    providerPointerMode=false;
                    providerNavigationMode=true;
                }
                updateProviderCursor();
                updateProviderHint(providerPointerMode?"Mova o cursor ate o Play e aperte OK.":providerNavigationMode?"Controle direto do site ativado.":"Atalhos de video HTML5 ativados.");
                return true;
            }
            if (providerPointerMode) {
                int step=Math.max(25,providerWeb.getWidth()/20);
                if (code==KeyEvent.KEYCODE_DPAD_LEFT) { moveProviderCursor(-step,0);return true; }
                if (code==KeyEvent.KEYCODE_DPAD_RIGHT) { moveProviderCursor(step,0);return true; }
                if (code==KeyEvent.KEYCODE_DPAD_UP) { moveProviderCursor(0,-step);return true; }
                if (code==KeyEvent.KEYCODE_DPAD_DOWN) { moveProviderCursor(0,step);return true; }
                if (code==KeyEvent.KEYCODE_DPAD_CENTER || code==KeyEvent.KEYCODE_ENTER) { tapProviderCursor();return true; }
            }
            if (!providerNavigationMode) {
                if (code==KeyEvent.KEYCODE_DPAD_LEFT) { providerVideoCommand("back"); return true; }
                if (code==KeyEvent.KEYCODE_DPAD_RIGHT) { providerVideoCommand("forward"); return true; }
                if (code==KeyEvent.KEYCODE_DPAD_CENTER || code==KeyEvent.KEYCODE_ENTER ||
                    code==KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE) { providerVideoCommand("pause"); return true; }
                if (code==KeyEvent.KEYCODE_DPAD_UP || code==KeyEvent.KEYCODE_DPAD_DOWN) {
                    AudioManager audio=(AudioManager)getSystemService(Context.AUDIO_SERVICE);
                    if (audio!=null)audio.adjustStreamVolume(AudioManager.STREAM_MUSIC,
                        code==KeyEvent.KEYCODE_DPAD_UP?AudioManager.ADJUST_RAISE:AudioManager.ADJUST_LOWER,
                        AudioManager.FLAG_SHOW_UI);
                    return true;
                }
            }
            // Sem video HTML5 acessivel, entregar DPAD/OK diretamente ao site.
            return super.dispatchKeyEvent(event);
        }
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
        if (providerWeb!=null) { closeProviderInsideApp(); return; }
        if (!isMophieHome()) { returnFromExternalPage(); return; }
        js("window.mophieBack&&window.mophieBack()");
    }
    @Override protected void onDestroy() {
        closeProviderInsideApp();
        if (web!=null) { frame.removeView(web); web.destroy(); web=null; }
        super.onDestroy();
    }
}
