import { readFileSync } from "fs";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
const env = readFileSync(".env.local", "utf8");
const m =
  env.match(/DATABASE_URL_UNPOOLED="([^"]+)"/) ||
  env.match(/DATABASE_URL="([^"]+)"/);
const pool = new Pool({ connectionString: m[1] });
const r = await pool.query(`
  SELECT
    COUNT(*) FILTER (WHERE created_by IS NOT NULL)::int AS with_creator,
    COUNT(*) FILTER (WHERE created_by IS NULL)::int AS missing_creator,
    COUNT(*)::int AS total
  FROM tasks
`);
console.table(r.rows);
await pool.end();
