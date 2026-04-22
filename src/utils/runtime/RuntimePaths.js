import path from "path"
import { mkdir } from "fs/promises"

function resolvePath(value, cwd) {
    return path.isAbsolute(value) ? value : path.resolve(cwd, value)
}

export function resolveRuntimePaths({ env = process.env, cwd = process.cwd() } = {}) {
    const workingDir = path.resolve(cwd)
    const hasDataDir = typeof env.DATA_DIR === "string" && env.DATA_DIR.trim() !== ""
    const dataDir = resolvePath(hasDataDir ? env.DATA_DIR : workingDir, workingDir)
    const parsedPort = Number.parseInt(env.PORT || env.UI_PORT || "4173", 10)

    return {
        workingDir,
        dataDir,
        configPath: resolvePath(
            env.CONFIG_PATH || (hasDataDir ? path.join(dataDir, "config.ini") : path.join(workingDir, "config.ini")),
            workingDir
        ),
        dbPath: resolvePath(
            env.DB_PATH || (hasDataDir ? path.join(dataDir, "history.db") : path.join(workingDir, "history.db")),
            workingDir
        ),
        outputDir: resolvePath(
            env.OUTPUT_DIR || (hasDataDir ? path.join(dataDir, "output") : path.join(workingDir, "output")),
            workingDir
        ),
        host: env.HOST || "0.0.0.0",
        port: Number.isInteger(parsedPort) ? parsedPort : 4173
    }
}

export function resolveOutputDirectory({ env = process.env, cwd = process.cwd(), configLoader } = {}) {
    if (env.OUTPUT_DIR || env.DATA_DIR) {
        return resolveRuntimePaths({ env, cwd }).outputDir
    }

    return resolvePath(configLoader.load("DIRECTORY", "output", "output"), cwd)
}

export async function ensureRuntimeDirectories(runtimePaths) {
    const directories = new Set([
        runtimePaths.dataDir,
        path.dirname(runtimePaths.configPath),
        path.dirname(runtimePaths.dbPath),
        runtimePaths.outputDir
    ])

    for (const directory of directories) {
        await mkdir(directory, { recursive: true })
    }
}
