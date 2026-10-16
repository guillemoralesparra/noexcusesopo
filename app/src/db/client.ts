import { mkdirSync } from "node:fs";
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/** Tipus comú als dos controladors (postgres-js i PGlite) */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * DATABASE_URL=postgres://...  -> Postgres gestionat (producció)
 * sense DATABASE_URL           -> PGlite (Postgres embegut) a .data/pglite (desenvolupament)
 */
export async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url && url.startsWith("postgres")) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const postgres = (await import("postgres")).default;
    return drizzle(postgres(url, { prepare: false }), { schema }) as unknown as Db;
  }
  const { drizzle } = await import("drizzle-orm/pglite");
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  mkdirSync(path.dirname(dir), { recursive: true });
  return drizzle(new PGlite(dir), { schema }) as unknown as Db;
}
