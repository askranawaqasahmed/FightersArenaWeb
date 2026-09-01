import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, sqlClient } from "./client";

async function runMigrations() {
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("Database migrations applied.");
}

runMigrations()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sqlClient.end());
