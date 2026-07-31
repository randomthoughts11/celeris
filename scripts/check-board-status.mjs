import { readFileSync } from "fs";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
const env = readFileSync(".env.local", "utf8");
const m =
  env.match(/DATABASE_URL_UNPOOLED="([^"]+)"/) ||
  env.match(/DATABASE_URL="([^"]+)"/);
const pool = new Pool({ connectionString: m[1] });

const stacks = await pool.query(`
  SELECT s.title, s.status_map::text, s.position, b.title as board
  FROM deck_stacks s JOIN deck_boards b ON b.id = s.board_id
  ORDER BY b.title, s.position LIMIT 25
`);
console.log("STACKS:");
console.table(stacks.rows);

const tasks = await pool.query(`
  SELECT t.title, t.status::text, s.title AS stack, t.completed_at IS NOT NULL AS has_completed
  FROM tasks t
  LEFT JOIN deck_stacks s ON s.id = t.stack_id
  ORDER BY t.updated_at DESC LIMIT 15
`);
console.log("TASKS:");
console.table(tasks.rows);

const counts = await pool.query(`
  SELECT status::text, COUNT(*)::int AS n FROM tasks GROUP BY status ORDER BY n DESC
`);
console.log("BY STATUS:");
console.table(counts.rows);

const mismatch = await pool.query(`
  SELECT t.title, t.status::text AS task_status, s.status_map::text AS stack_status, s.title AS stack
  FROM tasks t
  JOIN deck_stacks s ON s.id = t.stack_id
  WHERE t.status::text <> s.status_map::text
`);
console.log("MISMATCHES (task status != stack status_map):", mismatch.rows.length);
console.table(mismatch.rows);

await pool.end();
