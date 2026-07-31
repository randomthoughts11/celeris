/**
 * Clean companies down to the canonical agency list.
 * Run: node scripts/cleanup-companies.mjs
 */
import { readFileSync } from "fs";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
const env = readFileSync(".env.local", "utf8");
const m =
  env.match(/DATABASE_URL_UNPOOLED="([^"]+)"/) ||
  env.match(/DATABASE_URL="([^"]+)"/);
const pool = new Pool({ connectionString: m[1] });

const IDS = {
  vandeUs: "a7ccc63e-908d-4d97-93cd-54a5fb327100", // Vande Wellness (main)
  vandeIndia: "fe78bc21-63fd-4e08-87fe-24f2ef91e930", // vande wellness dup
  vandecart: "21027bd5-4f93-401f-9ef6-95d5df54e24c", // Vande Cart (most tasks)
  cartDup1: "667e7527-c555-45e5-8f7c-610ecf477b0f", // Vande cart
  cartDup2: "7bc55533-47f8-445a-8a48-79d1b026242f", // Vende Cart
  celerisCreative: "bd310c0e-a6bc-46b5-919c-3cb46138ea4b", // celeriscreative
  celerisDup: "631a128d-3025-477d-a897-766cd9b2bc34", // Celeris
  indus: "f514154e-c3b5-4264-ac74-c7b6105879ef", // Indust Technocrafts
  ayurdoc: "1605fcec-c022-4a41-8470-611d56dda0c8", // ayurdoc
  ayurDup: "62df1d31-0af8-4ee0-9d38-d1b95d13dce0", // ayur doc
};

const DEMO_SLUGS = [
  "apex-digital",
  "bloom-wellness",
  "craft-kitchen",
  "nova-finance",
  "urban-realty",
];

/** Tables where we can safely re-point company_id (no unique on company alone). */
const MOVE_TABLES = [
  "tasks",
  "leads",
  "deck_boards",
  "drive_files",
  "google_ads_campaigns",
  "meta_ads_campaigns",
  "social_posts",
  "company_metrics",
  "performance_snapshots",
  "ai_insights",
  "notifications",
  "audit_logs",
  "vault_credentials",
  "task_attachments",
  "call_logs",
  "privyr_sync_state",
];

async function moveCompanyData(fromId, toId) {
  // Members: skip if already a member of target
  await pool.query(
    `
    INSERT INTO company_members (company_id, user_id, role)
    SELECT $1, user_id, role FROM company_members WHERE company_id = $2
    ON CONFLICT (company_id, user_id) DO NOTHING
  `,
    [toId, fromId]
  );
  await pool.query(`DELETE FROM company_members WHERE company_id = $1`, [
    fromId,
  ]);

  // Integrations: skip provider conflicts
  await pool.query(
    `
    INSERT INTO integrations (company_id, provider, is_connected, credentials_encrypted, config, last_synced_at)
    SELECT $1, provider, is_connected, credentials_encrypted, config, last_synced_at
    FROM integrations WHERE company_id = $2
    ON CONFLICT (company_id, provider) DO NOTHING
  `,
    [toId, fromId]
  );
  await pool.query(`DELETE FROM integrations WHERE company_id = $1`, [fromId]);

  for (const table of MOVE_TABLES) {
    try {
      await pool.query(
        `UPDATE ${table} SET company_id = $1 WHERE company_id = $2`,
        [toId, fromId]
      );
    } catch (e) {
      // Table may not exist or have constraints — try delete orphans then continue
      console.warn(`  skip/warn ${table}:`, e.message.split("\n")[0]);
      try {
        await pool.query(`DELETE FROM ${table} WHERE company_id = $1`, [
          fromId,
        ]);
      } catch {
        /* ignore */
      }
    }
  }

  await pool.query(`DELETE FROM companies WHERE id = $1`, [fromId]);
  console.log(`Merged ${fromId} → ${toId}`);
}

async function rename(id, name, slug) {
  await pool.query(
    `UPDATE companies SET name = $1, slug = $2, is_active = true, updated_at = now() WHERE id = $3`,
    [name, slug, id]
  );
  console.log(`Renamed ${id} → ${name} (${slug})`);
}

async function ensureCompany(name, slug) {
  const existing = await pool.query(
    `SELECT id FROM companies WHERE slug = $1 LIMIT 1`,
    [slug]
  );
  if (existing.rows[0]) {
    await rename(existing.rows[0].id, name, slug);
    return existing.rows[0].id;
  }
  const inserted = await pool.query(
    `
    INSERT INTO companies (name, slug, is_active)
    VALUES ($1, $2, true)
    RETURNING id
  `,
    [name, slug]
  );
  console.log(`Created ${name} (${slug})`);
  return inserted.rows[0].id;
}

console.log("Cleaning companies…\n");

// 1) Merge cart duplicates into Vandecart
await moveCompanyData(IDS.cartDup1, IDS.vandecart);
await moveCompanyData(IDS.cartDup2, IDS.vandecart);
await rename(IDS.vandecart, "Vandecart", "vandecart");

// 2) Vande Wellness US / India
await rename(IDS.vandeUs, "Vande Wellness US", "vande-wellness-us");
await rename(IDS.vandeIndia, "Vande Wellness India", "vande-wellness-india");

// 3) Celeris Creative — merge bare Celeris into it
await moveCompanyData(IDS.celerisDup, IDS.celerisCreative);
await rename(IDS.celerisCreative, "Celeris Creative", "celeris-creative");

// 4) Indus Technocrafts (fix typo)
await rename(IDS.indus, "Indus Technocrafts", "indus-technocrafts");

// 5) Ayurdoc — merge spacing variant
await moveCompanyData(IDS.ayurDup, IDS.ayurdoc);
await rename(IDS.ayurdoc, "Ayurdoc", "ayurdoc");

// 6) THC
await ensureCompany("THC", "thc");

// 7) Delete demo seed companies
const demo = await pool.query(
  `DELETE FROM companies WHERE slug = ANY($1::text[]) RETURNING name, slug`,
  [DEMO_SLUGS]
);
console.log(
  "Deleted demos:",
  demo.rows.map((r) => r.name).join(", ") || "(none)"
);

// Final list
const final = await pool.query(
  `SELECT name, slug, is_active FROM companies ORDER BY name`
);
console.log("\nFINAL COMPANIES:");
console.table(final.rows);

await pool.end();
