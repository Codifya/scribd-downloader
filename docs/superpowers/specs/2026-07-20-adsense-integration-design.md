# Google AdSense Integration Design

**Date:** 2026-07-20
**Project:** `scribd-dl`
**Scope:** Add Google AdSense (Auto Ads) to the static PWA served from `ui/`, detect ad blockers with a dismissible warning banner, and thank users who disable their ad blocker after seeing the warning.

## Goal

Monetize the hosted web UI with Google AdSense while being explicit and honest with users about ad blocking, without violating AdSense publisher policy or attempting anything the browser security model does not actually support.

## Current State

The UI is a static PWA (`ui/index.html`, `ui/app.js`, `ui/styles.css`, `ui/sw.js`) served by [`src/server/createUiServer.js`](/Users/osmancagrigenc/Projects/scribd-dl/src/server/createUiServer.js). There is no ad tooling, no ad-blocker detection, and no privacy policy page today.

## Constraint That Shaped This Design

The original request included a "thank users who click on ads" message. This is not implemented as literally stated, for two independent reasons:

1. **Technical:** AdSense ads render inside cross-origin `<iframe>`s. Page JavaScript cannot observe a click inside that iframe — there is no supported DOM event for it. Any "click detected" signal on the parent page is a heuristic (e.g. window blur/visibility change), not a real click observation, and produces heavy false positives (tab switches, alt-tabs, OS notifications).
2. **Policy:** Google's AdSense Publisher Policies prohibit encouraging or acknowledging ad clicks in any form, because it can be construed as invalid-traffic incentivization. Doing so risks permanent AdSense account suspension.

Instead, the "thank you" moment is tied to a real, policy-safe, detectable signal: **the user disabling their ad blocker after seeing the warning banner**, not to a click.

**Also explicitly out of scope:** a privacy policy page and a cookie/consent (CMP) flow. Google requires these for AdSense in the EEA/UK, but they are a separate, larger effort and are not part of this change.

## Recommended Approach

1. Add the AdSense Auto Ads script (client id `ca-pub-5525349541277692`) to `ui/index.html`. Auto Ads means Google chooses ad placement/timing automatically — no manual ad slot markup or slot IDs required.
2. Add a small, dependency-free ad-blocker detector (`ui/adblock.js`) using the standard "bait element" technique plus a script-load-failure fallback signal.
3. Add a dismissible warning banner and a transient "thanks" toast, styled to match the existing glass-panel/neomorphism visual language.
4. Keep the decision logic (is it blocked? what should the UI show?) in small pure functions so the meaningful behavior is unit-testable without a DOM/browser test harness.

## Architecture

### New file: `ui/adblock.js`

Loaded via a `<script>` tag after `app.js`. Responsibilities:

- `isBaitBlocked(bait)` — pure function. Takes an object exposing `offsetHeight`, `offsetParent`, and a computed-display getter; returns `true` if the element was hidden/collapsed the way ad-blocking filter lists do to elements classed like ad slots. No DOM access inside this function — it only reads the passed-in measurements — so it is unit-testable with plain object fixtures.
- `detectAdBlock()` — impure orchestrator. Creates a real off-screen `div` with classes commonly targeted by filter lists (`adsbox ad-banner adsbygoogle ad-placement`), waits ~150ms, measures it with `isBaitBlocked`, removes it, and resolves a boolean. Also treats an `error` event on the AdSense script tag as an immediate "blocked" signal (covers network-level/DNS blocking, which the bait-div technique does not catch).
- `computeAdblockUiState({ wasBlocked, isBlocked, dismissed, thanksShown })` — pure function returning `{ showBanner, showThanks }`. Encodes the rules:
  - `showBanner = isBlocked && !dismissed`
  - `showThanks = wasBlocked && !isBlocked && !thanksShown` (only fires on a real blocked→unblocked transition, and only once per session)
- Session state lives in `sessionStorage` under two keys: `adblock:dismissed` and `adblock:thanksShown`. Using `sessionStorage` (not `localStorage`) means the warning reappears on a fresh visit rather than being silenced forever after one dismissal.
- Re-checks run on `visibilitychange`/`focus` (catches the user toggling their extension in another tab) and are not on a tight polling loop, to avoid unnecessary work.

### Markup and styling (`ui/index.html`, `ui/styles.css`)

- `<head>`: AdSense Auto Ads script tag + `<meta name="google-adsense-account" content="ca-pub-5525349541277692">`.
- A banner container (`#adblock-banner`, hidden by default) inserted at the top of `<main class="app">`, with a message and a close (×) button.
- A toast container (`#adblock-thanks`, hidden by default), fixed bottom-right, auto-dismissing after ~4s.
- New CSS rules reusing existing custom properties (`--warning`, `--success`, `--radius-md`, `--ease-smooth`, etc.) so the new elements look native to the current design rather than bolted on.

### Data flow

```
page load
  -> detectAdBlock() (after ~150ms, and on script error immediately)
  -> read sessionStorage flags
  -> computeAdblockUiState(...)
  -> render banner and/or toast accordingly

user clicks banner close (X)
  -> set adblock:dismissed = "1"
  -> hide banner (thanks toast can still fire later if they disable blocking)

visibilitychange / focus
  -> re-run detectAdBlock()
  -> if transition blocked -> unblocked and not yet thanked -> show toast, set adblock:thanksShown = "1"
```

## Error Handling

- If `sessionStorage` is unavailable (privacy mode edge cases), fall back to in-memory state for the current page life — the feature degrades to "no persistence across reload" rather than throwing.
- If the AdSense script fails to load, the app must continue to function normally; ad failures never block the download workflow.
- All DOM lookups in `adblock.js` guard for missing elements (consistent with the existing defensive style in `app.js`).

## Testing Strategy

- Jest unit tests (`test/Adblock.test.js`) for the two pure functions:
  - `isBaitBlocked` against fixture objects representing "visible", "zero-height", and "display:none" cases.
  - `computeAdblockUiState` against the full combination of `{wasBlocked, isBlocked, dismissed, thanksShown}` truth table.
- No new test dependencies required (no jsdom) since the pure functions do not touch `document`.
- Manual browser verification via the dev server: confirm the AdSense script tag loads without console errors, confirm the banner/toast render and dismiss correctly, and confirm existing download flow (`app.js` behavior) is unaffected.

## Non-Goals

- No manual/fixed ad slot placements (Auto Ads only).
- No ad-click detection or click-based messaging of any kind.
- No privacy policy page or consent management platform (CMP) — flagged as a recommended follow-up, not built here.
- No changes to the download/job workflow, service worker caching list, or server code.

## Acceptance Criteria

- `ui/index.html` includes the AdSense script tag with client id `ca-pub-5525349541277692` and loads without blocking page render.
- Visiting with a simulated ad blocker shows the dismissible banner; closing it hides it for the rest of the session.
- Simulating the blocked→unblocked transition shows the one-time "thanks" toast.
- `npm test` passes, including new tests in `test/Adblock.test.js`.
- No existing behavior in `app.js`, `sw.js`, or the server regresses.
