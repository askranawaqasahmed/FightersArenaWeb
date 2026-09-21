/**
 * Drops and recreates the public schema. LOCAL DEVELOPMENT ONLY.
 * Refuses to run against a non-localhost database or in production.
 *
 *   npm run db:reset -- --yes
 */
import { sqlClient } from "./client";

const confirmed = process.argv.includes("--yes");

function assertLocal() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("db:reset is disabled in production.");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const host = new URL(url).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(`Refusing to reset a non-local database (host: ${host}).`);
  }
  if (!confirmed) {
    throw new Error("This deletes every row. Re-run with `-- --yes` to confirm.");
  }
}

async function reset() {
  assertLocal();
  await sqlClient.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;");
  console.log("Database reset. Now run: npm run db:migrate && npm run db:seed && npm run db:seed:content");
}

reset()
  .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(() => sqlClient.end());
