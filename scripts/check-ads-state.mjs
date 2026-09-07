import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadDbUrl() {
  for (const f of [".env", ".env.local"]) {
    const p = join(root, f);
    if (!existsSync(p)) continue;
    const env = readFileSync(p, "utf8");
    const m =
      env.match(/DATABASE_URL_UNPOOLED="([^"]+)"/) ||
      env.match(/DATABASE_URL="([^"]+)"/) ||
      env.match(/DATABASE_URL_UNPOOLED=([^\n\r]+)/) ||
      env.match(/DATABASE_URL=([^\n\r]+)/);
    if (m) return m[1].trim();
  }
  throw new Error("No DATABASE_URL");
}

const pool = new Pool({ connectionString: loadDbUrl() });
const companies = await pool.query(
  `SELECT id, name, slug, is_active FROM companies WHERE is_active = true ORDER BY name`
);
const agency = await pool.query(
  `SELECT provider, updated_at,
    (credentials_encrypted IS NOT NULL AND length(credentials_encrypted) > 0) AS has_creds,
    config
   FROM agency_credentials`
);
const integ = await pool.query(`
  SELECT c.name, c.slug, i.provider, i.is_connected, i.config, i.last_synced_at
  FROM integrations i
  JOIN companies c ON c.id = i.company_id
  WHERE i.provider IN ('google_ads', 'meta_ads')
  ORDER BY c.name, i.provider
`);
const gCount = await pool.query(
  `SELECT company_id, COUNT(*)::int AS n FROM google_ads_campaigns GROUP BY company_id`
);
const mCount = await pool.query(
  `SELECT company_id, COUNT(*)::int AS n FROM meta_ads_campaigns GROUP BY company_id`
);

console.log(
  JSON.stringify(
    {
      companies: companies.rows,
      agency: agency.rows,
      integrations: integ.rows,
      googleCampaignCounts: gCount.rows,
      metaCampaignCounts: mCount.rows,
    },
    null,
    2
  )
);
await pool.end();
