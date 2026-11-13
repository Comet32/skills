// Example steps file. Runs under either driver. Copy it to the scratchpad and adapt. Run:
//   node <skill-dir>/scripts/ego.mjs steps.mjs <outDir> [--base https://app.example.com]   (default: ego-browser)
//   node <skill-dir>/scripts/cdp.mjs steps.mjs <outDir> [--base https://app.example.com]   (fallback: the user's Chrome)
// Shapes shown: a first look at an unknown page, typing + a real click, an assertion behind the page,
// and a write that cleans up after itself.

export default async function ({ open, log, snippets: S }) {
  // 1. First look: open the page and learn what is on it before scripting against it.
  const p = await open('https://app.example.com/items');   // or '/items' with --base
  await p.ready();
  await p.waitFor(S.heading('Items'), 30000, 'Items heading');
  console.log(JSON.stringify(await p.eval(S.summary), null, 2));
  console.log(JSON.stringify(await p.eval(S.controls), null, 2)); // pick selectors from this, not guesses
  log('the Items page loads with the user logged in', !(await p.eval(`/login|signin/i.test(location.href)`)));
  await p.shot('01-items');

  // 2. Interact: type into a field, then a real mouse click (some widgets ignore element.click()).
  await p.eval(S.focusInput('Search'));
  await p.insertText('throwaway');
  await p.key('Enter', 'Enter', 13);
  await p.waitFor(S.hasText('throwaway'), 15000, 'search result');
  await p.clickSelector('table tbody tr');
  log('opening a row shows its detail dialog', await p.eval(`!!${S.dialog}`));
  await p.shot('02-detail');

  // 3. Assert behind the page: a fetch from inside the tab carries the user's cookies/session,
  //    so it reads what the server stored rather than what the screen shows.
  const stored = await p.eval(`fetch('/api/items?q=throwaway', { credentials: 'include' }).then(r => r.json())`);
  log('the server returns the item the page shows', stored.items?.length === 1, JSON.stringify(stored).slice(0, 200));

  // 4. A write: make it on a throwaway record and undo it in finally, also after a failure.
  let createdId;
  try {
    await p.eval(S.click('New item'));
    await p.waitFor(`!!${S.dialog}`, 15000, 'dialog');
    await p.eval(S.focusInput('Name'));
    await p.insertText('zz-local-chrome-test');
    await p.eval(S.click('Save'));
    await p.waitFor(`(${S.toastText}).includes('saved')`, 30000, 'save toast');
    await p.shot('03-saved');
    const found = await p.eval(`fetch('/api/items?q=zz-local-chrome-test', { credentials: 'include' }).then(r => r.json())`);
    createdId = found.items?.[0]?.id;
    log('the new item is stored', !!createdId);
  } finally {
    if (createdId) {
      const status = await p.eval(`fetch('/api/items/${createdId}', { method: 'DELETE', credentials: 'include' }).then(r => r.status)`);
      log('test item removed', status < 300, `HTTP ${status}`);
    }
  }
}
