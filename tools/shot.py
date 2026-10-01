#!/usr/bin/env python3
"""CDP screenshot for local file:// pages. Usage: shot.py <file_url> <out.png> [wait_sec]"""
import socket, base64, json, os, sys, time, urllib.request, struct

URL, OUT = sys.argv[1], sys.argv[2]
WAIT = float(sys.argv[3]) if len(sys.argv) > 3 else 6
PORT = 9234

def get_ws_url():
    for _ in range(40):
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{PORT}/json/list', timeout=3) as r:
                targets = json.loads(r.read().decode())
            print('TARGETS:', [(t.get('type'), t.get('url', '')[:60]) for t in targets], file=sys.stderr)
            for t in targets:
                if t.get('type') == 'page' and 'webSocketDebuggerUrl' in t and t.get('url', '').split('?')[0] == URL.split('?')[0]:
                    print('USING:', t['url'][:80], file=sys.stderr)
                    return t['webSocketDebuggerUrl']
        except Exception as e:
            print('list err', e, file=sys.stderr)
        time.sleep(1)
    raise RuntimeError('no debuggable page target')

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
        if b'101' not in data.split(b'\r\n')[0]:
            raise RuntimeError('WS handshake failed')
        self.id = 0
        self.buf = b''
    def send(self, method, params=None):
        self.id += 1
        msg = json.dumps({'id': self.id, 'method': method, 'params': params or {}})
        raw = msg.encode()
        mask = os.urandom(4)
        frame = bytes([0x81])
        n = len(raw)
        if n < 126:
            frame += bytes([0x80 | n])
        elif n < 65536:
            frame += struct.pack('>BH', 0x80 | 126, n)
        else:
            frame += struct.pack('>BQ', 0x80 | 127, n)
        frame += mask + bytes(b ^ mask[i % 4] for i, b in enumerate(raw))
        self.s.sendall(frame)
        return self.id
    def recv_msg(self, want_id, timeout=30):
        end = time.time() + timeout
        while time.time() < end:
            while True:
                if len(self.buf) >= 2:
                    opcode = self.buf[0] & 0x0f
                    ln = self.buf[1] & 0x7f
                    idx = 2
                    if ln == 126:
                        ln = struct.unpack('>H', self.buf[2:4])[0]; idx = 4
                    elif ln == 127:
                        ln = struct.unpack('>Q', self.buf[2:10])[0]; idx = 10
                    if len(self.buf) >= idx + ln:
                        payload = self.buf[idx:idx+ln]
                        self.buf = self.buf[idx+ln:]
                        if opcode == 0x8:
                            raise RuntimeError('ws closed')
                        try:
                            m = json.loads(payload.decode())
                        except Exception:
                            continue
                        if m.get('id') == want_id:
                            return m
                        continue
                break
            chunk = self.s.recv(65536)
            if not chunk:
                raise RuntimeError('ws eof')
            self.s.settimeout(2)
            self.buf += chunk
        raise RuntimeError('timeout waiting for ' + str(want_id))

CHROME = '/opt/meta-chromium/chrome'
import tempfile
UDIR = tempfile.mkdtemp(prefix='agbero-shot-')
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
import subprocess
proc = subprocess.Popen([CHROME, '--headless=new', f'--remote-debugging-port={PORT}',
                          f'--user-data-dir={UDIR}', '--no-sandbox', '--disable-gpu',
                          '--window-size=1280,800', URL],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    ws = WS(get_ws_url())
    time.sleep(WAIT)
    mid = ws.send('Page.captureScreenshot', {'format': 'png'})
    m = ws.recv_msg(mid)
    data = base64.b64decode(m['result']['data'])
    with open(OUT, 'wb') as f:
        f.write(data)
    print('wrote', OUT, len(data), 'bytes')
finally:
    proc.terminate()
