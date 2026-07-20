# Privacy Policy & Ad Consent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a privacy policy page and a custom cookie/ad-consent banner wired to Google Consent Mode v2, so the AdSense integration can serve EEA/UK/Swiss visitors the way Google's policies expect.

**Architecture:** A pure, unit-tested `isConsentValid` function in `ui/consent.js` decides whether a stored consent choice is still valid; a tiny blocking (non-module) bootstrap script in `<head>` uses the same logic (necessarily duplicated — see Global Constraints) to send `gtag('consent', 'default', ...)` before the AdSense script tag runs; `ui/consent.js`'s DOM-wiring layer shows/hides the banner and sends `gtag('consent', 'update', ...)` on user choice. A new static `ui/privacy.html` page is linked from a new footer.

**Tech Stack:** Vanilla JS (ES modules + one classic blocking script), Jest 29 (ESM mode, no jsdom), existing CSS custom properties in `ui/styles.css`.

## Global Constraints

- Consent signals: exactly `ad_storage`, `ad_user_data`, `ad_personalization`. Do not add `analytics_storage` (no Google Analytics on this site).
- Consent lifetime: 365 days (`CONSENT_TTL_MS = 365 * 24 * 60 * 60 * 1000`), then the banner reappears.
- Storage: `localStorage` (not `sessionStorage`) under key `consent:adsense` — consent must survive across sessions.
- No IP-based geolocation, no third-party CMP vendor (Funding Choices), no `analytics_storage` — all explicitly out of scope.
- The consent-default bootstrap script MUST be a classic (non-async, non-module, non-defer) `<script>` placed in `<head>` immediately before the existing AdSense `<meta>`/`<script>` pair (currently `ui/index.html:12-14`), so it runs synchronously before the AdSense tag. It cannot be replaced by importing `ui/consent.js` as a module — module scripts are deferred and cannot guarantee running before an `async` script.
- Because of the above, the ~5-line "is there a valid stored consent choice" check is intentionally duplicated between the bootstrap script and `ui/consent.js`'s `isConsentValid`. Keep the bootstrap script's `TTL_MS` literal (`365 * 24 * 60 * 60 * 1000`) equal to `ui/consent.js`'s exported `CONSENT_TTL_MS` — this is a deliberate, commented exception to DRY, not an oversight.
- Privacy policy contact/business details: contact `osmcgrgenc@gmail.com`, business name "Codifya", jurisdiction Türkiye. This is a disclosure template, not legal advice (already communicated to the user).
- Reuse existing CSS custom properties (`--surface`, `--shadow-dark`, `--shadow-light`, `--radius-md`, `--ink`, `--ink-muted`, `--accent`) rather than introducing new ad-hoc colors.
- Existing features (`ui/app.js` download workflow, `ui/adblock.js` adblock detection) must not regress.
- Spec reference: [docs/superpowers/specs/2026-07-20-privacy-consent-design.md](/Users/osmancagrigenc/Projects/scribd-dl/docs/superpowers/specs/2026-07-20-privacy-consent-design.md)

---

### Task 1: Consent pure decision function

**Files:**
- Create: `ui/consent.js`
- Create: `test/Consent.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces (for Task 3 to consume, same file extended in place):
  - `CONSENT_STORAGE_KEY: "consent:adsense"`
  - `CONSENT_TTL_MS: number` (365 days in ms)
  - `isConsentValid({ storedStatus, storedTimestamp, now, ttlMs }): { valid: boolean, granted: boolean }`

- [ ] **Step 1: Write the failing tests**

Create `test/Consent.test.js`:

```js
import { isConsentValid, CONSENT_STORAGE_KEY, CONSENT_TTL_MS } from "../ui/consent.js"

