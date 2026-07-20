export const CONSENT_STORAGE_KEY = "consent:adsense"
export const CONSENT_TTL_MS = 365 * 24 * 60 * 60 * 1000

export function isConsentValid({ storedStatus, storedTimestamp, now, ttlMs }) {
    if (storedStatus !== "granted" && storedStatus !== "denied") return { valid: false, granted: false }
    if (typeof storedTimestamp !== "number" || Number.isNaN(storedTimestamp)) return { valid: false, granted: false }
    if (typeof now !== "number" || now - storedTimestamp > ttlMs) return { valid: false, granted: false }

    return { valid: true, granted: storedStatus === "granted" }
}

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
