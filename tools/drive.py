#!/usr/bin/env python3
"""CDP driver: goto URL, run scripted steps (wait/click/shot/eval). Usage: drive.py <json_steps>"""
import socket, base64, json, os, sys, time, urllib.request, struct, tempfile, subprocess

STEPS = json.loads(sys.argv[1])
PORT = 9241

def get_ws_url(want):
    for _ in range(40):
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{PORT}/json/list', timeout=3) as r:
                targets = json.loads(r.read().decode())
            for t in targets:
                if t.get('type') == 'page' and 'webSocketDebuggerUrl' in t and t.get('url', '').split('?')[0] == want.split('?')[0]:
                    return t['webSocketDebuggerUrl']
        except Exception:
            pass
        time.sleep(1)
    raise RuntimeError('no page target')

class WS:
    def __init__(self, url):
        hostport, path = url[5:].split('/', 1)
        host, port = hostport.split(':')
        self.s = socket.create_connection((host, int(port)), timeout=30)
        key = base64.b64encode(os.urandom(16)).decode()
        self.s.sendall((f'GET /{path} HTTP/1.1\r\nHost: {hostport}\r\nUpgrade: websocket\r\n'
                        f'Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
        data = b''
        while b'\r\n\r\n' not in data:
            data += self.s.recv(4096)
        self.id = 0; self.buf = b''
    def call(self, method, params=None, timeout=30):
        self.id += 1; mid = self.id
        raw = json.dumps({'id': mid, 'method': method, 'params': params or {}}).encode()
        mask = os.urandom(4); n = len(raw)
        frame = bytes([0x81])
        if n < 126: frame += bytes([0x80 | n])
        elif n < 65536: frame += struct.pack('>BH', 0x80 | 126, n)
        else: frame += struct.pack('>BQ', 0x80 | 127, n)
        self.s.sendall(frame + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(raw)))
        end = time.time() + timeout
        while time.time() < end:
            while True:
                if len(self.buf) >= 2:
                    b1, b2 = self.buf[0], self.buf[1]
                    ln = b2 & 0x7f; idx = 2
                    if ln == 126: ln = struct.unpack('>H', self.buf[2:4])[0]; idx = 4
                    elif ln == 127: ln = struct.unpack('>Q', self.buf[2:10])[0]; idx = 10
                    if len(self.buf) >= idx + ln:
                        payload = self.buf[idx:idx+ln]; self.buf = self.buf[idx+ln:]
                        if b1 & 0x0f == 0x8: raise RuntimeError('ws closed')
                        try: m = json.loads(payload.decode())
                        except Exception: continue
                        if m.get('id') == mid:
                            if 'error' in m: raise RuntimeError(f"CDP {method}: {m['error']}")
                            return m.get('result', {})
                        continue
                break
            chunk = self.s.recv(65536)
            if not chunk: raise RuntimeError('ws eof')
            self.buf += chunk
        raise RuntimeError('timeout ' + method)

url = STEPS[0]['url']
wsize = STEPS[0].get('size', '1280,800')
udir = tempfile.mkdtemp(prefix='agbero-drive-')
proc = subprocess.Popen(['/opt/meta-chromium/chrome', '--headless=new', f'--remote-debugging-port={PORT}',
                         f'--user-data-dir={udir}', '--no-sandbox',
                         f'--window-size={wsize}', url],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    ws = WS(get_ws_url(url))
    for st in STEPS[1:]:
        if st['op'] == 'wait':
            time.sleep(st['s'])
        elif st['op'] == 'click':
            x, y = st['x'], st['y']
            ws.call('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': x, 'y': y, 'button': 'left', 'clickCount': 1})
            time.sleep(0.1)
            ws.call('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': x, 'y': y, 'button': 'left', 'clickCount': 1})
            time.sleep(st.get('after', 1))
        elif st['op'] == 'touch':
            x, y = st['x'], st['y']
            ws.call('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y, 'id': 1}]})
            time.sleep(0.12)
            ws.call('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
            time.sleep(st.get('after', 1))
        elif st['op'] == 'shot':
            out = os.path.expanduser(st['out'])
            os.makedirs(os.path.dirname(out), exist_ok=True)
            m = ws.call('Page.captureScreenshot', {'format': 'png'}, timeout=60)
            with open(out, 'wb') as f:
                f.write(base64.b64decode(m['data']))
            print('wrote', out)
        elif st['op'] == 'eval':
            m = ws.call('Runtime.evaluate', {'expression': st['js'], 'awaitPromise': True, 'returnByValue': True}, timeout=30)
            r = m.get('result', {})
            inner = r.get('result', r)
            print('eval:', json.dumps(inner)[:400])
finally:
    proc.terminate()
print('drive done')
