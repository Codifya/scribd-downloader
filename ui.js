import { startUiServer } from "./src/server/createUiServer.js"

const ui = await startUiServer()
const address = ui.server.address()
const host = typeof address === "object" && address ? address.address : ui.host
const port = typeof address === "object" && address ? address.port : ui.port

console.log(`UI running at http://${host}:${port}`)
console.log(`Version: ${ui.appVersion}`)
