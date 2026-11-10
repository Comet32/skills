---
name: local-chrome
description: Drive this computer's Chrome from a script — new foreground tab with your logins, click/type/assert, screenshots — over the DevTools port on 127.0.0.1.
disable-model-invocation: true
---

# local-chrome

`scripts/cdp.mjs` connects to the Chrome on this machine through its DevTools port on `127.0.0.1` (auto-detected; 9222 by default). It opens a **foreground** tab that already carries the user's cookies and SSO sessions, runs a *steps file* you write against it, saves screenshots plus `results.json`, and closes the tabs it opened. Below, `<skill-dir>` is the folder that holds this SKILL.md; the scripts take absolute paths, so they work from any working directory. Needs Node 22+ (built-in `WebSocket`).

## Rules

- **This machine's Chrome only**, through `127.0.0.1`. Claude in Chrome may be routed to another person's computer, so it is never the route for this.
- **Leave the user's tabs alone.** The driver touches and closes only the tabs it opened.
- **Data on shared systems**: write only to a throwaway record, and remove it in `finally`, also after a run that stopped half-way. Report what stays behind (history rows, audit logs). Purchases, messages sent to people and other outward actions need the user's yes first, as anywhere else.

## Steps

1. **Write the steps file** in the scratchpad, starting from [`references/example-steps.mjs`](references/example-steps.mjs). On a page you have not seen, make the first run a look-around: `S.summary`, `S.controls` and a `shot()`, then choose selectors from what came back. Before touching an editor, a picker, a dialog, a toast or an in-flight state, read [`references/page-gotchas.md`](references/page-gotchas.md). Done when every claim you are testing maps to one `log()` check, and every check whose evidence is visual has a `shot()` next to it.
2. **Run it, foreground, with a long timeout** (≥ 300000 ms — the first call waits on the user):
   ```bash
   node <skill-dir>/scripts/cdp.mjs <steps.mjs> <outDir> [--base https://host] [--keep-open]
   ```
   Tell the user beforehand that Chrome will ask them to **Allow** the DevTools connection. Exit 3 means Chrome was unreachable: remote debugging is off (the user enables it at `chrome://inspect/#remote-debugging`) or Allow was refused or never answered. Ask the user to fix that, then run once more. A run in the background cannot get the prompt answered. `--keep-open` leaves the tab for the user to continue in.
3. **Read every FAIL against its screenshot** before calling it a page bug: a wrong selector, a stale assumption about data, or a page that loaded in another state fails the same way. Fix the steps, clean up what a stopped run wrote, and rerun into a **new** `outDir`.
4. **Look at each screenshot you will cite** (Read the PNG). Report the pass count, every FAIL with its detail, and the screenshot paths. Exit 0 means every check passed.

## Steps-file API

A steps file is an ES module whose default export receives one context object:

| Name | What it is |
|------|------------|
| `open(url, {width, height})` | Opens a foreground tab (1440×900 by default; `width: 0` keeps the window's size). A relative path resolves against `--base`. Returns `page`. |
| `log(check, pass, detail)` | Records one check; prints `PASS`/`FAIL`. |
| `snippets` | Page-side JS expressions from `scripts/snippets.mjs` (each export is documented there). |
| `base`, `outDir`, `sleep(ms)` | As named. |

`page`: `ready()` (wait for load, install the helpers every snippet relies on), `eval(expr)`, `waitFor(expr, timeoutMs, label)`, `shot(name, {fullPage})` → PNG path, `clickSelector(css)` / `clickAt(x, y)` (real mouse events), `insertText(text)` (types into the focused element), `key(key, code, keyCode)`, `setViewport(w, h)`, `navigate(url)` (waits for the new page).

Check stored state from inside the tab — `page.eval("fetch('/api/…', {credentials:'include'}).then(r => r.json())")` runs with the user's session — rather than from the screen.

## Resident broker

Every new DevTools connection makes Chrome ask for **Allow**. `scripts/cdp-broker.mjs` holds one approved connection open and serves commands to `cdp.mjs --broker`, so the user clicks Allow once per broker. While it runs, any local process that can read its secret (`~/.cache/local-chrome/broker/state.json`, mode 600) can drive the user's logged-in Chrome.

- **Consent first, every conversation.** Start the broker, or pass `--broker`, only after the user agreed to it in this conversation — ask when the Allow prompts get in the way: "要开常驻代理吗？之后只需点一次 Allow，直到 Chrome 重启或代理退出" — or when they said to use it. A broker already running from an earlier conversation still needs that consent before you use it.
- `node <skill-dir>/scripts/cdp-broker.mjs start [--idle-minutes 240]` — run in the foreground; it waits up to 120 s for the Allow click, then detaches. `status` reports it; `stop` ends it. It also exits when Chrome closes the connection or after the idle time.
- It listens on `127.0.0.1:9334` only, requires the secret on every request, rejects any request carrying an `Origin` header (a web page's `fetch`), and passes only the `Target`, `Page`, `Runtime`, `Emulation` and `Input` CDP domains.
- When the work that needed it is done, offer to `stop` it.
