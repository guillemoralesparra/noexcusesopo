import { createDb } from "../src/db/client";

export async function migrateDb() {
  const db = await createDb();
  if (process.env.DATABASE_URL?.startsWith("postgres")) {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(db as never, { migrationsFolder: "drizzle" });
  } else {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as never, { migrationsFolder: "drizzle" });
  }
  return db;
}

if (process.argv[1]?.endsWith("migrate.ts")) {
  migrateDb().then(() => {
    console.log("Migracions aplicades");
    process.exit(0);
  });
}
