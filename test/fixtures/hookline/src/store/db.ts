import { readdirSync, readFileSync } from "node:fs";
import Database from "better-sqlite3";

export type Db = Database.Database;

const MIGRATIONS = new URL("./migrations/", import.meta.url);

export function openDb(file: string): Db {
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  const applied = db.pragma("user_version", { simple: true }) as number;
  const files = readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql")).sort();
  for (const [index, name] of files.entries()) {
    if (index < applied) continue;
    db.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
    db.pragma(`user_version = ${index + 1}`);
  }
  return db;
}

export function withTx<T>(db: Db, fn: () => T): T {
  return db.transaction(fn)();
}
