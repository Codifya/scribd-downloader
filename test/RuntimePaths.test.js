import path from "path"
import { resolveRuntimePaths, resolveOutputDirectory } from "../src/utils/runtime/RuntimePaths.js"

describe("resolveRuntimePaths", () => {
    test("prefers Dokploy env vars for host, port, and data paths", () => {
        const runtimePaths = resolveRuntimePaths({
            cwd: "/workspace/app",
            env: {
                HOST: "0.0.0.0",
                PORT: "3000",
                DATA_DIR: "/app/data"
            }
        })

        expect(runtimePaths.host).toBe("0.0.0.0")
        expect(runtimePaths.port).toBe(3000)
        expect(runtimePaths.dataDir).toBe("/app/data")
        expect(runtimePaths.configPath).toBe("/app/data/config.ini")
        expect(runtimePaths.dbPath).toBe("/app/data/history.db")
        expect(runtimePaths.outputDir).toBe("/app/data/output")
    })

    test("falls back to local defaults when Dokploy env vars are absent", () => {
        const runtimePaths = resolveRuntimePaths({
            cwd: "/workspace/app",
            env: {}
        })

        expect(runtimePaths.port).toBe(4173)
        expect(runtimePaths.host).toBe("0.0.0.0")
        expect(runtimePaths.configPath).toBe(path.join("/workspace/app", "config.ini"))
        expect(runtimePaths.dbPath).toBe(path.join("/workspace/app", "history.db"))
    })
})

describe("resolveOutputDirectory", () => {
    test("uses config output locally and resolves it to an absolute path", () => {
        const outputDir = resolveOutputDirectory({
            cwd: "/workspace/app",
            env: {},
            configLoader: {
                load: () => "downloads"
            }
        })

        expect(outputDir).toBe(path.join("/workspace/app", "downloads"))
    })
})
