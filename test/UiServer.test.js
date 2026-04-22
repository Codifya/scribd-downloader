import fs from "fs"
import os from "os"
import path from "path"
import { startUiServer } from "../src/server/createUiServer.js"

describe("startUiServer", () => {
    test("GET /health returns 200 with service metadata", async () => {
        const ui = await startUiServer({
            env: { HOST: "127.0.0.1", PORT: "0" },
            configLoader: {
                load: (section, key) => {
                    if (section === "DIRECTORY" && key === "output") return "output"
                    throw new Error(`Unexpected config read: ${section}.${key}`)
                }
            },
            database: {
                ready: Promise.resolve(),
                get: async () => null,
                save: async () => null
            }
        })

        const address = ui.server.address()
        const response = await fetch(`http://127.0.0.1:${address.port}/health`)
        const payload = await response.json()

        expect(response.status).toBe(200)
        expect(payload.status).toBe("ok")
        expect(payload.version).toBeDefined()

        await ui.close()
    })

    test("creates Dokploy data directories on startup", async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "scribd-ui-"))
        const dataDir = path.join(tempDir, "data")
        const ui = await startUiServer({
            env: { HOST: "127.0.0.1", PORT: "0", DATA_DIR: dataDir },
            configLoader: {
                load: (section, key) => {
                    if (section === "DIRECTORY" && key === "output") return "output"
                    throw new Error(`Unexpected config read: ${section}.${key}`)
                }
            },
            database: {
                ready: Promise.resolve(),
                get: async () => null,
                save: async () => null
            }
        })

        expect(fs.existsSync(dataDir)).toBe(true)
        expect(fs.existsSync(path.join(dataDir, "output"))).toBe(true)

        await ui.close()
    })
})
