# Dokploy Deployment Design

**Date:** 2026-04-22
**Project:** `scribd-dl`
**Scope:** Make the existing Node.js + Puppeteer web UI deployable on Dokploy with predictable runtime behavior and persistent application data.

## Goal

Deploy the web UI as a single Dokploy application built from a repository `Dockerfile`, with a stable HTTP port, health endpoint, and persistent storage for downloaded files, config, and SQLite history.

## Current State

The repository currently exposes a Node.js HTTP server from [`ui.js`](/Users/osmancagrigenc/Projects/scribd-dl/ui.js) and uses Puppeteer to automate Chromium-based downloads. The app reads `config.ini` and `history.db` from the process working directory, writes downloaded files into a relative `output/` directory, and listens on `UI_PORT` with a hardcoded default of `4173`.

This is sufficient for local development, but it is brittle for Dokploy because:

- the runtime contract is implicit rather than containerized;
- the server does not expose a dedicated health route for zero-downtime deployments;
- the HTTP port is not aligned with the common `PORT` environment contract;
- application state is tied to the container filesystem and current working directory;
- Puppeteer/Chromium availability is not guaranteed unless the image explicitly installs browser dependencies.

## Recommended Approach

Use Dokploy's `Dockerfile` build type and commit the deployment assets into the repository.

This approach is preferred over Nixpacks/Railpack because the app depends on Chromium and Linux system packages that are easier to manage explicitly in a Docker image. It also avoids Dokploy-side drift: the repository itself defines the runtime, health behavior, and filesystem layout.

## Architecture

### Container runtime

The application will run in a single Node.js container:

- base image: an official Node 18 Linux image;
- system dependencies: Chromium runtime libraries required by Puppeteer;
- application process: `npm run start:ui`;
- network binding: `HOST=0.0.0.0`, `PORT=3000`.

The container will expose one HTTP service only. CLI mode remains available for local use but is not part of the Dokploy web deployment path.

### Persistent data model

The container will treat `/app/data` as its writable application state root.

The following logical paths will become configurable:

- `DATA_DIR`: base writable directory, default `/app/data` in container environments;
- `OUTPUT_DIR`: final downloaded files directory, default `${DATA_DIR}/output`;
- `DB_PATH`: SQLite history file path, default `${DATA_DIR}/history.db`;
- `CONFIG_PATH`: config file path, default `${DATA_DIR}/config.ini`.

At startup, the app should work even if these files or directories do not yet exist. It should create missing directories as needed and fall back to built-in defaults when `config.ini` is absent.

### Health and readiness

The server will expose `GET /health` that returns HTTP `200` with a small JSON payload indicating service availability. This route must not depend on an active Puppeteer session or a download in progress.

Dokploy health checks will target `http://localhost:3000/health`.

### Browser execution

The existing browser resolution logic will remain in place:

- first honor `PUPPETEER_EXECUTABLE_PATH` or `CHROME_PATH`;
- otherwise use Puppeteer's bundled executable if present;
- otherwise fall back to common system browser paths.

The Docker image should make this deterministic by installing Chromium and exporting its executable path, so Dokploy deployments do not depend on runtime discovery luck.

## Required Code Changes

### 1. Runtime configuration normalization

Update server and filesystem code so deployment configuration comes from environment variables first, not from `process.cwd()` assumptions.

This includes:

- reading `PORT` first and keeping `UI_PORT` as backward-compatible fallback;
- reading `HOST` with default `0.0.0.0` for container environments;
- resolving `DATA_DIR`, `OUTPUT_DIR`, `DB_PATH`, and `CONFIG_PATH`;
- creating writable directories before first use.

### 2. Health endpoint

Add `GET /health` to [`ui.js`](/Users/osmancagrigenc/Projects/scribd-dl/ui.js).

Response shape should be simple and stable, for example:

```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

### 3. Docker assets

Add:

- a production `Dockerfile`;
- a `.dockerignore` file to keep builds smaller and avoid baking transient output/history into the image.

The image must:

- install production dependencies;
- install Chromium and its required OS packages;
- expose port `3000`;
- set `NODE_ENV=production`;
- run the web UI process.

### 4. Documentation

Extend [`README.md`](/Users/osmancagrigenc/Projects/scribd-dl/README.md) with a Dokploy deployment section that documents:

- Dokploy build type: `Dockerfile`;
- Dockerfile path and context path;
- required env vars;
- recommended volume mount target for `/app/data`;
- health check URL and expected port.

## Dokploy Configuration

The target Dokploy configuration is:

- Build Type: `Dockerfile`
- Dockerfile Path: `Dockerfile`
- Docker Context Path: `.`
- Internal service port: `3000`
- Environment:
  - `NODE_ENV=production`
  - `HOST=0.0.0.0`
  - `PORT=3000`
  - `DATA_DIR=/app/data`
  - `OUTPUT_DIR=/app/data/output`
  - `DB_PATH=/app/data/history.db`
  - `CONFIG_PATH=/app/data/config.ini`
  - `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`
- Mount:
  - host or Dokploy volume -> `/app/data`
- Health check:
  - `curl -f http://localhost:3000/health`

## Error Handling

The deployment changes must preserve current behavior for local development while improving failure modes in production:

- if Chromium is missing, the app should still fail with the existing actionable browser error message;
- if the data directory cannot be created, fail fast with a clear filesystem error;
- if the SQLite database path is invalid, fail fast during initialization rather than silently running without history;
- if the config file is missing, use defaults rather than treating it as fatal.

## Testing Strategy

Testing should focus on the deployment-sensitive seams:

- unit tests for env-based path resolution and config path handling;
- unit tests for database/config initialization against custom paths;
- an integration-level smoke test that starts the HTTP server and verifies `GET /health`;
- a Docker build smoke test to confirm the image builds successfully.

Avoid end-to-end download tests in this change because they depend on third-party sites and would make deployment verification flaky.

## Non-Goals

This work will not:

- redesign the UI;
- refactor the downloader architecture beyond deployment-related seams;
- add authentication, rate limiting, or multi-user isolation;
- implement Dokploy resources as repository templates unless later requested.

## Acceptance Criteria

The change is complete when all of the following are true:

- the repository contains a working `Dockerfile` and `.dockerignore`;
- the app listens on `PORT` and `HOST` in Dokploy-compatible fashion;
- `GET /health` returns `200`;
- config, output, and history paths can be redirected to `/app/data`;
- a clean container can start without pre-existing `config.ini`, `history.db`, or `output/`;
- `npm test` passes;
- the Docker image builds successfully locally;
- README instructions are sufficient to reproduce the Dokploy deployment.
