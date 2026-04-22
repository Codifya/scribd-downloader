# Dokploy Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Scribd downloader web UI deployable on Dokploy with a Dockerfile-based runtime, health endpoint, and persistent filesystem paths.

**Architecture:** Extract deployment-sensitive runtime behavior into small reusable modules: one module for runtime path resolution, one for HTTP server creation, and factory-based config/database helpers. Keep downloader behavior intact while routing container concerns through environment variables and explicit startup initialization.

**Tech Stack:** Node.js 18, Jest, Puppeteer, SQLite3, Docker, plain HTTP server

---

### Task 1: Add runtime path resolution and tests

**Files:**
- Create: `src/utils/runtime/RuntimePaths.js`
- Create: `test/RuntimePaths.test.js`

- [ ] **Step 1: Write the failing tests**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- RuntimePaths.test.js`
Expected: FAIL with module-not-found for `src/utils/runtime/RuntimePaths.js`

- [ ] **Step 3: Write minimal implementation**

```js
import path from "path"

function resolvePath(value, cwd) {
    return path.isAbsolute(value) ? value : path.resolve(cwd, value)
}

export function resolveRuntimePaths({ env = process.env, cwd = process.cwd() } = {}) {
    const workingDir = path.resolve(cwd)
    const hasDataDir = typeof env.DATA_DIR === "string" && env.DATA_DIR.trim() !== ""
    const dataDir = resolvePath(hasDataDir ? env.DATA_DIR : workingDir, workingDir)
    const port = Number.parseInt(env.PORT || env.UI_PORT || "4173", 10)

    return {
        workingDir,
        dataDir,
        configPath: resolvePath(env.CONFIG_PATH || (hasDataDir ? path.join(dataDir, "config.ini") : path.join(workingDir, "config.ini")), workingDir),
        dbPath: resolvePath(env.DB_PATH || (hasDataDir ? path.join(dataDir, "history.db") : path.join(workingDir, "history.db")), workingDir),
        outputDir: resolvePath(env.OUTPUT_DIR || (hasDataDir ? path.join(dataDir, "output") : path.join(workingDir, "output")), workingDir),
        host: env.HOST || "0.0.0.0",
        port: Number.isInteger(port) ? port : 4173
    }
}

export function resolveOutputDirectory({ env = process.env, cwd = process.cwd(), configLoader } = {}) {
    if (env.OUTPUT_DIR || env.DATA_DIR) {
        return resolveRuntimePaths({ env, cwd }).outputDir
    }

    return resolvePath(configLoader.load("DIRECTORY", "output", "output"), cwd)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- RuntimePaths.test.js`
Expected: PASS with 3 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/utils/runtime/RuntimePaths.js test/RuntimePaths.test.js
git commit -m "test: add runtime path resolution coverage"
```

### Task 2: Refactor config and database initialization for deployment paths

**Files:**
- Modify: `src/utils/io/ConfigLoader.js`
- Modify: `src/utils/db/Database.js`
- Modify: `src/service/ScribdDownloader.js`
- Modify: `src/service/SlideshareDownloader.js`
- Modify: `src/service/EverandDownloader.js`
- Modify: `test/ConfigLoader.test.js`
- Create: `test/Database.test.js`

- [ ] **Step 1: Write the failing tests**

```js
import fs from "fs"
import os from "os"
import path from "path"
import { ConfigLoader } from "../src/utils/io/ConfigLoader.js"
import { createDatabase } from "../src/utils/db/Database.js"

test("ConfigLoader reads from an explicit config path", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "scribd-config-"))
    const configPath = path.join(tempDir, "config.ini")
    fs.writeFileSync(configPath, "[DIRECTORY]\\noutput=custom-output\\n")

    const loader = new ConfigLoader({ configPath })

    expect(loader.load("DIRECTORY", "output")).toBe("custom-output")
})

test("Database creates parent directories and stores records", async () => {
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ConfigLoader.test.js Database.test.js`
Expected: FAIL because `ConfigLoader` and `createDatabase` do not yet support explicit paths

- [ ] **Step 3: Write minimal implementation**

```js
// ConfigLoader.js
export class ConfigLoader {
    constructor({ configPath = resolveRuntimePaths().configPath } = {}) {
        this.configPath = configPath
        this._config = this._loadFromFile()
    }
}

export function createConfigLoader(options = {}) {
    return new ConfigLoader(options)
}

export const configLoader = createConfigLoader()

// Database.js
export class Database {
    constructor({ dbPath = resolveRuntimePaths().dbPath } = {}) {
        this.dbPath = dbPath
        fs.mkdirSync(path.dirname(this.dbPath), { recursive: true })
        this.ready = new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err)
                    return
                }

                this.db.run(CREATE_HISTORY_TABLE_SQL, (tableError) => {
                    if (tableError) reject(tableError)
                    else resolve()
                })
            })
        })
    }
}

export function createDatabase(options = {}) {
    return new Database(options)
}
```

- [ ] **Step 4: Update downloader output resolution**

```js
// inside each downloader constructor
this.output = resolveOutputDirectory({ configLoader })
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- ConfigLoader.test.js Database.test.js RuntimePaths.test.js`
Expected: PASS with all deployment-path tests green

- [ ] **Step 6: Commit**

```bash
git add src/utils/io/ConfigLoader.js src/utils/db/Database.js src/service/ScribdDownloader.js src/service/SlideshareDownloader.js src/service/EverandDownloader.js test/ConfigLoader.test.js test/Database.test.js src/utils/runtime/RuntimePaths.js test/RuntimePaths.test.js
git commit -m "refactor: support runtime path overrides"
```

### Task 3: Extract the UI server, add `/health`, and cover it with tests

**Files:**
- Create: `src/server/createUiServer.js`
- Modify: `ui.js`
- Create: `test/UiServer.test.js`

- [ ] **Step 1: Write the failing tests**

```js
import { startUiServer } from "../src/server/createUiServer.js"

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- UiServer.test.js`
Expected: FAIL because `src/server/createUiServer.js` does not exist

- [ ] **Step 3: Write minimal implementation**

```js
export async function createUiServer(options = {}) {
    const runtimePaths = resolveRuntimePaths({ env: options.env, cwd: options.cwd })
    const config = options.configLoader || createConfigLoader({ configPath: runtimePaths.configPath })
    const db = options.database || createDatabase({ dbPath: runtimePaths.dbPath })
    await db.ready

    const outputDir = resolveOutputDirectory({
        env: options.env,
        cwd: options.cwd,
        configLoader: config
    })

    const server = http.createServer(async (req, res) => {
        const requestUrl = new URL(req.url, `http://${req.headers.host}`)

        if (requestUrl.pathname === "/health" && req.method === "GET") {
            sendJson(res, 200, { status: "ok", version: appVersion })
            return
        }

        if (requestUrl.pathname === "/api/config" && req.method === "GET") {
            sendJson(res, 200, { output: outputDir, version: appVersion, appName: "Lifinize Downloader" })
            return
        }

        if (requestUrl.pathname === "/api/start" && req.method === "POST") {
            await handleStartJob(req, res)
            return
        }

        if (requestUrl.pathname.startsWith("/api/download/") && req.method === "GET") {
            await handleDownload(req, res, outputDir)
            return
        }

        if (requestUrl.pathname === "/api/stream" && req.method === "GET") {
            handleSse(req, res)
            return
        }

        await handleStaticAsset(req, res)
    })

    return {
        appVersion,
        server,
        async close() {
            await new Promise((resolve, reject) => {
                server.close((error) => error ? reject(error) : resolve())
            })
        }
    }
}

