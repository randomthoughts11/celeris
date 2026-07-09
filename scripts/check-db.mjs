import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";

const local = readFileSync(".env.local", "utf8");
const match = local.match(/DATABASE_URL="([^"]+)"/);
if (!match) {
  console.log("NO_URL");
  process.exit(1);
}

const sql = neon(match[1]);
try {
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'clerk_user_id'
  `;
  console.log("clerk_user_id:", cols.length ? "exists" : "MISSING");

  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('profiles', 'user_roles', 'companies')
  `;
  console.log("tables:", tables.map((t) => t.table_name).join(", ") || "none");
} catch (e) {
  console.log("DB_ERROR:", e.message);
  process.exit(1);
}
