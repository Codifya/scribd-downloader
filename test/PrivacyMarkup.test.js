import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const privacyHtml = fs.readFileSync(path.join(__dirname, "..", "ui", "privacy.html"), "utf8")

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
