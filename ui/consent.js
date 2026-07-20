export const CONSENT_STORAGE_KEY = "consent:adsense"
export const CONSENT_TTL_MS = 365 * 24 * 60 * 60 * 1000

export function isConsentValid({ storedStatus, storedTimestamp, now, ttlMs }) {
    if (storedStatus !== "granted" && storedStatus !== "denied") return { valid: false, granted: false }
    if (typeof storedTimestamp !== "number" || Number.isNaN(storedTimestamp)) return { valid: false, granted: false }
    if (typeof now !== "number" || now - storedTimestamp > ttlMs) return { valid: false, granted: false }

    return { valid: true, granted: storedStatus === "granted" }
}
