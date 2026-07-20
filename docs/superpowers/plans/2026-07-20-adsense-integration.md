# AdSense Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google AdSense Auto Ads to the `ui/` PWA, detect ad blockers with a dismissible warning banner, and show a one-time "thanks" toast when a user disables their ad blocker after seeing the warning.

**Architecture:** A new dependency-free ES module, `ui/adblock.js`, exposes two pure decision functions (`isBaitBlocked`, `computeAdblockUiState`) that are unit-tested directly, plus an impure `detectAdBlock`/`initAdblockUi` layer that wires those decisions to a bait-div detector and to banner/toast DOM elements added to `ui/index.html`. AdSense itself is a single Auto Ads script tag — no manual ad slots.

**Tech Stack:** Vanilla JS (ES modules), Jest 29 (ESM mode, `node --experimental-vm-modules`, no jsdom), existing CSS custom properties in `ui/styles.css`.

## Global Constraints

- AdSense client id: `ca-pub-5525349541277692` (exact value, provided by the user).
- Auto Ads only — no manual `<ins class="adsbygoogle">` ad slots, no ad slot IDs.
- No ad-click detection or click-based messaging in any form (AdSense policy risk + not technically observable across the ad iframe boundary — see spec).
- No privacy policy page or consent/CMP work in this change (explicitly out of scope).
- Use `sessionStorage`, not `localStorage`, for the dismissed/thanks-shown flags, so the warning reappears on a fresh visit.
- No new npm dependencies (no jsdom). The two decision functions must be pure enough to unit test with plain JS object fixtures, not real DOM nodes.
- New UI elements must reuse existing CSS custom properties (`--warning`, `--success`, `--radius-md`, `--radius-sm`, `--ease-smooth`, etc.) already defined in `ui/styles.css:3-41`, matching the glass-panel/neomorphism visual language.
- The existing download workflow (`ui/app.js`, `ui/sw.js`, the SSE stream, the server) must not regress.
- Spec reference: [docs/superpowers/specs/2026-07-20-adsense-integration-design.md](/Users/osmancagrigenc/Projects/scribd-dl/docs/superpowers/specs/2026-07-20-adsense-integration-design.md)

---

### Task 1: AdSense Auto Ads script tag

**Files:**
- Create: `test/AdsenseMarkup.test.js`
- Modify: `ui/index.html:11-12`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: nothing consumed by later tasks (Task 3 will extend the same test file with more assertions, but does not call any function from this task).

- [ ] **Step 1: Write the failing test**

Create `test/AdsenseMarkup.test.js`:

```js
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const html = fs.readFileSync(path.join(__dirname, "..", "ui", "index.html"), "utf8")

describe("AdSense markup", () => {
    test("includes the Auto Ads script tag with the publisher client id", () => {
        expect(html).toContain(
            "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5525349541277692"
        )
    })

    test("includes the adsense verification meta tag", () => {
        expect(html).toContain('<meta name="google-adsense-account" content="ca-pub-5525349541277692">')
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- AdsenseMarkup`
Expected: FAIL — both assertions fail because `ui/index.html` does not yet contain this markup.

- [ ] **Step 3: Add the script and meta tags to `ui/index.html`**

In `ui/index.html`, find this existing block (lines 9-11):

```html
    <link rel="manifest" href="/manifest.json" />
    <link rel="icon" type="image/png" href="/assets/favicon.png" />
    <link rel="apple-touch-icon" href="/assets/icon-192.png" />
```

Replace it with:

```html
    <link rel="manifest" href="/manifest.json" />
    <link rel="icon" type="image/png" href="/assets/favicon.png" />
    <link rel="apple-touch-icon" href="/assets/icon-192.png" />
    <meta name="google-adsense-account" content="ca-pub-5525349541277692">
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5525349541277692"
      crossorigin="anonymous" id="adsbygoogle-script"></script>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- AdsenseMarkup`
Expected: PASS (2 tests passed)

