import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadDatabaseUrl() {
  const local = readFileSync(join(root, ".env.local"), "utf8");
  const match =
    local.match(/DATABASE_URL_UNPOOLED="([^"]+)"/) ??
    local.match(/DATABASE_URL="([^"]+)"/);
  if (!match) throw new Error("DATABASE_URL not found in .env.local");
  return match[1];
}

const files = [
  "neon/migrations/001_initial_schema.sql",
  "neon/migrations/002_google_drive.sql",
  "neon/migrations/003_clerk.sql",
  "neon/migrations/004_production.sql",
  "neon/migrations/005_privyr_ringcentral_sync.sql",
];

const pool = new Pool({ connectionString: loadDatabaseUrl() });

try {
  for (const file of files) {
    const sql = readFileSync(join(root, file), "utf8");
    process.stdout.write(`Running ${file}... `);
    await pool.query(sql);
    console.log("ok");
  }
  console.log("\nAll migrations applied.");
} finally {
  await pool.end();
}
