import { readFileSync } from "fs";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
const env = readFileSync(".env.local", "utf8");
const m =
  env.match(/DATABASE_URL_UNPOOLED="([^"]+)"/) ||
  env.match(/DATABASE_URL="([^"]+)"/);
const pool = new Pool({ connectionString: m[1] });

const companies = await pool.query(`
  SELECT id, name, slug, is_active, created_at
  FROM companies
  ORDER BY name, created_at
`);
console.log("ALL COMPANIES:");
console.table(companies.rows);

const counts = await pool.query(`
  SELECT
    (SELECT COUNT(*)::int FROM tasks WHERE company_id = c.id) AS tasks,
    (SELECT COUNT(*)::int FROM leads WHERE company_id = c.id) AS leads,
    (SELECT COUNT(*)::int FROM deck_boards WHERE company_id = c.id) AS boards,
    (SELECT COUNT(*)::int FROM company_members WHERE company_id = c.id) AS members,
    c.id, c.name, c.slug
  FROM companies c
  ORDER BY c.name
`);
console.log("USAGE:");
console.table(counts.rows);

await pool.end();
