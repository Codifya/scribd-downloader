import sqlite3 from 'sqlite3'
import path from 'path'
import fs from 'fs'
import { resolveRuntimePaths } from "../runtime/RuntimePaths.js"

const CREATE_HISTORY_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS history (
        url TEXT PRIMARY KEY,
        file_path TEXT,
        title TEXT,
        created_at INTEGER
    )
`

export class Database {
    constructor({ dbPath = resolveRuntimePaths().dbPath } = {}) {
        this.dbPath = dbPath
        fs.mkdirSync(path.dirname(this.dbPath), { recursive: true })
        this.ready = this._init()
    }

    _init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err)
                    return
                }

                this.db.run(CREATE_HISTORY_TABLE_SQL, (tableError) => {
                    if (tableError) {
                        reject(tableError)
                        return
                    }

                    resolve()
                })
            })
        })
    }

    /**
     * Get a record by URL
     * @param {string} url 
     * @returns {Promise<object|null>}
     */
    get(url) {
        return this.ready.then(() => {
            return new Promise((resolve, reject) => {
                this.db.get("SELECT * FROM history WHERE url = ?", [url], (err, row) => {
                    if (err) reject(err)
                    else resolve(row)
                })
            })
        })
    }

    /**
     * Insert or replace a record
     * @param {string} url 
     * @param {string} filePath 
     * @param {string} title 
     */
    save(url, filePath, title = "") {
        return this.ready.then(() => {
            return new Promise((resolve, reject) => {
                const sql = `INSERT OR REPLACE INTO history (url, file_path, title, created_at) VALUES (?, ?, ?, ?)`
                const now = Date.now()
                this.db.run(sql, [url, filePath, title, now], function(err) {
                    if (err) reject(err)
                    else resolve(this.lastID)
                })
            })
        })
    }

    close() {
        return this.ready.then(() => {
            return new Promise((resolve, reject) => {
                this.db.close((err) => {
                    if (err) reject(err)
                    else resolve()
                })
            })
        })
    }
}

export function createDatabase(options = {}) {
    return new Database(options)
}

export const database = createDatabase()
