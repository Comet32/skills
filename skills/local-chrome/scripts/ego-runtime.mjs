// Runs INSIDE `ego-browser nodejs` (loaded by ego.mjs). Gives a steps file the same context object
// cdp.mjs gives it — open / log / sleep / base / snippets / outDir — backed by ego-browser instead of
// the user's Chrome, so no DevTools "Allow" prompt is involved.
//
// ego-browser's SDK functions (taskSpace, …) are only in scope of the script ego-browser runs, so
// ego.mjs passes them in as `sdk`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as snippets from './snippets.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Wrap an ego-browser Page in the page API steps files are written against (see cdp.mjs). */
function adapt(egoPage, { toUrl, outDir }) {
  const page = {
    /** The underlying ego-browser Page, for its richer API (click by text, fill, snapshot, …). */
    ego: egoPage,
    /** Evaluate an expression in the page (awaits promises, returns by value). */
    eval: expr => egoPage.evaluate(expr),
    /** Poll an expression until it is truthy. */
    async waitFor(expr, timeout = 30000, label = expr) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) {
        try { if (await egoPage.evaluate(expr)) return true; } catch { /* page still loading */ }
        await sleep(400);
      }
      throw new Error(`waitFor timed out: ${label}`);
    },
    /** Wait for the page to load and install the helper functions (__vis, __byText, __click, …). */
    async ready(timeout = 60000) {
      await page.waitFor(`document.readyState === 'complete' && location.href !== 'about:blank'`, timeout, 'page load');
      await egoPage.evaluate(snippets.HELPERS);
    },
    /** Screenshot to <outDir>/<name>.png; { fullPage: true } captures beyond the viewport. */
    async shot(name, { fullPage = false } = {}) {
      const file = `${outDir}/${name}.png`;
      await egoPage.screenshot({ path: file, fullPage });
      return file;
    },
    /** Real mouse click at viewport coordinates. */
    clickAt: (x, y) => egoPage.mouse.click(x, y),
    /** Real mouse click at the centre of the first visible element matching a CSS selector (scrolls it into view). */
    async clickSelector(selector) {
      const box = await egoPage.evaluate(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find(__vis); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
      if (!box) throw new Error(`no visible element: ${selector}`);
      await egoPage.mouse.click(box.x, box.y);
    },
    /** Type into whatever has focus (fires real input events). */
    insertText: text => egoPage.keyboard.insertText(text),
    /** Press one key by its name, e.g. key('Enter'); code/keyCode are accepted for cdp.mjs compatibility. */
    key: key => egoPage.keyboard.press(key),
    setViewport: (w, h) => egoPage.cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }),
    /** Navigate this page and wait for the new page to load (helpers re-installed). */
    async navigate(u) {
      await egoPage.goto(toUrl(u), { timeout: 90000 });
      await page.ready();
    },
    sleep,
  };
  return page;
}

/** Run a steps file. Returns the exit code: 0 all passed · 1 a check failed or the steps threw. */
export async function run({ stepsFile, outDir, base, keepOpen }, sdk) {
  mkdirSync(outDir, { recursive: true });
  const toUrl = u => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return u; // http:, https:, file:, data:, about:
    if (!base) throw new Error(`relative URL "${u}" needs --base <origin>`);
    return base + (u.startsWith('/') ? u : `/${u}`);
  };

  const task = await sdk.taskSpace(`local-chrome ${Date.now()}`);
  const opened = [];

  async function open(url, { width = 1440, height = 900 } = {}) {
    // A new task space starts with p1: use it for the first open(), new pages after that.
    const egoPage = opened.length ? await task.newPage() : task.page('p1');
    if (width && height) await egoPage.cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await egoPage.goto(toUrl(url), { timeout: 90000 });
    opened.push(egoPage);
    return adapt(egoPage, { toUrl, outDir });
  }

  const results = [];
  const log = (check, pass, detail = '') => {
    results.push({ check, pass: !!pass, detail });
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${check}${detail ? `  ${detail}` : ''}`);
  };
  try {
    const steps = await import(pathToFileURL(stepsFile).href);
    await steps.default({ open, log, sleep, base, snippets, outDir });
  } catch (e) {
    log('steps', false, e.message);
  }
  writeFileSync(`${outDir}/results.json`, JSON.stringify({ base, driver: 'ego-browser', results }, null, 2));
  console.log(`${results.filter(r => r.pass).length}/${results.length} passed · screenshots and results.json in ${outDir}`);

  if (keepOpen) {
    // Drop the emulated viewport so the page fits the window again, then hand the pages to the user.
    for (const p of opened) await p.cdp('Emulation.clearDeviceMetricsOverride', {}).catch(() => {});
    await task.finish({ keep: opened.map(p => p.label) });
    console.log(`pages ${opened.map(p => p.label).join(', ')} left open in ego-browser (--keep-open)`);
  } else {
    await task.finish({ keep: [] });
  }
  return results.some(r => !r.pass) ? 1 : 0;
}
