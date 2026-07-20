import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const html = fs.readFileSync(path.join(__dirname, "..", "ui", "index.html"), "utf8")

describe("AdSense markup", () => {
    test("includes the Auto Ads script tag with the publisher client id", () => {
        expect(html).toContain(
            "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5525349541277692"
        )
    })

    test("includes the adsense verification meta tag", () => {
        expect(html).toContain('<meta name="google-adsense-account" content="ca-pub-5525349541277692">')
    })
})
