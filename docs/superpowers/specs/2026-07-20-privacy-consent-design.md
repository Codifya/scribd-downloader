# Privacy Policy & Ad Consent (Google Consent Mode v2) Design

**Date:** 2026-07-20
**Project:** `scribd-dl`
**Scope:** Add a privacy policy page and a custom cookie/ad-consent banner wired to Google Consent Mode v2, closing the gap flagged as Non-Goals in [docs/superpowers/specs/2026-07-20-adsense-integration-design.md](2026-07-20-adsense-integration-design.md).

## Goal

Let the AdSense integration serve ads to EEA/UK/Swiss visitors in a way Google's policies expect: a public privacy policy disclosing ad-related data use, and a consent mechanism that tells Google's tags whether the visitor has agreed to ad storage/personalization before those tags act on it.

## Current State

The AdSense Auto Ads integration ([docs/superpowers/specs/2026-07-20-adsense-integration-design.md](2026-07-20-adsense-integration-design.md)) shipped without a privacy policy page or any consent signal — its Non-Goals explicitly deferred both. `ui/adblock.js` already established the project's pattern for this kind of feature: a pure, DOM-free decision function unit-tested with Jest, plus DOM-wiring code verified manually in a browser (no jsdom dependency).

`src/utils/db/Database.js` shows exactly what user data this app itself stores: a `history` table keyed by the submitted URL, with `file_path`, `title`, and `created_at` — no accounts, no personal profile, no IP logging in application code. This is the factual basis for the privacy policy's data-collection section.

## Legal Disclaimer

