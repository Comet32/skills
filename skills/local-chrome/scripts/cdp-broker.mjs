#!/usr/bin/env node
// Resident CDP broker: holds ONE DevTools connection to the user's Chrome, so Chrome's "Allow"
// prompt appears once per broker instead of once per run. cdp.mjs --broker sends its commands
// to it over HTTP on 127.0.0.1.
//
// Opt-in only: start it, or pass --broker, only when the user has agreed in the current
// conversation. While it runs, any local process holding the secret can drive the user's
// logged-in Chrome.
//
// usage: node cdp-broker.mjs start [--idle-minutes 240] [--port 9334] [--chrome-port <port>]
//        node cdp-broker.mjs status | stop
// exit:  0 ok · 2 bad usage · 3 Chrome unreachable or Allow not clicked · 4 not running (status/stop)
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { appendFileSync, chmodSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const DIR = `${homedir()}/.cache/local-chrome/broker`;
const STATE = `${DIR}/state.json`;
const LOG = `${DIR}/broker.log`;
// Page automation only. Browser.*, Storage.*, Network cookie access etc. stay closed.
const ALLOWED_DOMAINS = new Set(['Target', 'Page', 'Runtime', 'Emulation', 'Input']);
const CHROME_PORT_DEFAULT = 9222;

/**
 * The port Chrome's DevTools listens on: $CHROME_CDP_PORT, else 9222 when Chrome listens there,
 * else Chrome's only loopback listener (the chrome://inspect toggle may pick a random port), else 9222.
 */
export function findChromePort() {
  if (process.env.CHROME_CDP_PORT) return Number(process.env.CHROME_CDP_PORT);
  try {
    const out = execFileSync('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-a', '-c', 'Google'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const ports = [...new Set([...out.matchAll(/127\.0\.0\.1:(\d+) \(LISTEN\)/g)].map(m => Number(m[1])))];
    if (ports.includes(CHROME_PORT_DEFAULT)) return CHROME_PORT_DEFAULT;
    if (ports.length === 1) return ports[0];
  } catch {
    // lsof exits non-zero when nothing matches (or is missing on this OS)
  }
  return CHROME_PORT_DEFAULT;
}

const args = process.argv.slice(2);
const cmd = args.shift();
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i < 0 ? dflt : args[i + 1]; };

function readState() {
  try { return JSON.parse(readFileSync(STATE, 'utf8')); } catch { return null; }
}
function alive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}
async function call(state, path, body) {
  const r = await fetch(`http://127.0.0.1:${state.port}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'x-broker-secret': state.secret, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return r.json();
}

// The CLI runs only when this file is executed; cdp.mjs imports from it.
// Compare real paths: the skill is often installed as a symlink, which argv[1] keeps and import.meta.url resolves.
if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  if (cmd === 'serve') await serve();
  else if (cmd === 'start') await start();
  else if (cmd === 'status') await status();
  else if (cmd === 'stop') await stop();
  else {
    console.error('usage: node cdp-broker.mjs start [--idle-minutes 240] [--port 9334] [--chrome-port <port>] | status | stop');
    process.exit(2);
  }
}

// ---- start: spawn a detached `serve` and wait until it reports connected (or fails) -------------
async function start() {
  const existing = readState();
  if (existing && alive(existing.pid)) {
    console.log(`already running: pid ${existing.pid}, port ${existing.port}, since ${existing.startedAt}`);
    return;
  }
  mkdirSync(DIR, { recursive: true, mode: 0o700 });
  rmSync(STATE, { force: true });
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'serve', ...args], { detached: true, stdio: 'ignore' });
  child.unref();
  console.log('Connecting to Chrome — click "Allow" in Chrome now (waiting up to 120 s)…');
  const t0 = Date.now();
  while (Date.now() - t0 < 125000) {
    await new Promise(r => setTimeout(r, 500));
    const s = readState();
    if (s?.pid === child.pid) {
      console.log(`broker running: pid ${s.pid}, port ${s.port}, idle exit after ${s.idleMinutes} min`);
      return;
    }
    if (!alive(child.pid)) break;
  }
  if (alive(child.pid)) process.kill(child.pid);
  console.error(`broker did not connect (Allow not clicked, or Chrome remote debugging off). Log: ${LOG}`);
  process.exit(3);
}

async function status() {
  const s = readState();
  if (!s || !alive(s.pid)) { console.log('not running'); process.exit(4); }
  const st = await call(s, '/status').catch(e => ({ error: e.message }));
  console.log(JSON.stringify({ pid: s.pid, port: s.port, startedAt: s.startedAt, idleMinutes: s.idleMinutes, ...st }));
}

async function stop() {
  const s = readState();
  if (!s || !alive(s.pid)) { rmSync(STATE, { force: true }); console.log('not running'); process.exit(4); }
  await call(s, '/stop', {}).catch(() => process.kill(s.pid));
  console.log(`stopped pid ${s.pid}`);
}

// ---- serve: the resident process ----------------------------------------------------------------
async function serve() {
  const port = Number(opt('port', 9334));
  const chromePort = Number(opt('chrome-port', findChromePort()));
  const idleMinutes = Number(opt('idle-minutes', 240));
  const log = msg => appendFileSync(LOG, `${new Date().toISOString()} ${msg}\n`);
  const secret = randomBytes(32).toString('hex');

  const ws = new WebSocket(`ws://127.0.0.1:${chromePort}/devtools/browser`);
  let nextId = 1;
  const pending = new Map();
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); p(m); }
  };
  try {
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('refused')); });
  } catch {
    log(`could not connect to Chrome on ${chromePort}`);
    process.exit(3);
  }
  const shutdown = reason => {
    log(`exit: ${reason}`);
    const s = readState();
    if (s?.pid === process.pid) rmSync(STATE, { force: true });
    try { ws.close(); } catch { /* closed */ }
    process.exit(0);
  };
  ws.onclose = () => shutdown('Chrome closed the DevTools connection');

  let lastUsed = Date.now();
  setInterval(() => { if (Date.now() - lastUsed > idleMinutes * 60000) shutdown(`idle for ${idleMinutes} min`); }, 30000).unref();

  const send = (method, params = {}, sessionId, timeoutMs = 60000) => new Promise(resolve => {
    const id = nextId++;
    const timer = setTimeout(() => { pending.delete(id); resolve({ error: { message: `CDP ${method} timed out` } }); }, timeoutMs);
    pending.set(id, m => { clearTimeout(timer); resolve(m); });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const secretOk = h => {
    const a = Buffer.from(String(h || '')), b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b);
  };

  const server = createServer((req, res) => {
    const reply = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    // A web page could reach 127.0.0.1 with fetch(); browsers always send Origin, local clients do not.
    if (req.headers.origin || !secretOk(req.headers['x-broker-secret'])) return reply(403, { error: 'forbidden' });
    if (req.method === 'GET' && req.url === '/status') return reply(200, { chromeConnected: ws.readyState === 1, chromePort, lastUsed: new Date(lastUsed).toISOString() });
    if (req.method !== 'POST') return reply(404, { error: 'not found' });
    let body = '';
    req.on('data', c => { body += c; if (body.length > 5e6) req.destroy(); });
    req.on('end', async () => {
      if (req.url === '/stop') { reply(200, { ok: true }); return setTimeout(() => shutdown('stop requested'), 50); }
      if (req.url !== '/send') return reply(404, { error: 'not found' });
      let msg;
      try { msg = JSON.parse(body); } catch { return reply(400, { error: 'bad json' }); }
      const domain = String(msg.method || '').split('.')[0];
      if (!ALLOWED_DOMAINS.has(domain)) return reply(403, { error: `CDP domain not allowed through the broker: ${domain}` });
      lastUsed = Date.now();
      const m = await send(msg.method, msg.params, msg.sessionId, msg.timeoutMs);
      reply(200, m.error ? { error: m.error } : { result: m.result });
    });
  });
  server.on('error', e => { log(`http: ${e.message}`); shutdown('http server error'); });
  server.listen(port, '127.0.0.1', () => {
    mkdirSync(DIR, { recursive: true, mode: 0o700 });
    writeFileSync(STATE, JSON.stringify({ pid: process.pid, port, chromePort, secret, startedAt: new Date().toISOString(), idleMinutes }), { mode: 0o600 });
    chmodSync(STATE, 0o600);
    log(`listening on 127.0.0.1:${port} (Chrome ${chromePort}), idle exit ${idleMinutes} min`);
  });
  for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(sig, () => shutdown(sig));
}

/** A send() with the same shape as a direct CDP client, or null when no broker is running. */
export function brokerClient() {
  const s = readState();
  if (!s || !alive(s.pid)) return null;
  return {
    async send(method, params = {}, sessionId, timeoutMs) {
      const r = await call(s, '/send', { method, params, sessionId, timeoutMs });
      if (r.error) throw new Error(typeof r.error === 'string' ? r.error : JSON.stringify(r.error));
      return r.result;
    },
  };
}
