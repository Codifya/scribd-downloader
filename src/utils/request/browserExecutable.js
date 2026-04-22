import fs from "fs"
import os from "os"
import path from "path"

function getDarwinCandidates(homeDir) {
    return [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        path.join(homeDir, "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
        "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
        path.join(homeDir, "Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"),
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        path.join(homeDir, "Applications/Chromium.app/Contents/MacOS/Chromium"),
        "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        path.join(homeDir, "Applications/Brave Browser.app/Contents/MacOS/Brave Browser"),
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        path.join(homeDir, "Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge")
    ]
}

function getLinuxCandidates() {
    return [
        "/usr/bin/google-chrome-stable",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
        "/usr/bin/brave-browser",
        "/usr/bin/microsoft-edge",
        "/snap/bin/chromium"
    ]
}

function getWindowsCandidates(env) {
    const prefixes = [
        env.PROGRAMFILES,
        env["PROGRAMFILES(X86)"],
        env.LOCALAPPDATA
    ].filter(Boolean)

    const suffixes = [
        "Google\\Chrome\\Application\\chrome.exe",
        "Chromium\\Application\\chrome.exe",
        "BraveSoftware\\Brave-Browser\\Application\\brave.exe",
        "Microsoft\\Edge\\Application\\msedge.exe"
    ]

    return prefixes.flatMap((prefix) => {
        return suffixes.map((suffix) => path.join(prefix, suffix))
    })
}

export function getBrowserCandidates(platform = process.platform, env = process.env, homeDir = os.homedir()) {
    if (platform === "darwin") {
        return getDarwinCandidates(homeDir)
    }

    if (platform === "win32") {
        return getWindowsCandidates(env)
    }

    return getLinuxCandidates()
}

export function resolveBrowserExecutable(options = {}) {
    const {
        env = process.env,
        platform = process.platform,
        homeDir = os.homedir(),
        existsSync = fs.existsSync,
        defaultExecutablePath
    } = options

    const overridePath = env.PUPPETEER_EXECUTABLE_PATH || env.CHROME_PATH
    if (overridePath) {
        return {
            executablePath: overridePath,
            source: "env"
        }
    }

    if (typeof defaultExecutablePath === "function") {
        try {
            return {
                executablePath: defaultExecutablePath(),
                source: "puppeteer"
            }
        } catch {
            // Ignore and continue with installed-browser fallback.
        }
    }

    const executablePath = getBrowserCandidates(platform, env, homeDir).find((candidate) => existsSync(candidate)) || null

    return {
        executablePath,
        source: executablePath ? "system" : "missing"
    }
}

export function buildMissingBrowserErrorMessage() {
    return [
        "Could not find a Chromium or Chrome executable for Puppeteer.",
        "Run `npm run install:browsers` to download the bundled Chromium revision,",
        "or set `PUPPETEER_EXECUTABLE_PATH` / `CHROME_PATH` to an installed browser."
    ].join(" ")
}
