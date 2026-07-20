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
