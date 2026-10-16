import "server-only";
import { createDb, type Db } from "./client";

// Una única connexió per procés (també entre recàrregues en desenvolupament).
const globalForDb = globalThis as unknown as { db?: Promise<Db> };

export function getDb(): Promise<Db> {
  globalForDb.db ??= createDb();
  return globalForDb.db;
}
