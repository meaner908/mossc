import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

import type BetterSqlite3 from "better-sqlite3";

import { resolveStateDir } from "@/lib/openclaw/paths";

const require = createRequire(import.meta.url);

const DB_DIRNAME = "openclaw-studio";
const DB_FILENAME = "users.sqlite";

const resolveDbPath = () =>
  path.join(resolveStateDir(), DB_DIRNAME, DB_FILENAME);

type GlobalDbState = typeof globalThis & {
  __mossUserDb?: BetterSqlite3.Database;
};

const ensureSchema = (db: BetterSqlite3.Database): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id        TEXT PRIMARY KEY,
      username  TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role      TEXT NOT NULL DEFAULT 'user',
      created_at INTEGER NOT NULL
    );
  `);
};

export const getUserDb = (): BetterSqlite3.Database => {
  const g = globalThis as GlobalDbState;
  if (!g.__mossUserDb) {
    const dbPath = resolveDbPath();
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const Database = require("better-sqlite3") as typeof BetterSqlite3;
    g.__mossUserDb = new Database(dbPath);
    ensureSchema(g.__mossUserDb);
  }
  return g.__mossUserDb;
};