- [ ] **Step 5: Commit**

```bash
git add ui/index.html test/AdsenseMarkup.test.js
git commit -m "feat: add Google AdSense Auto Ads script tag"
```

---

### Task 2: Adblock pure decision functions

**Files:**
- Create: `ui/adblock.js`
- Create: `test/Adblock.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces (for Task 3 to consume, same file extended in place):
  - `isBaitBlocked(bait: { offsetHeight: number, offsetParent: object|null, getComputedDisplay?: () => string }): boolean`
  - `computeAdblockUiState({ wasBlocked: boolean, isBlocked: boolean, dismissed: boolean, thanksShown: boolean }): { showBanner: boolean, showThanks: boolean }`
  - `STORAGE_KEYS: { dismissed: string, thanksShown: string }` (internal constant, not exported — Task 3 defines it in the same module scope).

- [ ] **Step 1: Write the failing tests**

Create `test/Adblock.test.js`:

```js
import { isBaitBlocked, computeAdblockUiState } from "../ui/adblock.js"

describe("isBaitBlocked", () => {
    test("returns false for a visible bait element", () => {
        const bait = { offsetHeight: 2, offsetParent: {}, getComputedDisplay: () => "block" }
        expect(isBaitBlocked(bait)).toBe(false)
    })

    test("returns true when offsetHeight is collapsed to zero", () => {
        const bait = { offsetHeight: 0, offsetParent: {}, getComputedDisplay: () => "block" }
        expect(isBaitBlocked(bait)).toBe(true)
    })

    test("returns true when offsetParent is removed from layout", () => {
        const bait = { offsetHeight: 2, offsetParent: null, getComputedDisplay: () => "block" }
        expect(isBaitBlocked(bait)).toBe(true)
    })

    test("returns true when computed display is none", () => {
        const bait = { offsetHeight: 2, offsetParent: {}, getComputedDisplay: () => "none" }
        expect(isBaitBlocked(bait)).toBe(true)
    })

    test("returns false for a nullish bait", () => {
        expect(isBaitBlocked(null)).toBe(false)
    })
})

