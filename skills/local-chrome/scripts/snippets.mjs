// Page-side JS expressions for cdp.mjs steps. Each export is a string (or returns one) to pass to
// page.eval(...) or page.waitFor(...). page.ready() installs HELPERS, which the others rely on.

const q = JSON.stringify;

/** Installed by page.ready(): __vis(el), __byText(text, selector='button'), __click(text, selector). */
export const HELPERS = `
window.__vis = el => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
window.__byText = (text, sel = 'button') => [...document.querySelectorAll(sel)].filter(__vis).find(e => e.textContent.trim() === text);
window.__click = (text, sel) => { const e = __byText(text, sel); if (!e) throw new Error('no element: ' + text); e.click(); return true; };
true`;

// ---- Reading the page ----------------------------------------------------------------------------
/** { url, title, headings[], visibleText (first 2000 chars) } — a cheap first look at an unknown page. */
export const summary = `({ url: location.href, title: document.title, headings: [...document.querySelectorAll('h1,h2,h3')].filter(__vis).map(h => h.innerText.trim()).filter(Boolean).slice(0, 20), visibleText: document.body.innerText.slice(0, 2000) })`;
/** Visible buttons, links and form fields with their labels — what there is to click or type into. */
export const controls = `[...document.querySelectorAll('button,a[href],input,textarea,select,[role="button"],[role="tab"],[role="link"]')].filter(__vis).slice(0, 200).map(e => ({ tag: e.tagName.toLowerCase(), role: e.getAttribute('role') || undefined, text: (e.innerText || e.value || '').trim().slice(0, 80) || undefined, name: e.name || undefined, placeholder: e.placeholder || undefined, label: e.getAttribute('aria-label') || undefined, href: e.getAttribute('href') || undefined }))`;

// ---- Finding things ------------------------------------------------------------------------------
/** Click the visible element whose whole trimmed text is `text` (a button by default). */
export const click = (text, sel = 'button') => `__click(${q(text)}, ${q(sel)})`;
/** A visible element whose whole trimmed text is `text` exists. Matches badges that hold a dot or icon too. */
export const hasExactText = (text, sel = 'button,a,span,div,p,li,h1,h2,h3,h4,label,td,th') =>
  `[...document.querySelectorAll(${q(sel)})].filter(__vis).some(e => e.textContent.trim() === ${q(text)})`;
/** Some visible leaf element contains `text` (for sentences inside longer copy). */
export const hasText = text =>
  `[...document.querySelectorAll('p,span,div,li,td,label,a,button,h1,h2,h3,h4')].filter(__vis).some(e => e.childElementCount === 0 && e.textContent.includes(${q(text)}))`;
/** A heading (h1–h4) reads exactly `text`. */
export const heading = text => `[...document.querySelectorAll('h1,h2,h3,h4')].some(h => h.textContent.trim() === ${q(text)})`;
/** The open dialog (portals render outside the page tree; read them from the DOM, not a screenshot). */
export const dialog = `[...document.querySelectorAll('[role="dialog"],dialog[open]')].find(__vis)`;
/** Click a tab by its label (case-insensitive: tab labels are often uppercased by CSS). */
export const clickTab = label =>
  `[...document.querySelectorAll('[role="tab"]')].find(t => t.textContent.trim().toLowerCase() === ${q(label.toLowerCase())}).click()`;
/** Focus an input found by its placeholder, aria-label, name or <label> text, so page.insertText() types into it. */
export const focusInput = hint =>
  `(() => { const h = ${q(hint)}; const byLabel = [...document.querySelectorAll('label')].find(l => l.textContent.trim() === h); const i = (byLabel && (byLabel.control || byLabel.querySelector('input,textarea'))) || [...document.querySelectorAll('input,textarea,[contenteditable="true"]')].filter(__vis).find(x => x.placeholder === h || x.getAttribute('aria-label') === h || x.name === h); if (!i) throw new Error('no input: ' + h); i.focus(); i.select && i.select(); return true; })()`;
/** Set a <select>'s value by option text and fire change (for native selects only). */
export const selectOption = (selector, optionText) =>
  `(() => { const s = document.querySelector(${q(selector)}); const o = [...s.options].find(o => o.text.trim() === ${q(optionText)}); s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`;
/** Pick a custom listbox option ([role="option"]) by text. Many comboboxes commit on mousedown, so fire both. */
export const pickOption = text =>
  `(() => { const o = [...document.querySelectorAll('[role="option"]')].find(o => o.textContent.includes(${q(text)})); if (!o) throw new Error('no option: ' + ${q(text)}); o.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); o.click(); return true; })()`;
export const hasOption = text => `[...document.querySelectorAll('[role="option"]')].some(o => o.textContent.includes(${q(text)}))`;
/** All visible toasts' text joined with ' | ' (sonner, react-hot-toast, generic role=status/alert). */
export const toastText = `[...document.querySelectorAll('[data-sonner-toast],[role="status"],[role="alert"]')].filter(__vis).map(t => t.innerText.replace(/\\s+/g, ' ').trim()).filter(Boolean).join(' | ')`;

// ---- Monaco (VS Code-style editors) --------------------------------------------------------------
const liveEditor = `window.monaco.editor.getEditors().find(e => e.getContainerDomNode().getClientRects().length && !e.getOption(window.monaco.editor.EditorOption.readOnly))`;
/** A visible Monaco editor has mounted. */
export const monacoUp = `!!window.monaco && window.monaco.editor.getEditors().some(e => e.getContainerDomNode().getClientRects().length)`;
export const monacoValue = `${liveEditor}.getValue()`;
/** Replace the editable editor's whole text (fires the change the page binds to). */
export const setMonaco = text => `(() => { ${liveEditor}.setValue(${q(text)}); return true; })()`;
/** Put the cursor at the end and focus, so page.insertText() appends like a user typing. */
export const focusMonacoEnd = `(() => { const e = ${liveEditor}; const m = e.getModel(); const l = m.getLineCount(); e.setPosition({ lineNumber: l, column: m.getLineMaxColumn(l) }); e.focus(); return true; })()`;

// ---- Network shaping -----------------------------------------------------------------------------
/** Delay every fetch whose URL contains `match` by `ms`, so in-flight states (Loading…, Saving…) stay on screen long enough to read. */
export const slowCalls = (ms, match = '') => `(() => { if (!window.__origFetch) window.__origFetch = window.fetch; const f = window.__origFetch; window.fetch = (u, o) => String(u && u.url || u).includes(${q(match)}) ? new Promise(r => setTimeout(r, ${ms})).then(() => f(u, o)) : f(u, o); return true; })()`;
export const fastCalls = `(() => { if (window.__origFetch) window.fetch = window.__origFetch; return true; })()`;
