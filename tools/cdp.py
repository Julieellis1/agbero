#!/usr/bin/env python3
"""Minimal CDP client for the Agbero game tests (pure stdlib).
Usage: cdp.py <port> [js-expression]
Assumes Chromium was launched with --remote-debugging-port=<port> and the
game dist/index.html as the startup page (avoids LNA navigation blocks)."""
import socket, base64, json, os, sys, time, urllib.request

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9334
EXPR = sys.argv[2] if len(sys.argv) > 2 else "document.title"

def get_ws_url():
    with urllib.request.urlopen(f'http://127.0.0.1:{PORT}/json/list', timeout=5) as r:
        targets = json.loads(r.read().decode())
    for x in targets:
        if x.get('type') == 'page' and 'webSocketDebuggerUrl' in x and 'index.html' in x.get('url', ''):
            return x['webSocketDebuggerUrl']
    raise RuntimeError('no page')

url = get_ws_url()
hostport, path = url[5:].split('/', 1)
host, port = hostport.split(':')
s = socket.create_connection((host, int(port)), timeout=30)
key = base64.b64encode(os.urandom(16)).decode()
s.sendall((f'GET /{path} HTTP/1.1\r\nHost: {hostport}\r\nUpgrade: websocket\r\n'
           f'Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\n'
           f'Sec-WebSocket-Version: 13\r\n\r\n').encode())
data = b''
while b'\r\n\r\n' not in data:
    data += s.recv(4096)
buf = data.split(b'\r\n\r\n', 1)[1]

def recvn(n):
    global buf
    while len(buf) < n:
        buf += s.recv(65536)
    out, buf = buf[:n], buf[n:]
    return out

def send(payload):
    mask = os.urandom(4); n = len(payload)
    hdr = bytes([0x81, 0x80 | n]) if n < 126 else bytes([0x81, 0x80 | 126]) + n.to_bytes(2, 'big')
    s.sendall(hdr + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(payload)))

_mid = [0]
def call(method, params=None, timeout=25):
    _mid[0] += 1; mid = _mid[0]
    send(json.dumps({'id': mid, 'method': method, 'params': params or {}}).encode())
    end = time.time() + timeout
    while time.time() < end:
        h = recvn(2); ln = h[1] & 0x7f
        if ln == 126: ln = int.from_bytes(recvn(2), 'big')
        elif ln == 127: ln = int.from_bytes(recvn(8), 'big')
        raw = recvn(ln)
        try: msg = json.loads(raw.decode())
        except Exception: continue
        if msg.get('id') == mid:
            return msg.get('result', {})
    raise RuntimeError('timeout ' + method)

def ev(expr):
    r = call('Runtime.evaluate', {'expression': expr, 'awaitPromise': True, 'returnByValue': True})
    if 'exceptionDetails' in r:
        return 'JS-ERROR: ' + json.dumps(r['exceptionDetails'])[:300]
    return r.get('result', {}).get('value')

print(ev(EXPR))
