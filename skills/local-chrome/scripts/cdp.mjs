#!/usr/bin/env node
// Drives the user's own Chrome over its DevTools port (127.0.0.1): opens a foreground tab that
// reuses the user's logins, runs a steps file against it, saves screenshots and results.json,
// and closes the tabs it opened.
//
// usage: node cdp.mjs <steps.mjs> <outDir> [--base <url>] [--port <port>] [--broker] [--keep-open]
//   --base       origin that relative paths in open()/navigate() resolve against (e.g. http://localhost:3000)
//   --port       Chrome's DevTools port; default $CHROME_CDP_PORT, else auto-detected, else 9222
//   --broker     send commands through the resident broker (cdp-broker.mjs) instead of opening a new
//                DevTools connection, so Chrome does not ask for "Allow" again. Only with the user's OK.
//   --keep-open  leave the opened tabs open for the user when the run ends
// exit:  0 every check passed · 1 a check failed or the steps threw · 2 bad usage · 3 Chrome unreachable
//        · 4 --broker given but no broker running
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as snippets from './snippets.mjs';
import { brokerClient, findChromePort } from './cdp-broker.mjs';

const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(`--${name}`); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };
const bool = name => { const i = args.indexOf(`--${name}`); if (i < 0) return false; args.splice(i, 1); return true; };
const base = flag('base')?.replace(/\/$/, '');
const port = Number(flag('port') || findChromePort());
const useBroker = bool('broker');
const keepOpen = bool('keep-open');
const [stepsFile, outDirArg] = args;
if (!stepsFile || !outDirArg) {
  console.error('usage: node cdp.mjs <steps.mjs> <outDir> [--base <url>] [--port <port>] [--broker] [--keep-open]');
  process.exit(2);
}
const outDir = resolve(outDirArg);
mkdirSync(outDir, { recursive: true });

const toUrl = u => {
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return u; // http:, https:, file:, data:, about:
  if (!base) throw new Error(`relative URL "${u}" needs --base <origin>`);
  return base + (u.startsWith('/') ? u : `/${u}`);
};

// ---- CDP transport: the resident broker (--broker) or one browser-level WebSocket ---------------
let send;
let closeTransport = () => {};
if (useBroker) {
  const broker = brokerClient();
  if (!broker) {
    console.error('--broker given but no broker is running. Start it only with the user\'s OK: ' +
      'node cdp-broker.mjs start (they click "Allow" once).');
    process.exit(4);
  }
  send = (method, params = {}, sessionId) => broker.send(method, params, sessionId);
} else {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/devtools/browser`);
  let nextId = 1;
  const pending = new Map();
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
    }
  };
  send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const id = nextId++;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error(`CDP timeout: ${method}`)); } }, 60000);
  });
  try {
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('refused')); });
  } catch {
    console.error(`Cannot reach Chrome on 127.0.0.1:${port}. Either remote debugging is off ` +
      '(chrome://inspect/#remote-debugging → enable) or the user did not click "Allow" on the DevTools ' +
      'prompt. Ask them to fix that, then run this again.');
    process.exit(3);
  }
  closeTransport = () => ws.close();
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const pages = [];

async function open(url, { width = 1440, height = 900 } = {}) {
  // Foreground on purpose: a hidden tab pauses requestAnimationFrame, and editors and charts
  // measure their size in one, so they render collapsed in a background tab.
  const { targetId } = await send('Target.createTarget', { url: 'about:blank', background: false });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Page.bringToFront', {}, sessionId);
  if (width && height) await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
  await send('Page.navigate', { url: toUrl(url) }, sessionId);

  const mouse = async (x, y) => {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }, sessionId);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }, sessionId);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }, sessionId);
  };
  const page = {
    targetId, sessionId,
    /** Evaluate an expression in the page (awaits promises, returns by value). */
    async eval(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
    /** Poll an expression until it is truthy. */
    async waitFor(expr, timeout = 30000, label = expr) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) {
        try { if (await page.eval(expr)) return true; } catch { /* page still loading */ }
        await sleep(400);
      }
      throw new Error(`waitFor timed out: ${label}`);
    },
    /** Wait for the page to load and install the helper functions (__vis, __byText, __click, …). */
    async ready(timeout = 60000) {
      await sleep(300); // let a just-issued navigation replace the old document first
      await page.waitFor(`document.readyState === 'complete' && location.href !== 'about:blank'`, timeout, 'page load');
      await page.eval(snippets.HELPERS);
    },
    /** Screenshot to <outDir>/<name>.png; { fullPage: true } captures beyond the viewport. */
    async shot(name, { fullPage = false } = {}) {
      const params = { format: 'png' };
      if (fullPage) {
        const { cssContentSize: s } = await send('Page.getLayoutMetrics', {}, sessionId);
        Object.assign(params, { captureBeyondViewport: true, clip: { x: 0, y: 0, width: s.width, height: s.height, scale: 1 } });
      }
      const { data } = await send('Page.captureScreenshot', params, sessionId);
      const file = `${outDir}/${name}.png`;
      writeFileSync(file, Buffer.from(data, 'base64'));
      return file;
    },
    /** Real mouse click at viewport coordinates. */
    clickAt: mouse,
    /** Real mouse click at the centre of the first visible element matching a CSS selector (scrolls it into view). */
    async clickSelector(selector) {
      const box = await page.eval(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find(__vis); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
      if (!box) throw new Error(`no visible element: ${selector}`);
      await mouse(box.x, box.y);
    },
    /** Type into whatever has focus (fires real input events). */
    async insertText(text) { await send('Input.insertText', { text }, sessionId); },
    /** Press one key, e.g. key('Enter', 'Enter', 13), key('Tab', 'Tab', 9), key('Escape', 'Escape', 27). */
    async key(key, code = key, keyCode) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode }, sessionId);
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode }, sessionId);
    },
    async setViewport(w, h) { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }, sessionId); },
    /** Navigate this tab and wait for the new page to load (helpers re-installed). */
    async navigate(u) {
      // Mark the old document so ready() cannot mistake it for the new one.
      await page.eval('window.__lcOldDoc = true').catch(() => {});
      await send('Page.navigate', { url: toUrl(u) }, sessionId);
      await page.waitFor('!window.__lcOldDoc', 60000, `navigation to ${u}`);
      await page.ready();
    },
    sleep,
  };
  pages.push(page);
  return page;
}

// ---- Run ---------------------------------------------------------------------------------------
const results = [];
const log = (check, pass, detail = '') => {
  results.push({ check, pass: !!pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${check}${detail ? `  ${detail}` : ''}`);
};
let failed = false;
try {
  const steps = await import(pathToFileURL(resolve(stepsFile)).href);
  await steps.default({ open, log, sleep, base, snippets, outDir });
} catch (e) {
  log('steps', false, e.message);
} finally {
  failed = results.some(r => !r.pass);
  writeFileSync(`${outDir}/results.json`, JSON.stringify({ base, results }, null, 2));
  if (keepOpen) {
    // Drop the emulated viewport so the tab fits the user's window again.
    for (const p of pages) await send('Emulation.clearDeviceMetricsOverride', {}, p.sessionId).catch(() => {});
  } else {
    for (const p of pages) await send('Target.closeTarget', { targetId: p.targetId }).catch(() => {});
  }
  closeTransport();
}
console.log(`${results.filter(r => r.pass).length}/${results.length} passed · screenshots and results.json in ${outDir}`);
process.exit(failed ? 1 : 0);