export async function startUiServer(options = {}) {
    const ui = await createUiServer(options)
    const runtimePaths = resolveRuntimePaths({ env: options.env, cwd: options.cwd })

    await new Promise((resolve, reject) => {
        ui.server.listen(runtimePaths.port, runtimePaths.host, (error) => error ? reject(error) : resolve())
    })

    return ui
}
```

- [ ] **Step 4: Update bootstrap file**

```js
import { startUiServer } from "./src/server/createUiServer.js"

const ui = await startUiServer()
const address = ui.server.address()

console.log(`UI running at http://localhost:${address.port}`)
console.log(`Version: ${ui.appVersion}`)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- UiServer.test.js ConfigLoader.test.js Database.test.js RuntimePaths.test.js`
Expected: PASS with the new health endpoint covered

- [ ] **Step 6: Commit**

```bash
git add src/server/createUiServer.js ui.js test/UiServer.test.js src/utils/io/ConfigLoader.js src/utils/db/Database.js src/utils/runtime/RuntimePaths.js
git commit -m "feat: add Dokploy health-ready ui server"
```

### Task 4: Add Docker deploy assets and documentation

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Modify: `README.md`

- [ ] **Step 1: Write the failing verification**

Run: `docker build -t scribd-dl-dokploy .`
Expected: FAIL because there is no `Dockerfile`

- [ ] **Step 2: Write minimal Docker assets**

```dockerfile
FROM node:18-bookworm-slim

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATA_DIR=/app/data \
    OUTPUT_DIR=/app/data/output \
    DB_PATH=/app/data/history.db \
    CONFIG_PATH=/app/data/config.ini \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnss3 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .
RUN mkdir -p /app/data/output

EXPOSE 3000

CMD ["npm", "run", "start:ui"]
```

```gitignore
node_modules
npm-debug.log
.git
.github
.DS_Store
history.db
output
docs/superpowers
```

- [ ] **Step 3: Document Dokploy usage**

```md
## Dokploy Deployment

- Build Type: `Dockerfile`
- Dockerfile Path: `Dockerfile`
- Docker Context Path: `.`
- Internal Port: `3000`
- Health Check: `curl -f http://localhost:3000/health`
- Persistent Mount: `/app/data`
```

- [ ] **Step 4: Run verification commands**

Run: `npm test`
Expected: PASS

Run: `docker build -t scribd-dl-dokploy .`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add Dockerfile .dockerignore README.md
git commit -m "chore: add Dokploy deployment assets"
```
