import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = [".env.local", ".env"]
  .map((f) => { try { return readFileSync(join(root, f), "utf8"); } catch { return ""; } })
  .join("\n");
const url = (env.match(/DATABASE_URL_UNPOOLED=["']?([^"'\r\n]+)/) ?? env.match(/DATABASE_URL=["']?([^"'\r\n]+)/))?.[1];
if (!url) throw new Error("No DATABASE_URL");
console.log("DB host:", new URL(url).host);

const pool = new Pool({ connectionString: url });
const { rows } = await pool.query(
  "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'"
);
const cols = new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));
const tables = new Set(rows.map((r) => r.table_name));

const dir = join(root, "neon/migrations");
const apply = process.argv.includes("--apply");
for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  const sql = readFileSync(join(dir, file), "utf8");
  const missing = [];
  for (const m of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?"?(\w+)"?/gi))
    if (!tables.has(m[1])) missing.push(`table ${m[1]}`);
  for (const m of sql.matchAll(/ALTER TABLE (?:IF EXISTS )?(?:ONLY )?(?:public\.)?"?(\w+)"?([\s\S]*?);/gi))
    for (const c of m[2].matchAll(/ADD COLUMN (?:IF NOT EXISTS )?"?(\w+)"?/gi))
      if (!cols.has(`${m[1]}.${c[1]}`)) missing.push(`column ${m[1]}.${c[1]}`);
  console.log(`${missing.length ? "MISSING" : "ok     "} ${file}${missing.length ? " -> " + missing.join(", ") : ""}`);
  if (missing.length && apply) {
    await pool.query(sql);
    console.log(`        applied ${file}`);
  }
}
await pool.end();
