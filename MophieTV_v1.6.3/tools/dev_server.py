"""Servidor de desenvolvimento da Mophie TV (somente testes no navegador do PC).

Na TV o app roda em file:// com setAllowUniversalAccessFromFileURLs(true), então CORS não se aplica.
No navegador comum, os servidores do Pluto TV só aceitam a origem pluto.tv; este servidor serve app/
e oferece /proxy?u=<url>, reescrevendo playlists HLS para que segmentos também passem pelo proxy.
Uso:  python tools/dev_server.py [porta]   e injete tools/dev_inject.js na página de teste.
"""
import http.server, socketserver, sys, urllib.parse, urllib.request, os, re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app')
ALLOWED = re.compile(r'(^|\.)pluto\.tv$|(^|\.)plutotv\.net$|(^|\.)cloudfront\.net$|(^|\.)akamaized\.net$|(^|\.)fastly\.net$')


def proxied(url):
    return '/proxy?u=' + urllib.parse.quote(url, safe='')


def rewrite_playlist(text, base):
    out = []
    for line in text.splitlines():
        s = line.strip()
        if s and not s.startswith('#'):
            out.append(proxied(urllib.parse.urljoin(base, s)))
        else:
            out.append(re.sub(r'URI="([^"]+)"', lambda m: 'URI="%s"' % proxied(urllib.parse.urljoin(base, m.group(1))), line))
    return '\n'.join(out)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def do_GET(self):
        if not self.path.startswith('/proxy?'):
            return super().do_GET()
        url = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get('u', [''])[0]
        host = urllib.parse.urlparse(url).hostname or ''
        if not url.startswith('https://') or not ALLOWED.search(host):
            self.send_error(403, 'Host não permitido no proxy de testes')
            return
        try:
            headers = {'User-Agent': 'Mozilla/5.0', 'Origin': 'https://pluto.tv', 'Referer': 'https://pluto.tv/'}
            if self.headers.get('Authorization'):
                headers['Authorization'] = self.headers['Authorization']
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=20) as r:
                body, ctype, final = r.read(), r.headers.get('Content-Type', ''), r.geturl()
            if 'mpegurl' in ctype.lower() or urllib.parse.urlparse(final).path.endswith('.m3u8'):
                body = rewrite_playlist(body.decode('utf-8', 'replace'), final).encode()
                ctype = 'application/vnd.apple.mpegurl'
            self.send_response(200)
            self.send_header('Content-Type', ctype or 'application/octet-stream')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:  # noqa: BLE001 - ferramenta de teste
            self.send_error(502, str(e)[:200])

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        self.end_headers()

    def log_message(self, fmt, *args):
        if '/proxy?' not in (args[0] if args else ''):
            super().log_message(fmt, *args)


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(('127.0.0.1', port), Handler) as srv:
        print('Mophie TV dev em http://127.0.0.1:%d' % port)
        srv.serve_forever()
