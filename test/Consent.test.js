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
