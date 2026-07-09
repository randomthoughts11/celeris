import { readFileSync, existsSync } from "fs";
import { neon } from "@neondatabase/serverless";

const META_EMBED =
  "https://datastudio.google.com/embed/reporting/5a6fd3c4-1e0f-4933-a21f-7ae00f230306/page/p_2ekadtbmld";
const GOOGLE_EMBED =
  "https://datastudio.google.com/embed/reporting/37c69b65-b93e-495e-915a-7f90ad42a555/page/p_wonj6c0dld";

const envFile = existsSync(".env.local") ? ".env.local" : ".env";
const env = readFileSync(envFile, "utf8");
const match =
  env.match(/DATABASE_URL_UNPOOLED="([^"]+)"/) ??
  env.match(/DATABASE_URL="([^"]+)"/) ??
  env.match(/DATABASE_URL_UNPOOLED=([^\n\r]+)/) ??
  env.match(/DATABASE_URL=([^\n\r]+)/);
if (!match) throw new Error("DATABASE_URL not found");

const sql = neon(match[1].trim());

const companies = await sql`
  SELECT id, name, slug FROM companies WHERE is_active = true ORDER BY created_at
`;
if (companies.length === 0) {
  console.log("No active companies found.");
  process.exit(0);
}

for (const company of companies) {
  for (const [provider, embedUrl] of [
    ["meta_ads", META_EMBED],
    ["google_ads", GOOGLE_EMBED],
  ]) {
    const existing = await sql`
      SELECT config FROM integrations
      WHERE company_id = ${company.id} AND provider = ${provider}
      LIMIT 1
    `;
    const config = {
      ...((existing[0]?.config ?? {}) ),
      lookerEmbedUrl: embedUrl,
    };

    await sql`
      INSERT INTO integrations (company_id, provider, is_connected, config)
      VALUES (${company.id}, ${provider}, true, ${JSON.stringify(config)})
      ON CONFLICT (company_id, provider) DO UPDATE SET
        config = integrations.config || ${JSON.stringify({ lookerEmbedUrl: embedUrl })},
        is_connected = true,
        updated_at = now()
    `;
  }
  console.log(`Updated ${company.name} (${company.slug})`);
}

console.log(`Done. Set embed URLs on ${companies.length} company/companies.`);