The privacy policy text produced here is a disclosure template following common patterns for AdSense-publisher privacy policies (what data this app collects, what Google's ads do, how to opt out) — it is not legal advice. The user has been told directly to have it reviewed by a legal professional before relying on it for compliance in their jurisdiction.

## Scope Decisions (user-confirmed)

- **Consent approach:** a custom-built banner + Google Consent Mode v2 signals, not Google Funding Choices (avoids a dependency on external AdSense-dashboard configuration the user hasn't set up).
- **Audience targeting:** show the consent banner to all visitors, no IP-based geolocation (avoids a third-party geolocation dependency, extra network request, and sharing visitor IPs with another vendor; showing it globally only over-satisfies Google's requirement, it doesn't under-satisfy it).
- **Consent signals:** `ad_storage`, `ad_user_data`, `ad_personalization` only. No `analytics_storage` — this app has no Google Analytics or other Google tag today (YAGNI).
- **Consent lifetime:** 365 days, then the banner reappears.
- **Contact/business details for the privacy policy:** contact `osmcgrgenc@gmail.com`, business name "Codifya", jurisdiction Türkiye.

## Recommended Approach

1. A tiny **inline, blocking (classic, non-async, non-module) script** in `ui/index.html`'s `<head>`, placed immediately before the existing AdSense script tag, sets up the `dataLayer`/`gtag` stub and calls `gtag('consent', 'default', ...)` using any valid stored consent choice (or "denied" for all three signals if none exists yet). This must run synchronously before the AdSense tag executes — an ES module (deferred by spec) cannot guarantee that ordering, so this piece cannot be `ui/consent.js` loaded as `type="module"` the way `ui/adblock.js` is.
2. `ui/consent.js` (new ES module, loaded near the bottom of `<body>` like `ui/adblock.js`) owns the banner UI: a pure `isConsentValid({ storedStatus, storedTimestamp, now, ttlMs })` function (unit tested) and `initConsentUi()` DOM wiring that shows the banner only when no valid stored choice exists, wires "Kabul Et"/"Reddet" to persist the choice and call `gtag('consent', 'update', ...)`, and exposes a "Çerez Tercihleri" (cookie preferences) re-open affordance.
3. `ui/privacy.html` (new static page, styled consistent with the existing glass-panel look) with the privacy policy content, linked from a new small footer in `ui/index.html`.
4. `ui/styles.css` gets new rules for the consent banner (fixed bottom bar) and the footer, reusing existing custom properties.

## Architecture

### Known, accepted duplication: the validity check

`isConsentValid`'s logic (is there a stored choice, and is it younger than the TTL) is needed in two places that cannot share a single ES module: the classic blocking bootstrap script in `<head>` (must run before the AdSense tag; ES modules are deferred and cannot guarantee this) and `ui/consent.js` (an ES module, so its exports are unit-testable). The bootstrap script therefore contains its own ~5-line inline copy of the same check, with a comment cross-referencing `ui/consent.js`'s `CONSENT_TTL_MS` constant so the two stay in sync if the TTL ever changes. This is a deliberate, small, commented exception to DRY, made for an execution-order guarantee the module system cannot provide.

### `ui/consent.js`

- `CONSENT_STORAGE_KEY = "consent:adsense"` — the localStorage key (localStorage, not sessionStorage: consent must survive across sessions, unlike the adblock banner's per-session dismissal).
- `CONSENT_TTL_MS` — 365 days in milliseconds.
- `isConsentValid({ storedStatus, storedTimestamp, now, ttlMs })` — pure function. Returns `{ valid: boolean, granted: boolean }`. `valid` is false if there's no stored status, the timestamp is missing/non-numeric, or `now - storedTimestamp > ttlMs`. `granted` reflects `storedStatus === "granted"` and is only meaningful when `valid` is true.
- `initConsentUi()` — DOM wiring, guarded by `if (typeof document !== "undefined")` at the bottom of the file (same guard pattern as `ui/adblock.js`, so importing this module under Jest's Node environment never touches `document`):
  - Reads `localStorage.getItem(CONSENT_STORAGE_KEY)` (JSON: `{ status, timestamp }`), computes `isConsentValid(...)`.
  - If not valid, shows the banner.
  - "Kabul Et" click: writes `{ status: "granted", timestamp: Date.now() }`, calls `gtag('consent', 'update', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' })`, hides the banner.
  - "Reddet" click: writes `{ status: "denied", timestamp: Date.now() }`, calls `gtag('consent', 'update', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' })`, hides the banner.
  - "Çerez Tercihleri" footer link click: re-shows the banner regardless of stored state (does not clear the stored choice — the banner's own buttons overwrite it if the user changes their mind).
  - try/catch guard around `localStorage` access, matching `ui/adblock.js`'s `readFlag`/`writeFlag` pattern, since consent storage is exactly as likely to be unavailable (private browsing) as the adblock flags.

### `ui/index.html` changes

- New inline classic script in `<head>`, immediately before the existing `<meta name="google-adsense-account">`/AdSense `<script>` pair added by the AdSense feature:

  ```html
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
  ```

- New banner markup near the top of `<main class="app">` (alongside the existing `#adblock-banner`), and a new `<footer>` near the end of `<main>` with the privacy policy and cookie-preferences links.
- New `<script type="module" src="/consent.js">` tag alongside the existing `/adblock.js` one.

### `ui/privacy.html`

A standalone static page (own `<head>`, reusing `ui/styles.css`) with:
- Operator identity: Codifya, contact `osmcgrgenc@gmail.com`, Türkiye.
- What the app itself collects: the submitted URL, resulting file path, and title, stored server-side in a local SQLite history table for caching/re-download purposes — no user accounts, no personal profile data.
- Third-party advertising: Google AdSense may set cookies/use device identifiers for ad delivery and, if the visitor consents, ad personalization; links to Google's ad policy (`https://policies.google.com/technologies/ads`) and Google's Ad Settings (`https://adssettings.google.com/`) for opt-out.
- How consent works on this site: the banner, its 365-day lifetime, and the "Çerez Tercihleri" link to change the choice at any time.
- Data retention and deletion requests via the contact email.
- Standard sections: children's privacy, changes to this policy, effective date.
- A link back to the main app.

## Error Handling

- All `localStorage` access (bootstrap script and `ui/consent.js`) is wrapped in try/catch; failure is treated as "no valid consent," which is the safe default (denied) — never a hard error.
- Malformed JSON in the stored consent value is treated the same as "no stored choice" (falls back to denied / show banner), not a thrown exception.
- If `ui/privacy.html` fails to load for any reason, the main app (`index.html`) is unaffected — it's a separate static page, no shared runtime dependency.

## Testing Strategy

- Jest unit tests (`test/Consent.test.js`) for `isConsentValid` covering: no stored value, valid granted, valid denied, expired granted, expired denied, malformed/missing timestamp.
- Markup tests (new `test/PrivacyMarkup.test.js` or an extension of the existing `AdsenseMarkup.test.js` pattern) asserting: `ui/privacy.html` exists and contains the required disclosures (operator name, contact email, links to Google's ad policy pages), `ui/index.html` contains the footer links and the consent script tags, and — importantly — that the inline consent-default bootstrap script's marker text appears **before** the AdSense script tag in the raw HTML source (string-index comparison), since that ordering is the entire point of the feature.
- DOM wiring (`initConsentUi`, real `gtag` calls, button clicks) verified manually in a browser, consistent with how `ui/adblock.js`'s DOM layer was verified in the AdSense feature — no jsdom added.

## Non-Goals

- No Google Funding Choices / IAB TCF-certified CMP integration.
- No IP-based geolocation or region-specific banner targeting.
- No Google Analytics or `analytics_storage` consent signal (nothing in the app uses it today).
- No resolution of the known cosmetic overlap between the (bottom-fixed) consent banner and the (bottom-right) adblock "thanks" toast in the rare case both are visible at once — flagged, not fixed, in this pass.
- No claim of legal compliance — the privacy policy is a disclosure template, not legal advice.

## Acceptance Criteria

- `ui/index.html` sends `gtag('consent', 'default', ...)` before the AdSense script tag executes, using any valid stored choice or "denied" otherwise.
- A first-time visitor sees the consent banner; accepting or rejecting persists the choice for 365 days and calls `gtag('consent', 'update', ...)` accordingly.
- A returning visitor with a valid stored choice does not see the banner again until it expires.
- `ui/privacy.html` is reachable from the app's footer and discloses what `Database.js` actually stores plus Google's ad-related data use, with the Codifya/osmcgrgenc@gmail.com/Türkiye contact details.
- `npm test` passes, including the new `Consent.test.js` and markup assertions.
- No regression to the existing download workflow or the adblock-detection feature.