describe("computeAdblockUiState", () => {
    test("shows the banner when blocked and not dismissed", () => {
        const state = computeAdblockUiState({ wasBlocked: false, isBlocked: true, dismissed: false, thanksShown: false })
        expect(state).toEqual({ showBanner: true, showThanks: false })
    })

    test("hides the banner once dismissed even while still blocked", () => {
        const state = computeAdblockUiState({ wasBlocked: true, isBlocked: true, dismissed: true, thanksShown: false })
        expect(state).toEqual({ showBanner: false, showThanks: false })
    })

    test("shows the thanks toast on a blocked-to-unblocked transition", () => {
        const state = computeAdblockUiState({ wasBlocked: true, isBlocked: false, dismissed: true, thanksShown: false })
        expect(state).toEqual({ showBanner: false, showThanks: true })
    })

    test("does not repeat the thanks toast once already shown", () => {
        const state = computeAdblockUiState({ wasBlocked: true, isBlocked: false, dismissed: true, thanksShown: true })
        expect(state).toEqual({ showBanner: false, showThanks: false })
    })

    test("stays quiet when never blocked", () => {
        const state = computeAdblockUiState({ wasBlocked: false, isBlocked: false, dismissed: false, thanksShown: false })
        expect(state).toEqual({ showBanner: false, showThanks: false })
    })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- Adblock.test.js`
Expected: FAIL — `ui/adblock.js` does not exist yet, so the import throws a module-not-found error.

- [ ] **Step 3: Write the minimal implementation**

Create `ui/adblock.js`:

```js
export const STORAGE_KEYS = {
    dismissed: "adblock:dismissed",
    thanksShown: "adblock:thanksShown"
}

export function isBaitBlocked(bait) {
    if (!bait) return false

    const hiddenByOffset = bait.offsetHeight === 0 || bait.offsetParent === null
    const hiddenByDisplay = typeof bait.getComputedDisplay === "function"
        ? bait.getComputedDisplay() === "none"
        : false

    return hiddenByOffset || hiddenByDisplay
}

export function computeAdblockUiState({ wasBlocked, isBlocked, dismissed, thanksShown }) {
    return {
        showBanner: Boolean(isBlocked) && !dismissed,
        showThanks: Boolean(wasBlocked) && !isBlocked && !thanksShown
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- Adblock.test.js`
Expected: PASS (10 tests passed)

- [ ] **Step 5: Commit**

```bash
git add ui/adblock.js test/Adblock.test.js
git commit -m "feat: add pure adblock decision functions"
```

---

### Task 3: Bait-div detector, DOM wiring, banner/toast markup, and styling

**Files:**
- Modify: `ui/adblock.js` (append to the file created in Task 2)
- Modify: `ui/index.html:14`, `ui/index.html:113-114`, `ui/index.html:116`
- Modify: `ui/styles.css` (append)
- Modify: `test/AdsenseMarkup.test.js` (extend the file from Task 1)

**Interfaces:**
- Consumes: `isBaitBlocked`, `computeAdblockUiState`, `STORAGE_KEYS` from `ui/adblock.js` (Task 2), same module so plain local references.
- Produces: `detectAdBlock({ doc, waitMs }): Promise<boolean>` and side-effecting `initAdblockUi()` — neither is consumed by a later task; Task 4 exercises them manually through the browser, not by importing them.

- [ ] **Step 1: Write the failing markup tests**

In `test/AdsenseMarkup.test.js`, add these two tests inside the existing `describe("AdSense markup", ...)` block, after the two tests from Task 1:

```js
    test("includes the adblock banner and thanks toast containers", () => {
        expect(html).toContain('id="adblock-banner"')
        expect(html).toContain('id="adblock-banner-close"')
        expect(html).toContain('id="adblock-thanks"')
    })

    test("loads the adblock module script", () => {
        expect(html).toContain('<script type="module" src="/adblock.js"></script>')
    })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- AdsenseMarkup`
Expected: FAIL on the 2 new tests (banner/toast markup and module script tag do not exist yet); the 2 tests from Task 1 still pass.

- [ ] **Step 3: Add the banner and toast markup to `ui/index.html`**

Find this line (line 14):

```html
    <main class="app">
      <header class="hero">
```

Replace it with:

```html
    <main class="app">
      <div id="adblock-banner" class="adblock-banner" hidden>
        <span class="adblock-banner-text">Reklam engelleyici tespit edildi. Bu servisi ücretsiz tutabilmemiz reklam gelirine bağlı — devre dışı bırakmayı düşünür müsünüz?</span>
        <button id="adblock-banner-close" class="adblock-banner-close" type="button" aria-label="Kapat">×</button>
      </div>
      <header class="hero">
```

Find this block (lines 113-114):

```html
      </section>
    </main>
```

Replace it with:

```html
      </section>

      <div id="adblock-thanks" class="adblock-thanks" hidden role="status">
        Reklam engelleyiciyi kapattığınız için teşekkürler! 🙏
      </div>
    </main>
```

Find this line (line 116):

```html
    <script src="/app.js"></script>
```

Replace it with:

```html
    <script src="/app.js"></script>
    <script type="module" src="/adblock.js"></script>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- AdsenseMarkup`
Expected: PASS (4 tests passed)

- [ ] **Step 5: Add the detector and DOM wiring to `ui/adblock.js`**

Append to the end of `ui/adblock.js` (after the `computeAdblockUiState` function from Task 2):

```js
export async function detectAdBlock({ doc = document, waitMs = 150 } = {}) {
    const bait = doc.createElement("div")
    bait.className = "adsbox ad-banner adsbygoogle ad-placement"
    bait.style.cssText = "position:absolute;top:-9999px;left:-9999px;width:1px;height:1px;"
    bait.innerHTML = "&nbsp;"
    doc.body.appendChild(bait)

    await new Promise((resolve) => setTimeout(resolve, waitMs))

    const blocked = isBaitBlocked({
        offsetHeight: bait.offsetHeight,
        offsetParent: bait.offsetParent,
        getComputedDisplay: () => getComputedStyle(bait).display
    })

    doc.body.removeChild(bait)
    return blocked
}

function readFlag(storage, key) {
    try {
        return storage.getItem(key) === "1"
    } catch {
        return false
    }
}

function writeFlag(storage, key) {
    try {
        storage.setItem(key, "1")
    } catch {
        // sessionStorage unavailable (e.g. private mode) - state just won't persist across reloads
    }
}

function initAdblockUi(doc = document, win = window) {
    const banner = doc.getElementById("adblock-banner")
    const closeButton = doc.getElementById("adblock-banner-close")
    const thanks = doc.getElementById("adblock-thanks")

    let storage = null
    try {
        storage = win.sessionStorage
    } catch {
        storage = null
    }
    const memoryFlags = {}

    const getFlag = (key) => (storage ? readFlag(storage, key) : Boolean(memoryFlags[key]))
    const setFlag = (key) => {
        if (storage) writeFlag(storage, key)
        else memoryFlags[key] = true
    }

    let wasBlocked = false
    let thanksTimer = null

    async function refresh() {
        const scriptFailed = win.__adsbygoogleScriptFailed === true
        const isBlocked = scriptFailed || (await detectAdBlock({ doc }))

        const dismissed = getFlag(STORAGE_KEYS.dismissed)
        const thanksShown = getFlag(STORAGE_KEYS.thanksShown)
        const state = computeAdblockUiState({ wasBlocked, isBlocked, dismissed, thanksShown })

        if (banner) banner.hidden = !state.showBanner

        if (state.showThanks && thanks) {
            thanks.hidden = false
            setFlag(STORAGE_KEYS.thanksShown)
            if (thanksTimer) clearTimeout(thanksTimer)
            thanksTimer = setTimeout(() => { thanks.hidden = true }, 4000)
        }

        wasBlocked = isBlocked
    }

    if (closeButton && banner) {
        closeButton.addEventListener("click", () => {
            banner.hidden = true
            setFlag(STORAGE_KEYS.dismissed)
        })
    }

    win.addEventListener("load", () => { refresh() })
    doc.addEventListener("visibilitychange", () => {
        if (doc.visibilityState === "visible") refresh()
    })
    win.addEventListener("focus", () => { refresh() })
}

if (typeof document !== "undefined") {
    const adsScript = document.getElementById("adsbygoogle-script")
    if (adsScript) {
        adsScript.addEventListener("error", () => {
            window.__adsbygoogleScriptFailed = true
        })
    }
    initAdblockUi()
}
```

- [ ] **Step 6: Run the full test suite to confirm nothing broke**

Run: `npm test`
Expected: PASS — all suites green, including `Adblock.test.js` and `AdsenseMarkup.test.js`. `detectAdBlock`/`initAdblockUi` are not imported by any test, and the `if (typeof document !== "undefined")` guard means the bootstrap block does not execute under Jest's Node environment, so no `document is not defined` error occurs.

- [ ] **Step 7: Add banner and toast styles to `ui/styles.css`**

Append to the end of `ui/styles.css` (after the existing `@media (prefers-reduced-motion: reduce)` block):

```css

/* Adblock Banner */
.adblock-banner {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 20px;
  border-radius: var(--radius-md);
  background: rgba(253, 203, 110, 0.18);
  border: 1px solid var(--warning);
  color: var(--ink);
  font-size: 0.9rem;
  font-weight: 500;
}

.adblock-banner[hidden] {
  display: none;
}

.adblock-banner-close {
  border: none;
  background: transparent;
  color: var(--ink);
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  transition: background 0.2s var(--ease-smooth);
}

.adblock-banner-close:hover {
  background: rgba(0, 0, 0, 0.08);
}

/* Adblock Thanks Toast */
.adblock-thanks {
  position: fixed;
  bottom: 24px;
  right: 24px;
  padding: 14px 20px;
  border-radius: var(--radius-md);
  background: var(--success);
  color: #ffffff;
  font-weight: 600;
  font-size: 0.9rem;
  box-shadow: 0 8px 24px rgba(0, 184, 148, 0.35);
  z-index: 10;
  animation: slideIn 0.3s var(--ease-smooth) forwards;
}

.adblock-thanks[hidden] {
  display: none;
}
```

- [ ] **Step 8: Commit**

```bash
git add ui/adblock.js ui/index.html ui/styles.css test/AdsenseMarkup.test.js
git commit -m "feat: add adblock detection, warning banner, and thanks toast"
```

---

### Task 4: Manual browser verification

**Files:** none (verification only; fix-forward if issues are found)

**Interfaces:**
- Consumes: the running app from Tasks 1-3 (`ui/index.html`, `ui/adblock.js`, `ui/styles.css`) via the dev server.
- Produces: nothing for later tasks — this is the final gate.

- [ ] **Step 1: Start the dev server**

Run: `npm run start:ui`
Expected: server logs a listening port (see `src/server/createUiServer.js` for the exact log line and default port).

- [ ] **Step 2: Load the app in a browser and check for console/network errors**

Open `http://localhost:<port>/` (the port from Step 1). Confirm:
- No JavaScript console errors.
- A network request to `pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5525349541277692` is made (status 200, or a fetch/blocked entry if a real ad blocker is active in that browser — both are acceptable, this just confirms the tag is wired correctly).
- With no ad blocker active, `#adblock-banner` and `#adblock-thanks` remain hidden.

- [ ] **Step 3: Simulate the "blocked" state and verify the banner**

In the browser devtools console, run:

```js
document.getElementById('adblock-banner').hidden = false
```

Expected: the banner renders styled consistently with the rest of the UI (glass/neomorphism look, not a jarring default browser alert), and clicking the × button hides it and sets `sessionStorage.getItem('adblock:dismissed') === '1'`.

- [ ] **Step 4: Simulate the "thanks" toast**

In the browser devtools console, run:

```js
document.getElementById('adblock-thanks').hidden = false
```

Expected: the toast renders bottom-right, styled with the success color, and is legible against the background.

- [ ] **Step 5: Confirm the existing download flow still works**

Enter a `scribd.com` URL in the form and submit. Expected: status/log/progress UI behaves exactly as before this change (queued → running → completed/failed), confirming `ui/app.js` was not affected.

- [ ] **Step 6: Run the full automated test suite one more time**

Run: `npm test`
Expected: PASS, all suites green.

- [ ] **Step 7: Record verification result**

No commit needed for this task since it changes no files. If any step above surfaces a bug, fix it in the relevant task's files, re-run that task's tests, and commit the fix with `fix: <description>` before considering the plan complete.

---

## Self-Review Notes

- **Spec coverage:** Auto Ads script (Task 1), bait-div + script-error detection (Task 3), pure decision logic with unit tests (Task 2), dismissible banner + one-time thanks toast (Task 3), sessionStorage-based session state (Task 3), manual browser verification in lieu of jsdom (Task 4), no click-tracking/no CMP (enforced by Global Constraints, nothing in any task implements them) — all spec sections are covered.
- **Placeholder scan:** no TBD/TODO; every step has complete, runnable code.
- **Type/name consistency:** `isBaitBlocked`, `computeAdblockUiState`, `STORAGE_KEYS`, `detectAdBlock`, `initAdblockUi` are named identically everywhere they appear across Tasks 2-3; `adblock:dismissed` / `adblock:thanksShown` string keys match between `STORAGE_KEYS` and the design doc.
