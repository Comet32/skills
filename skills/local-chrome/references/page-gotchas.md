# Page gotchas

What made a correct page look broken, or a broken check look green, when driving pages with `ego.mjs` or `cdp.mjs`. Each item names the snippet in `scripts/snippets.mjs` or the `page` method that handles it.

## Tabs and timing

- **Background tabs freeze layout.** A hidden tab pauses `requestAnimationFrame`; editors (Monaco), charts and virtualised lists measure themselves in one and render collapsed. `open()` brings its tab to the front: keep it there, and open a second tab only after you are done with the first.
- **A single-page app is "complete" before it has content.** `ready()` only waits for `document.readyState`; follow it with `waitFor()` on something the page renders (a heading, a row), never a fixed `sleep()`.
- **Login redirects.** A page that bounces through SSO lands on another host first. Wait on the final page's content, and treat a URL that stays on a login host as "the user is not logged in": ask them to sign in in that Chrome, then rerun.
- **In-flight states are too quick to see.** Loading… / Saving… last a few hundred ms. `slowCalls(1500, '/api/')` delays matching fetches so you can read and screenshot them; `fastCalls` restores. Read the state ~400 ms after the click.
- **A screenshot taken at the toast's moment shows half-finished refreshes.** Assert final state after the toast clears, through a fetch from the page or a later read.

## Finding and clicking

- **Selectors from a guess fail silently.** Start with `summary` and `controls` on an unfamiliar page and choose selectors from their output.
- **`element.click()` is not a user click.** Widgets that listen for `pointerdown`/`mousedown` (menus, comboboxes, drag handles, canvas) ignore it. Use `page.clickSelector(css)` or `page.clickAt(x, y)`, which send real mouse events. Custom listbox options: `pickOption(text)` after `waitFor(hasOption(text))`.
- **Typing**: focus first (`focusInput(hint)` or a real click on the field), then `page.insertText()`. Setting `.value` from JS skips the input events that React/Vue bind to.
- **Text with an icon or dot inside.** "Leaf element containing the text" misses badges that hold an icon. Use `hasExactText(text)`; keep `hasText(text)` for sentences inside longer copy.
- **Dialogs, popovers and selects render in a portal** outside the page tree and can be missing from a screenshot taken right after they open. Read them through `dialog` / the DOM; for a custom select read `[role="option"]`, not a hidden native `<option>`.
- **Tabs whose labels are uppercased by CSS**: match their text case-insensitively (`clickTab`).

## Reading results

- **A 200 can carry a refusal.** Many APIs answer `200` with `{ status: 'error', message }`. Assert the message the user sees, and read back that nothing was stored.
- **Read stored state from inside the tab.** `page.eval("fetch('/api/…', { credentials: 'include' }).then(r => r.json())")` runs with the user's session; a fetch from Node has none of their cookies.
- **Cross-origin iframes** are not reachable from `page.eval()` on the parent; open the iframe's URL in its own tab instead.

## Test data

- **A stopped run leaves its record behind**, and the next run's "does not exist yet" precondition then fails. Clean up in `finally`, and before rerunning remove what the stopped run wrote.
- **History accumulates across runs.** Pick rows by what *this* run wrote (by content, or newest first), not by position.
