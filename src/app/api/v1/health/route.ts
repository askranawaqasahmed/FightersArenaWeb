import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { apiData, apiProblem } from "@/lib/api";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return apiData({ status: "ok", database: "connected", version: "1.0.0", time: new Date().toISOString() });
  } catch {
    return apiProblem(503, "DATABASE_UNAVAILABLE", "Service unavailable", "The database health check failed.");
  }
}
