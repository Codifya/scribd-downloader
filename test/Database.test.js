import fs from "fs"
import os from "os"
import path from "path"
import { createDatabase } from "../src/utils/db/Database.js"

describe("createDatabase", () => {
    test("creates parent directories and stores records", async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "scribd-db-"))
        const dbPath = path.join(tempDir, "nested", "history.db")
        const database = createDatabase({ dbPath })

        await database.save("https://example.com/doc", "/tmp/example.pdf")

        await expect(database.get("https://example.com/doc")).resolves.toMatchObject({
            url: "https://example.com/doc",
            file_path: "/tmp/example.pdf"
        })

        await database.close()
    })
})