describe("isConsentValid", () => {
    const ONE_DAY_MS = 24 * 60 * 60 * 1000

    test("returns invalid when there is no stored status", () => {
        const result = isConsentValid({ storedStatus: undefined, storedTimestamp: undefined, now: 1000, ttlMs: CONSENT_TTL_MS })
        expect(result).toEqual({ valid: false, granted: false })
    })

    test("returns valid+granted for a fresh granted choice", () => {
        const now = 10_000_000
        const result = isConsentValid({ storedStatus: "granted", storedTimestamp: now - ONE_DAY_MS, now, ttlMs: CONSENT_TTL_MS })
        expect(result).toEqual({ valid: true, granted: true })
    })

    test("returns valid+not-granted for a fresh denied choice", () => {
        const now = 10_000_000
        const result = isConsentValid({ storedStatus: "denied", storedTimestamp: now - ONE_DAY_MS, now, ttlMs: CONSENT_TTL_MS })
        expect(result).toEqual({ valid: true, granted: false })
    })

    test("returns invalid once a granted choice is older than the TTL", () => {
        const now = CONSENT_TTL_MS + ONE_DAY_MS * 2
        const result = isConsentValid({ storedStatus: "granted", storedTimestamp: now - CONSENT_TTL_MS - ONE_DAY_MS, now, ttlMs: CONSENT_TTL_MS })
        expect(result).toEqual({ valid: false, granted: false })
    })

    test("returns invalid once a denied choice is older than the TTL", () => {
        const now = CONSENT_TTL_MS + ONE_DAY_MS * 2
        const result = isConsentValid({ storedStatus: "denied", storedTimestamp: now - CONSENT_TTL_MS - ONE_DAY_MS, now, ttlMs: CONSENT_TTL_MS })
        expect(result).toEqual({ valid: false, granted: false })
    })

    test("returns invalid when the timestamp is missing", () => {
        const result = isConsentValid({ storedStatus: "granted", storedTimestamp: undefined, now: 10_000, ttlMs: CONSENT_TTL_MS })
        expect(result).toEqual({ valid: false, granted: false })
    })

    test("returns invalid when the timestamp is not a number", () => {
        const result = isConsentValid({ storedStatus: "granted", storedTimestamp: "not-a-number", now: 10_000, ttlMs: CONSENT_TTL_MS })
        expect(result).toEqual({ valid: false, granted: false })
    })

    test("returns invalid for an unrecognized status value", () => {
        const result = isConsentValid({ storedStatus: "maybe", storedTimestamp: 9_000, now: 10_000, ttlMs: CONSENT_TTL_MS })
        expect(result).toEqual({ valid: false, granted: false })
    })

    test("exports the expected storage key and TTL", () => {
        expect(CONSENT_STORAGE_KEY).toBe("consent:adsense")
        expect(CONSENT_TTL_MS).toBe(365 * 24 * 60 * 60 * 1000)
    })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- Consent.test.js`
Expected: FAIL — `ui/consent.js` does not exist yet, so the import throws a module-not-found error.

- [ ] **Step 3: Write the minimal implementation**

Create `ui/consent.js`:

```js
export const CONSENT_STORAGE_KEY = "consent:adsense"
export const CONSENT_TTL_MS = 365 * 24 * 60 * 60 * 1000

export function isConsentValid({ storedStatus, storedTimestamp, now, ttlMs }) {
    if (storedStatus !== "granted" && storedStatus !== "denied") return { valid: false, granted: false }
    if (typeof storedTimestamp !== "number" || Number.isNaN(storedTimestamp)) return { valid: false, granted: false }
    if (typeof now !== "number" || now - storedTimestamp > ttlMs) return { valid: false, granted: false }

    return { valid: true, granted: storedStatus === "granted" }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- Consent.test.js`
Expected: PASS (9 tests passed)

- [ ] **Step 5: Commit**

```bash
git add ui/consent.js test/Consent.test.js
git commit -m "feat: add pure consent validity decision function"
```

---

### Task 2: Privacy policy page

**Files:**
- Create: `ui/privacy.html`
- Create: `test/PrivacyMarkup.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: a reachable `/privacy.html` route (served the same way `ui/index.html` already is, as a static file) that Task 3's footer link points to.

- [ ] **Step 1: Write the failing test**

Create `test/PrivacyMarkup.test.js`:

```js
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const privacyHtml = fs.readFileSync(path.join(__dirname, "..", "ui", "privacy.html"), "utf8")

describe("Privacy policy page", () => {
    test("discloses the operator identity and contact", () => {
        expect(privacyHtml).toContain("Codifya")
        expect(privacyHtml).toContain("osmcgrgenc@gmail.com")
    })

    test("links to Google's ad policy and ad settings pages", () => {
        expect(privacyHtml).toContain("https://policies.google.com/technologies/ads")
        expect(privacyHtml).toContain("https://adssettings.google.com/")
    })

    test("describes what the app itself stores", () => {
        expect(privacyHtml).toContain("geçmiş")
    })

    test("links back to the main app", () => {
        expect(privacyHtml).toContain('href="/"')
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- PrivacyMarkup`
Expected: FAIL — `ui/privacy.html` does not exist yet, so `fs.readFileSync` throws `ENOENT`.

- [ ] **Step 3: Create `ui/privacy.html`**

```html
<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#6c5ce7" />
    <title>Gizlilik Politikası — Lifinize</title>
    <link rel="stylesheet" href="/styles.css" />
    <link rel="icon" type="image/png" href="/assets/favicon.png" />
  </head>
  <body>
    <main class="app">
      <header class="hero">
        <h1>Gizlilik Politikası</h1>
        <p>Lifinize.online — Codifya tarafından işletilmektedir. Son güncelleme: 20 Temmuz 2026.</p>
      </header>

      <div class="card glass-panel" style="max-width: 760px; margin: 0 auto; text-align: left; line-height: 1.7;">
        <h2>Kim olduğumuz</h2>
        <p>Bu servis Codifya tarafından işletilmektedir (Türkiye merkezli). Gizlilikle ilgili sorularınız için <a href="mailto:osmcgrgenc@gmail.com">osmcgrgenc@gmail.com</a> adresinden bize ulaşabilirsiniz.</p>

        <h2>Bu uygulama ne topluyor</h2>
        <p>Lifinize, girdiğiniz belge/podcast bağlantısını (URL) işler. Aynı bağlantının tekrar indirilmesini önlemek için, işlenen URL, oluşturulan dosya yolu ve başlık bilgisi sunucu tarafında yerel bir SQLite geçmiş tablosunda saklanır. Kullanıcı hesabı oluşturmuyoruz, kişisel profil verisi toplamıyoruz ve IP adresinizi uygulama kodumuzda ayrıca kaydetmiyoruz.</p>

        <h2>Üçüncü taraf reklamlar (Google AdSense)</h2>
        <p>Bu sitede Google AdSense aracılığıyla reklamlar gösterilir. Google, reklam sunumu ve (izin verirseniz) kişiselleştirilmiş reklamlar için çerezler ve cihaz tanımlayıcıları kullanabilir. Google'ın reklamlarda verileri nasıl kullandığı hakkında daha fazla bilgiyi <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener">policies.google.com/technologies/ads</a> adresinde bulabilirsiniz. Kişiselleştirilmiş reklamlardan çıkmak için <a href="https://adssettings.google.com/" target="_blank" rel="noopener">Google Reklam Ayarları</a>'nı kullanabilirsiniz.</p>

        <h2>Onay (consent) mekanizması</h2>
        <p>Siteyi ilk ziyaretinizde bir onay bandı gösterilir. "Kabul Et" veya "Reddet" seçiminiz 365 gün boyunca tarayıcınızda hatırlanır; bu süre sonunda bant tekrar gösterilir. Tercihinizi istediğiniz zaman sayfa altındaki "Çerez Tercihleri" bağlantısıyla değiştirebilirsiniz.</p>

        <h2>Veri saklama ve silme talepleri</h2>
        <p>Geçmiş tablosundaki kayıtların silinmesini talep etmek için <a href="mailto:osmcgrgenc@gmail.com">osmcgrgenc@gmail.com</a> adresinden bizimle iletişime geçebilirsiniz.</p>

        <h2>Çocukların gizliliği</h2>
        <p>Bu servis çocuklara yönelik değildir ve bilerek 13 yaşın altındaki çocuklardan veri toplamaz.</p>

        <h2>Bu politikadaki değişiklikler</h2>
        <p>Bu gizlilik politikasını zaman zaman güncelleyebiliriz; güncel sürüm her zaman bu sayfada yayınlanır.</p>

        <p style="margin-top: 32px;"><a href="/">← Uygulamaya dön</a></p>
      </div>
    </main>
  </body>
</html>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- PrivacyMarkup`
Expected: PASS (4 tests passed)

- [ ] **Step 5: Commit**

```bash
git add ui/privacy.html test/PrivacyMarkup.test.js
git commit -m "feat: add privacy policy page"
```

---

### Task 3: Consent bootstrap script, banner UI, footer, and service-worker precache

**Files:**
- Modify: `ui/consent.js` (append to the file created in Task 1)
- Modify: `ui/index.html:12` (insert before), `ui/index.html:124-125` (insert between), `ui/index.html:128` (insert after)
- Modify: `ui/styles.css` (append)
- Modify: `ui/sw.js` (bump cache version, add new assets to precache)
- Modify: `test/PrivacyMarkup.test.js` (extend with index.html assertions — see Step 1)

**Interfaces:**
- Consumes: `isConsentValid`, `CONSENT_STORAGE_KEY`, `CONSENT_TTL_MS` from `ui/consent.js` (Task 1), same module so plain local references.
- Produces: `initConsentUi()` (side-effecting, not consumed by a later task; Task 4 exercises it manually through the browser).

- [ ] **Step 1: Write the failing markup tests**

In `test/PrivacyMarkup.test.js`, change the top of the file from:

```js
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const privacyHtml = fs.readFileSync(path.join(__dirname, "..", "ui", "privacy.html"), "utf8")
```

to:

```js
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const privacyHtml = fs.readFileSync(path.join(__dirname, "..", "ui", "privacy.html"), "utf8")
const indexHtml = fs.readFileSync(path.join(__dirname, "..", "ui", "index.html"), "utf8")
```

Then append this new `describe` block at the end of the file:

```js

describe("Consent markup in index.html", () => {
    test("sends the consent default before the AdSense script tag", () => {
        const consentDefaultIndex = indexHtml.indexOf("gtag('consent', 'default'")
        const adsenseScriptIndex = indexHtml.indexOf("adsbygoogle.js?client=ca-pub-5525349541277692")

        expect(consentDefaultIndex).toBeGreaterThan(-1)
        expect(adsenseScriptIndex).toBeGreaterThan(-1)
        expect(consentDefaultIndex).toBeLessThan(adsenseScriptIndex)
    })

    test("includes the consent banner and its buttons", () => {
        expect(indexHtml).toContain('id="consent-banner"')
        expect(indexHtml).toContain('id="consent-accept"')
        expect(indexHtml).toContain('id="consent-reject"')
    })

    test("includes a footer linking to the privacy policy and cookie preferences", () => {
        expect(indexHtml).toContain('href="/privacy.html"')
        expect(indexHtml).toContain('id="consent-preferences"')
    })

    test("loads the consent module script", () => {
        expect(indexHtml).toContain('<script type="module" src="/consent.js"></script>')
    })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- PrivacyMarkup`
Expected: FAIL on the 4 new tests (none of the consent markup exists in `ui/index.html` yet); the 4 tests from Task 2 still pass.

- [ ] **Step 3: Add the bootstrap script to `ui/index.html`'s `<head>`**

Find this line:

```html
    <link rel="apple-touch-icon" href="/assets/icon-192.png" />
    <meta name="google-adsense-account" content="ca-pub-5525349541277692">
```

Replace it with:

```html
    <link rel="apple-touch-icon" href="/assets/icon-192.png" />
    <script>
      window.dataLayer = window.dataLayer || []
      function gtag() { dataLayer.push(arguments) }
      (function () {
        // Keep this TTL in sync with CONSENT_TTL_MS in ui/consent.js.
        var TTL_MS = 365 * 24 * 60 * 60 * 1000
        var granted = false
        try {
          var raw = localStorage.getItem('consent:adsense')
          if (raw) {
            var stored = JSON.parse(raw)
            var isValid = stored && typeof stored.timestamp === 'number' && (Date.now() - stored.timestamp) <= TTL_MS
            granted = isValid && stored.status === 'granted'
          }
        } catch (e) {
          granted = false
        }
        gtag('consent', 'default', {
          ad_storage: granted ? 'granted' : 'denied',
          ad_user_data: granted ? 'granted' : 'denied',
          ad_personalization: granted ? 'granted' : 'denied'
        })
      })()
    </script>
    <meta name="google-adsense-account" content="ca-pub-5525349541277692">
```

- [ ] **Step 4: Add the consent banner and footer markup to `ui/index.html`**

Find this block (the `#adblock-thanks` div immediately followed by the closing `</main>` tag):

```html
      <div id="adblock-thanks" class="adblock-thanks" hidden role="status">
        Reklam engelleyiciyi kapattığınız için teşekkürler! 🙏
      </div>
    </main>
```

Replace it with:

```html
      <div id="adblock-thanks" class="adblock-thanks" hidden role="status">
        Reklam engelleyiciyi kapattığınız için teşekkürler! 🙏
      </div>

      <div id="consent-banner" class="consent-banner" hidden>
        <p class="consent-banner-text">Bu site, reklam gösterimi için çerezler kullanır. "Kabul Et"e tıklayarak reklam çerezlerine izin vermiş olursunuz. Detaylar için <a href="/privacy.html">Gizlilik Politikamıza</a> bakabilirsiniz.</p>
        <div class="consent-banner-actions">
          <button id="consent-reject" class="neo-btn" type="button">Reddet</button>
          <button id="consent-accept" class="neo-btn primary" type="button">Kabul Et</button>
        </div>
      </div>

      <footer class="app-footer">
        <a href="/privacy.html">Gizlilik Politikası</a>
        <button id="consent-preferences" class="app-footer-link" type="button">Çerez Tercihleri</button>
      </footer>
    </main>
```

- [ ] **Step 5: Add the consent module script tag**

Find this line:

```html
    <script type="module" src="/adblock.js"></script>
```

Replace it with:

```html
    <script type="module" src="/adblock.js"></script>
    <script type="module" src="/consent.js"></script>
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- PrivacyMarkup`
Expected: PASS (8 tests passed)

- [ ] **Step 7: Add the DOM-wiring layer to `ui/consent.js`**

Append to the end of `ui/consent.js` (after the `isConsentValid` function from Task 1):

```js
function readStoredConsent(storage) {
    try {
        const raw = storage.getItem(CONSENT_STORAGE_KEY)
        if (!raw) return { storedStatus: undefined, storedTimestamp: undefined }
        const parsed = JSON.parse(raw)
        return { storedStatus: parsed.status, storedTimestamp: parsed.timestamp }
    } catch {
        return { storedStatus: undefined, storedTimestamp: undefined }
    }
}

function writeStoredConsent(storage, status) {
    try {
        storage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ status, timestamp: Date.now() }))
    } catch {
        // localStorage unavailable (e.g. private mode) - choice just won't persist across reloads
    }
}

function sendConsentUpdate(win, status) {
    const value = status === "granted" ? "granted" : "denied"
    if (typeof win.gtag === "function") {
        win.gtag("consent", "update", {
            ad_storage: value,
            ad_user_data: value,
            ad_personalization: value
        })
    }
}

function initConsentUi(doc = document, win = window) {
    const banner = doc.getElementById("consent-banner")
    const acceptButton = doc.getElementById("consent-accept")
    const rejectButton = doc.getElementById("consent-reject")
    const preferencesButton = doc.getElementById("consent-preferences")

    let storage = null
    try {
        storage = win.localStorage
    } catch {
        storage = null
    }

    function refreshBanner() {
        if (!banner) return
        if (!storage) {
            banner.hidden = false
            return
        }
        const { storedStatus, storedTimestamp } = readStoredConsent(storage)
        const { valid } = isConsentValid({ storedStatus, storedTimestamp, now: Date.now(), ttlMs: CONSENT_TTL_MS })
        banner.hidden = valid
    }

    function choose(status) {
        if (storage) writeStoredConsent(storage, status)
        sendConsentUpdate(win, status)
        if (banner) banner.hidden = true
    }

    if (acceptButton) acceptButton.addEventListener("click", () => choose("granted"))
    if (rejectButton) rejectButton.addEventListener("click", () => choose("denied"))
    if (preferencesButton && banner) {
        preferencesButton.addEventListener("click", () => { banner.hidden = false })
    }

    refreshBanner()
}

if (typeof document !== "undefined") {
    initConsentUi()
}
```

- [ ] **Step 8: Run the full test suite to confirm nothing broke**

Run: `npm test`
Expected: PASS — all suites green, including `Consent.test.js` and `PrivacyMarkup.test.js`. `initConsentUi` is not imported by any test, and the `if (typeof document !== "undefined")` guard means the bootstrap call doesn't execute under Jest's Node environment.

- [ ] **Step 9: Add consent banner and footer styles to `ui/styles.css`**

Append to the end of `ui/styles.css`:

```css

/* Consent Banner */
.consent-banner {
  position: fixed;
  left: 24px;
  right: 24px;
  bottom: 24px;
  z-index: 20;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px;
  border-radius: var(--radius-md);
  background: var(--surface);
  box-shadow:
    8px 8px 16px var(--shadow-dark),
    -8px -8px 16px var(--shadow-light);
}

.consent-banner[hidden] {
  display: none;
}

.consent-banner-text {
  margin: 0;
  flex: 1 1 320px;
  font-size: 0.9rem;
  color: var(--ink);
  line-height: 1.5;
}

.consent-banner-text a {
  color: var(--accent);
}

.consent-banner-actions {
  display: flex;
  gap: 12px;
}

/* Footer */
.app-footer {
  display: flex;
  justify-content: center;
  gap: 24px;
  padding: 24px 0 0;
  font-size: 0.85rem;
}

.app-footer a,
.app-footer-link {
  color: var(--ink-muted);
  text-decoration: underline;
}

.app-footer-link {
  background: none;
  border: none;
  cursor: pointer;
  font: inherit;
  padding: 0;
}
```

- [ ] **Step 10: Update the service worker precache list**

A prior feature (AdSense/adblock) shipped without bumping the service worker cache version, which meant returning PWA installs never received the update until the cache name was later bumped in a follow-up fix. Avoid repeating that here by updating `ui/sw.js` in the same commit as the new assets it needs to cache.

Read `ui/sw.js` first to confirm its current `CACHE_NAME` value (it should currently be `'lifinize-cache-v2'` from that prior fix). Find:

```js
const CACHE_NAME = 'lifinize-cache-v2'
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/adblock.js',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/favicon.png',
  '/assets/logo.svg'
]
```

Replace it with:

```js
const CACHE_NAME = 'lifinize-cache-v3'
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/adblock.js',
  '/consent.js',
  '/privacy.html',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/favicon.png',
  '/assets/logo.svg'
]
```

If the current file differs from this (e.g. a different cache version number), keep the existing version's number and increment it by one instead of hardcoding `v3` — the goal is any bump plus the two new asset paths, not this exact string.

- [ ] **Step 11: Run the full test suite one more time**

Run: `npm test`
Expected: PASS, same suites as Step 8 (this step only touched `ui/sw.js`, which has no dedicated tests in this repo).

- [ ] **Step 12: Commit**

```bash
git add ui/consent.js ui/index.html ui/styles.css ui/sw.js test/PrivacyMarkup.test.js
git commit -m "feat: add consent banner, Consent Mode v2 wiring, and footer"
```

---

### Task 4: Manual browser verification

**Files:** none (verification only; fix-forward if issues are found)

**Interfaces:**
- Consumes: the running app from Tasks 1-3 via the dev server.
- Produces: nothing for later tasks — this is the final gate.

- [ ] **Step 1: Start the dev server**

Run: `npm run start:ui`
Expected: server logs a listening port.

- [ ] **Step 2: Verify the consent default fires before any stored choice exists**

Open the app in a browser with `localStorage` cleared for that origin. In devtools, before interacting with anything, run:

```js
JSON.stringify(window.dataLayer)
```

Expected: the array contains a `["consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" }]`-shaped entry (arguments captured as an array-like), confirming the bootstrap script ran and defaulted to denied.

- [ ] **Step 3: Verify the banner appears and Accept persists + updates consent**

Confirm `#consent-banner` is visible (not `hidden`). Click "Kabul Et". Verify:

```js
JSON.parse(localStorage.getItem('consent:adsense'))
```

Expected: `{ status: "granted", timestamp: <recent number> }`. Also confirm `window.dataLayer` now contains a `consent update` entry with all three signals `"granted"`, and that `#consent-banner` is hidden again.

- [ ] **Step 4: Verify a returning visit does not re-show the banner**

Reload the page. Expected: `#consent-banner` stays hidden (the bootstrap script's default now reads the stored "granted" choice), and no new banner flash appears.

- [ ] **Step 5: Verify "Çerez Tercihleri" reopens the banner without clearing the stored choice**

Click the "Çerez Tercihleri" footer button. Expected: `#consent-banner` becomes visible again, while `localStorage.getItem('consent:adsense')` still holds the previous choice unchanged until a button is clicked again.

- [ ] **Step 6: Verify the privacy policy page is reachable**

Click "Gizlilik Politikası" in the footer (or navigate to `/privacy.html` directly). Expected: the page loads, styled consistently with the rest of the app, and contains the Codifya/`osmcgrgenc@gmail.com` contact details and the Google ad-policy links. Click "← Uygulamaya dön" and confirm it returns to `/`.

- [ ] **Step 7: Confirm no regression in the adblock feature or the download flow**

Repeat the adblock-banner and download-form checks from the AdSense feature's own Task 4 (forcing `#adblock-banner`/`#adblock-thanks` visible via devtools, and submitting a test URL through the form) to confirm this new feature didn't interfere with either.

- [ ] **Step 8: Run the full automated test suite one more time**

Run: `npm test`
Expected: PASS, all suites green.

- [ ] **Step 9: Record verification result**

No commit needed for this task since it changes no files. If any step above surfaces a bug, fix it in the relevant task's files, re-run that task's tests, and commit the fix with `fix: <description>` before considering the plan complete. Stop the dev server when done.

---

## Self-Review Notes

- **Spec coverage:** pure `isConsentValid` with unit tests (Task 1), privacy policy content matching what `Database.js` actually stores (Task 2), bootstrap script ordering + banner + footer + Consent Mode v2 wiring (Task 3), service-worker precache bump applied proactively this time instead of as a late fix (Task 3, Step 10), manual browser verification of the full flow including the returning-visitor and reopen-preferences cases (Task 4) — all spec sections and acceptance criteria are covered.
- **Placeholder scan:** no TBD/TODO; every step has complete, runnable code.
- **Type/name consistency:** `CONSENT_STORAGE_KEY`, `CONSENT_TTL_MS`, `isConsentValid`, `initConsentUi` are named identically everywhere they appear across Tasks 1 and 3; the `consent:adsense` storage key and `{status, timestamp}` shape match between the bootstrap script, `ui/consent.js`, and the design spec.
