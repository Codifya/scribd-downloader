import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const privacyHtml = fs.readFileSync(path.join(__dirname, "..", "ui", "privacy.html"), "utf8")
const indexHtml = fs.readFileSync(path.join(__dirname, "..", "ui", "index.html"), "utf8")

describe("Privacy policy page", () => {
    test("discloses the operator identity and contact", () => {
        expect(privacyHtml).toContain("Codifya")
        expect(privacyHtml).toContain("osmcgrgenc@gmail.com")
    })

    test("links to Google's ad policy and ad settings pages", () => {
        expect(privacyHtml).toContain("https://policies.google.com/technologies/ads")
        expect(privacyHtml).toContain("https://adssettings.google.com/")
    })

    test("describes what the app itself stores", () => {
        expect(privacyHtml).toContain("geçmiş")
    })

    test("links back to the main app", () => {
        expect(privacyHtml).toContain('href="/"')
    })
})

describe("Consent markup in index.html", () => {
    test("sends the consent default before the AdSense script tag", () => {
        const consentDefaultIndex = indexHtml.indexOf("gtag('consent', 'default'")
        const adsenseScriptIndex = indexHtml.indexOf("adsbygoogle.js?client=ca-pub-5525349541277692")

        expect(consentDefaultIndex).toBeGreaterThan(-1)
        expect(adsenseScriptIndex).toBeGreaterThan(-1)
        expect(consentDefaultIndex).toBeLessThan(adsenseScriptIndex)
    })

    test("includes the consent banner and its buttons", () => {
        expect(indexHtml).toContain('id="consent-banner"')
        expect(indexHtml).toContain('id="consent-accept"')
        expect(indexHtml).toContain('id="consent-reject"')
    })

    test("includes a footer linking to the privacy policy and cookie preferences", () => {
        expect(indexHtml).toContain('href="/privacy.html"')
        expect(indexHtml).toContain('id="consent-preferences"')
    })

    test("loads the consent module script", () => {
        expect(indexHtml).toContain('<script type="module" src="/consent.js"></script>')
    })
})
