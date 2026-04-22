import { buildMissingBrowserErrorMessage, getBrowserCandidates, resolveBrowserExecutable } from "../src/utils/request/browserExecutable.js"

describe("resolveBrowserExecutable", () => {
    test("prefers explicit environment override", () => {
        const result = resolveBrowserExecutable({
            env: { PUPPETEER_EXECUTABLE_PATH: "/custom/chrome" },
            existsSync: () => false
        })

        expect(result).toEqual({
            executablePath: "/custom/chrome",
            source: "env"
        })
    })

    test("uses Puppeteer's bundled executable when available", () => {
        const result = resolveBrowserExecutable({
            defaultExecutablePath: () => "/cache/chromium"
        })

        expect(result).toEqual({
            executablePath: "/cache/chromium",
            source: "puppeteer"
        })
    })

    test("falls back to an installed browser candidate", () => {
        const candidates = getBrowserCandidates("darwin", {}, "/Users/tester")
        const installed = candidates[2]
        const result = resolveBrowserExecutable({
            platform: "darwin",
            env: {},
            homeDir: "/Users/tester",
            defaultExecutablePath: () => {
                throw new Error("missing")
            },
            existsSync: (candidate) => candidate === installed
        })

        expect(result).toEqual({
            executablePath: installed,
            source: "system"
        })
    })

    test("returns missing when no browser is available", () => {
        const result = resolveBrowserExecutable({
            platform: "linux",
            env: {},
            defaultExecutablePath: () => {
                throw new Error("missing")
            },
            existsSync: () => false
        })

        expect(result).toEqual({
            executablePath: null,
            source: "missing"
        })
        expect(buildMissingBrowserErrorMessage()).toContain("npm run install:browsers")
    })
})
