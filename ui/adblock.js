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
