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
