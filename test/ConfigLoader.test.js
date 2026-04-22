import fs from "fs"
import os from "os"
import path from "path"
import { ConfigLoader, configLoader } from "../src/utils/io/ConfigLoader.js"


describe("load", () => {
    test("return 'output' if load DIRECTORY.output", () => {
        expect(configLoader.load("DIRECTORY", "output")).toBe("output");
    })
    test("throw an error if load unknown section", () => {
        expect(() => {
            configLoader.load("FOO", "output")
        }).toThrow(Error)
    })
    test("throw an error if load unknown key", () => {
        expect(() => {
            configLoader.load("DIRECTORY", "FOO")
        }).toThrow(Error)
    })
    test("reads from an explicit config path", () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "scribd-config-"))
        const configPath = path.join(tempDir, "config.ini")
        fs.writeFileSync(configPath, "[DIRECTORY]\noutput=custom-output\n")

        const loader = new ConfigLoader({ configPath })

        expect(loader.load("DIRECTORY", "output")).toBe("custom-output")
    })
})
