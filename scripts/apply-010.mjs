import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const __dirname = dirname(fileURLToPath(import.meta.url));
const envFile = [".env.local", ".env"]
  .map((f) => join(__dirname, "..", f))
  .find((f) => {
    try {
      readFileSync(f);
      return true;
    } catch {
      return false;
    }
  });
if (!envFile) throw new Error("No .env.local or .env");
const local = readFileSync(envFile, "utf8");
const match =
  local.match(/DATABASE_URL_UNPOOLED="([^"]+)"/) ??
  local.match(/DATABASE_URL="([^"]+)"/);
if (!match) throw new Error("No DATABASE_URL");

const pool = new Pool({ connectionString: match[1] });
const sql = readFileSync(
  join(__dirname, "..", "neon/migrations/010_task_attachments.sql"),
  "utf8"
);
await pool.query(sql);
await pool.end();
console.log("Migration 010 applied.");
