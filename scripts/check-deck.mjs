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
const local = readFileSync(envFile, "utf8");
const match =
  local.match(/DATABASE_URL_UNPOOLED="([^"]+)"/) ??
  local.match(/DATABASE_URL="([^"]+)"/);

const pool = new Pool({ connectionString: match[1] });
const boards = await pool.query(
  "SELECT b.title, c.name AS company, (SELECT COUNT(*) FROM deck_stacks s WHERE s.board_id = b.id) AS stacks, (SELECT COUNT(*) FROM tasks t WHERE t.board_id = b.id) AS cards FROM deck_boards b JOIN companies c ON c.id = b.company_id"
);
console.table(boards.rows);
const orphans = await pool.query(
  "SELECT COUNT(*)::int AS n FROM tasks WHERE stack_id IS NULL"
);
console.log("Tasks without a stack:", orphans.rows[0].n);
await pool.end();
