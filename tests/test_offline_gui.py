"""Smoke tests locais: interface e leitor RedeCanais, não reproduzem vídeos reais."""
from pathlib import Path
import asyncio
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
UPD=ROOT/'app/js/updater.js'
SOURCES=ROOT/'app/js/source-catalogs.js'

async def check_updater(browser, width, height):
    page=await browser.new_page(viewport={"width":width,"height":height})
    await page.set_content('''<!doctype html><html><body>
    <div id="mophie-update-modal" hidden><h2 id="mophie-update-status"></h2>
    <p id="mophie-update-caption"></p><div id="mophie-update-actions"></div></div>
    </body></html>''')
    await page.evaluate("""() => { window.__updateVersionCode=38;window.fetch = async () => ({ok:true,
        json:async()=>({appId:'com.mophie.tv',channel:'tcl-completa',version:'1.6.9',versionCode:window.__updateVersionCode,
        apk:'MophieTV_TCL_v1.6.9_NATIVE_ATUALIZADOR.apk',sha256:'a'.repeat(64),sizeBytes:20000000,notes:[]})});} """)
    await page.add_script_tag(path=str(UPD))
    await page.evaluate("window.MophieUpdater.startGate(()=>{window.__booted=true})")
    await page.wait_for_function('window.__booted===true')
    assert await page.evaluate('window.MophieUpdater.passed()') is True
    await page.close()

    page=await browser.new_page(viewport={"width":width,"height":height})
    await page.set_content('''<!doctype html><html><body>
    <div id="mophie-update-modal" hidden><h2 id="mophie-update-status"></h2>
    <p id="mophie-update-caption"></p><div id="mophie-update-actions"></div></div>
    </body></html>''')
    await page.evaluate("""() => { window.fetch = async () => ({ok:true,
        json:async()=>({appId:'com.mophie.tv',channel:'tcl-completa',version:'1.6.10',versionCode:39,
        apk:'MophieTV_TCL_v1.6.10_NOVA_VERSAO.apk',sha256:'a'.repeat(64),sizeBytes:20000000,notes:[]})});} """)
    await page.add_script_tag(path=str(UPD))
    await page.evaluate("window.MophieUpdater.startGate(()=>{window.__booted=true})")
    await page.wait_for_function("window.MophieUpdater.getState()==='required'")
    assert await page.evaluate('window.MophieUpdater.passed()') is False
    assert await page.evaluate("window.MophieUpdater.key('Escape')") is True
    assert await page.evaluate("window.MophieUpdater.getState()==='required'") is True
    assert await page.locator('#mophie-update-actions').locator('div').count()==2
    await page.close()
    print(f'PASS atualizador: {width}x{height}')

async def check_catalogue(browser):
    page=await browser.new_page()
    await page.set_content('<html><body>Catálogo simulado</body></html>')
    await page.evaluate('''() => {
        const make = (u) => {
          const n=+(u.match(/browse-filmes-videos-(\\d+)-date/)||[])[1]||1;
          return `<html><body><div><a href="/filme${n}_abcdef12.html" title="Filme ${n}"><img src="/capas/filme${n}.jpg" alt="Filme ${n}"></a></div>`+
             (n<7?`<a href="/browse-filmes-videos-${n+1}-date.html">Próxima</a>`:'')+'</body></html>';
        };
        window.fetch=async (u)=>({ok:true,headers:{get:()=>"text/html"},text:async()=>make(u)});
    }''')
    await page.add_script_tag(path=str(SOURCES))
    result=await page.evaluate('''async()=> {const s=await window.MophieSources.load('RedeCanais',true); return {n:s.items.length,p:s.pages}}''')
    assert result['n']>=5, result
    assert result['p']>=5, result
    more=await page.evaluate("async()=>{const r=await window.MophieSources.loadMore('RedeCanais');return {n:r.items.length,added:r.added}}")
    assert more['n']>=7 and more['added']>=2,more
    await page.close()
    print('PASS catálogo RedeCanais: paginação, capas e mais títulos (HTML simulado)')

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        for w,h in [(960,540),(1280,720),(1920,1080)]:
            await check_updater(browser,w,h)
        await check_catalogue(browser)
        await browser.close()
if __name__=='__main__':asyncio.run(main())
