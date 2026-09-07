/**
 * Auto-link Google/Meta ad accounts to brands (name match) and sync last-30-day campaigns.
 * Run: node scripts/bootstrap-ads.mjs
 */
import { readFileSync, existsSync, appendFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  createHash,
  createDecipheriv,
  createCipheriv,
  randomBytes,
} from "crypto";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { google } from "googleapis";

neonConfig.webSocketConstructor = ws;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const merged = {};
  for (const f of [".env", ".env.local"]) {
    const p = join(root, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 0) continue;
      let v = t.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      )
        v = v.slice(1, -1);
      merged[t.slice(0, eq).trim()] = v;
    }
  }
  return merged;
}

const env = loadEnv();
for (const [k, v] of Object.entries(env)) {
  if (v && !process.env[k]) process.env[k] = v;
}

if (!process.env.INTEGRATION_ENCRYPTION_KEY) {
  const key = randomBytes(32).toString("base64");
  process.env.INTEGRATION_ENCRYPTION_KEY = key;
  appendFileSync(
    join(root, ".env"),
    `\n# Token encryption (auto-generated for ads/Drive)\nINTEGRATION_ENCRYPTION_KEY=${key}\n`
  );
  console.log("Wrote INTEGRATION_ENCRYPTION_KEY to .env");
}

function getKey() {
  return createHash("sha256")
    .update(process.env.INTEGRATION_ENCRYPTION_KEY)
    .digest();
}

function decrypt(ciphertext) {
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8"
  );
}

function encrypt(plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreMatch(brandName, accountName) {
  const b = norm(brandName);
  const a = norm(accountName);
  if (!b || !a) return 0;
  if (b === a) return 100;
  if (a.includes(b) || b.includes(a)) return 80;
  const bw = new Set(b.split(" ").filter(Boolean));
  const aw = a.split(" ").filter(Boolean);
  let hit = 0;
  for (const w of aw) if (bw.has(w)) hit++;
  if (!aw.length) return 0;
  return Math.round((hit / Math.max(bw.size, aw.length)) * 60);
}

function pickBest(brandName, accounts) {
  let best = null;
  for (const acc of accounts) {
    const s = scoreMatch(brandName, acc.name || acc.id);
    if (!best || s > best.score) best = { ...acc, score: s };
  }
  return best && best.score >= 40 ? best : null;
}

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
});

async function getAgency(provider) {
  const { rows } = await pool.query(
    `SELECT credentials_encrypted, config FROM agency_credentials WHERE provider = $1 LIMIT 1`,
    [provider]
  );
  if (!rows[0]?.credentials_encrypted) return null;
  try {
    return {
      tokens: JSON.parse(decrypt(rows[0].credentials_encrypted)),
      config: rows[0].config || {},
    };
  } catch (e) {
    console.error(
      `Cannot decrypt ${provider} tokens (wrong INTEGRATION_ENCRYPTION_KEY?):`,
      e.message
    );
    return null;
  }
}

async function saveAgencyTokens(provider, tokens, config = {}) {
  await pool.query(
    `
    INSERT INTO agency_credentials (provider, credentials_encrypted, config)
    VALUES ($1, $2, $3::jsonb)
    ON CONFLICT (provider) DO UPDATE SET
      credentials_encrypted = EXCLUDED.credentials_encrypted,
      config = agency_credentials.config || EXCLUDED.config,
      updated_at = now()
  `,
    [provider, encrypt(JSON.stringify(tokens)), JSON.stringify(config)]
  );
}

async function googleAccessToken() {
  const row = await getAgency("google");
  if (!row?.tokens?.refresh_token) return null;
  const clientId =
    process.env.GOOGLE_ADS_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret =
    process.env.GOOGLE_ADS_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials(row.tokens);
  if (!row.tokens.expiry_date || row.tokens.expiry_date < Date.now() + 60_000) {
    const { credentials } = await oauth2.refreshAccessToken();
    const next = {
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token || row.tokens.refresh_token,
      expiry_date: credentials.expiry_date || Date.now() + 3600_000,
    };
    await saveAgencyTokens("google", next, row.config);
    return next.access_token;
  }
  return row.tokens.access_token;
}

function googleHeaders(accessToken) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    "Content-Type": "application/json",
  };
  const login = (
    process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ||
    process.env.GOOGLE_ADS_MCC_ID ||
    ""
  ).replace(/\D/g, "");
  if (login) headers["login-customer-id"] = login;
  return headers;
}

async function listGoogleCustomers(accessToken) {
  const res = await fetch(
    "https://googleads.googleapis.com/v17/customers:listAccessibleCustomers",
    { headers: googleHeaders(accessToken) }
  );
  if (!res.ok) throw new Error(`Google list customers: ${await res.text()}`);
  const data = await res.json();
  const accounts = [];
  for (const resource of data.resourceNames || []) {
    const customerId = resource.replace("customers/", "");
    let name = customerId;
    try {
      const detail = await fetch(
        `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:search`,
        {
          method: "POST",
          headers: googleHeaders(accessToken),
          body: JSON.stringify({
            query: "SELECT customer.descriptive_name FROM customer LIMIT 1",
          }),
        }
      );
      if (detail.ok) {
        const body = await detail.json();
        name =
          body.results?.[0]?.customer?.descriptiveName || customerId;
      }
    } catch {
      /* keep id */
    }
    accounts.push({ id: customerId, name });
  }
  return accounts;
}

async function listMetaAccounts(accessToken) {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id&limit=200&access_token=${accessToken}`
  );
  if (!res.ok) throw new Error(`Meta list accounts: ${await res.text()}`);
  const data = await res.json();
  return (data.data || []).map((a) => ({
    id: a.id || `act_${a.account_id}`,
    name: a.name || a.id,
  }));
}

async function metaAccessToken() {
  const row = await getAgency("meta");
  if (!row?.tokens?.access_token) return null;
  // refresh if we have long-lived flow stored; otherwise use as-is
  return row.tokens.access_token;
}

async function upsertLink(companyId, provider, config) {
  await pool.query(
    `
    INSERT INTO integrations (company_id, provider, is_connected, config)
    VALUES ($1, $2, true, $3::jsonb)
    ON CONFLICT (company_id, provider) DO UPDATE SET
      is_connected = true,
      config = EXCLUDED.config,
      updated_at = now()
  `,
    [companyId, provider, JSON.stringify(config)]
  );
}

async function syncGoogle(companyId, customerId, accessToken) {
  const query = `
    SELECT campaign.id, campaign.name, campaign.status,
      metrics.cost_micros, metrics.impressions, metrics.clicks,
      metrics.conversions, metrics.conversions_value
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS
  `;
  const res = await fetch(
    `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:searchStream`,
    {
      method: "POST",
      headers: googleHeaders(accessToken),
      body: JSON.stringify({ query }),
    }
  );
  if (!res.ok) throw new Error(await res.text());
  const chunks = await res.json();
  const byCampaign = new Map();
  for (const chunk of chunks) {
    for (const row of chunk.results || []) {
      const id = String(row.campaign.id);
      const cost = Number(row.metrics?.costMicros || 0) / 1e6;
      const prev = byCampaign.get(id) || {
        name: row.campaign.name,
        status: String(row.campaign.status || "UNKNOWN").toLowerCase(),
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        convValue: 0,
      };
      prev.spend += cost;
      prev.impressions += Number(row.metrics?.impressions || 0);
      prev.clicks += Number(row.metrics?.clicks || 0);
      prev.conversions += Number(row.metrics?.conversions || 0);
      prev.convValue += Number(row.metrics?.conversionsValue || 0);
      byCampaign.set(id, prev);
    }
  }

  let n = 0;
  for (const [externalId, c] of byCampaign) {
    const ctr = c.impressions ? (c.clicks / c.impressions) * 100 : 0;
    const cpc = c.clicks ? c.spend / c.clicks : 0;
    const roas = c.spend ? c.convValue / c.spend : 0;
    await pool.query(
      `
      INSERT INTO google_ads_campaigns (
        company_id, external_id, name, status, daily_budget, daily_spend,
        impressions, clicks, conversions, ctr, cpc, roas, last_synced_at
      ) VALUES ($1,$2,$3,$4,0,$5,$6,$7,$8,$9,$10,$11,now())
      ON CONFLICT (company_id, external_id) DO UPDATE SET
        name = EXCLUDED.name,
        status = EXCLUDED.status,
        daily_spend = EXCLUDED.daily_spend,
        impressions = EXCLUDED.impressions,
        clicks = EXCLUDED.clicks,
        conversions = EXCLUDED.conversions,
        ctr = EXCLUDED.ctr,
        cpc = EXCLUDED.cpc,
        roas = EXCLUDED.roas,
        last_synced_at = now(),
        updated_at = now()
    `,
      [
        companyId,
        externalId,
        c.name,
        c.status === "enabled" ? "active" : c.status,
        c.spend,
        c.impressions,
        c.clicks,
        c.conversions,
        ctr,
        cpc,
        roas,
      ]
    );
    n++;
  }
  await pool.query(
    `UPDATE integrations SET last_synced_at = now() WHERE company_id = $1 AND provider = 'google_ads'`,
    [companyId]
  );
  return n;
}

async function syncMeta(companyId, adAccountId, accessToken) {
  const act = adAccountId.startsWith("act_")
    ? adAccountId
    : `act_${adAccountId}`;
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${act}/campaigns?fields=id,name,status,insights.date_preset(last_30d){spend,impressions,clicks,actions,action_values,purchase_roas,ctr,cpc}&limit=200&access_token=${accessToken}`
  );
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  let n = 0;
  for (const camp of data.data || []) {
    const insight = camp.insights?.data?.[0] || {};
    const spend = Number(insight.spend || 0);
    const impressions = Number(insight.impressions || 0);
    const clicks = Number(insight.clicks || 0);
    const roas = Number(insight.purchase_roas?.[0]?.value || 0);
    const status = String(camp.status || "PAUSED").toLowerCase();
    await pool.query(
      `
      INSERT INTO meta_ads_campaigns (
        company_id, external_id, name, status, spend, impressions, clicks,
        conversions, ctr, cpc, roas, last_synced_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9,$10,now())
      ON CONFLICT (company_id, external_id) DO UPDATE SET
        name = EXCLUDED.name,
        status = EXCLUDED.status,
        spend = EXCLUDED.spend,
        impressions = EXCLUDED.impressions,
        clicks = EXCLUDED.clicks,
        ctr = EXCLUDED.ctr,
        cpc = EXCLUDED.cpc,
        roas = EXCLUDED.roas,
        last_synced_at = now(),
        updated_at = now()
    `,
      [
        companyId,
        camp.id,
        camp.name,
        status === "active" ? "active" : status,
        spend,
        impressions,
        clicks,
        Number(insight.ctr || 0),
        Number(insight.cpc || 0),
        roas,
      ]
    );
    n++;
  }
  await pool.query(
    `UPDATE integrations SET last_synced_at = now() WHERE company_id = $1 AND provider = 'meta_ads'`,
    [companyId]
  );
  return n;
}

// ── Clean duplicate India brands ──────────────────────────────────────────
const KEEP_INDIA = "fe78bc21-63fd-4e08-87fe-24f2ef91e930";
const MERGE_INDIA = [
  "f66be360-f97e-4fc7-b47c-d7c1ac959eb9",
  "97ec7ea5-23fd-415b-828d-8f2f836263cb",
];

for (const fromId of MERGE_INDIA) {
  const exists = await pool.query(`SELECT id FROM companies WHERE id = $1`, [
    fromId,
  ]);
  if (!exists.rows[0]) continue;
  await pool.query(
    `
    INSERT INTO company_members (company_id, user_id, role)
    SELECT $1, user_id, role FROM company_members WHERE company_id = $2
    ON CONFLICT DO NOTHING
  `,
    [KEEP_INDIA, fromId]
  );
  for (const table of [
    "leads",
    "tasks",
    "google_ads_campaigns",
    "meta_ads_campaigns",
    "company_metrics",
    "ai_insights",
    "notifications",
  ]) {
    try {
      await pool.query(
        `UPDATE ${table} SET company_id = $1 WHERE company_id = $2`,
        [KEEP_INDIA, fromId]
      );
    } catch {
      /* table may not allow or FK */
    }
  }
  await pool.query(`DELETE FROM integrations WHERE company_id = $1`, [fromId]);
  await pool.query(`DELETE FROM company_members WHERE company_id = $1`, [
    fromId,
  ]);
  await pool.query(`DELETE FROM companies WHERE id = $1`, [fromId]);
  console.log(`Merged duplicate ${fromId} → Vande Wellness India`);
}

await pool.query(
  `UPDATE companies SET name = 'Vande Wellness India', slug = 'vande-wellness-india', is_active = true WHERE id = $1`,
  [KEEP_INDIA]
);

const companies = (
  await pool.query(
    `SELECT id, name, slug FROM companies WHERE is_active = true ORDER BY name`
  )
).rows;
console.log("\nActive brands:");
for (const c of companies) console.log(`  - ${c.name} (${c.slug})`);

const googleTok = await googleAccessToken();
const metaTok = await metaAccessToken();

if (!googleTok && !metaTok) {
  console.error(`
BLOCKED: agency_credentials has no Google or Meta OAuth tokens.
App keys in .env are present, but nobody has completed Settings → Connect Google / Connect Meta yet.
I cannot mint those tokens without a logged-in Google/Meta consent screen.
Linked Looker-only rows (no customerId) will stay unusable for native sync.
`);
  await pool.end();
  process.exit(2);
}

let googleAccounts = [];
let metaAccounts = [];
if (googleTok) {
  googleAccounts = await listGoogleCustomers(googleTok);
  console.log(`\nGoogle accounts (${googleAccounts.length}):`);
  for (const a of googleAccounts) console.log(`  - ${a.name} [${a.id}]`);
}
if (metaTok) {
  metaAccounts = await listMetaAccounts(metaTok);
  console.log(`\nMeta accounts (${metaAccounts.length}):`);
  for (const a of metaAccounts) console.log(`  - ${a.name} [${a.id}]`);
}

const report = [];
for (const company of companies) {
  const row = { brand: company.name, google: null, meta: null };
  if (googleTok) {
    const match = pickBest(company.name, googleAccounts);
    if (match) {
      await upsertLink(company.id, "google_ads", {
        customerId: match.id,
        customerName: match.name,
      });
      try {
        const n = await syncGoogle(company.id, match.id, googleTok);
        row.google = `${match.name} (${n} campaigns)`;
      } catch (e) {
        row.google = `linked ${match.name} but sync failed: ${e.message}`;
      }
    } else {
      row.google = "no name match";
    }
  }
  if (metaTok) {
    const match = pickBest(company.name, metaAccounts);
    if (match) {
      await upsertLink(company.id, "meta_ads", {
        adAccountId: match.id,
        adAccountName: match.name,
      });
      try {
        const n = await syncMeta(company.id, match.id, metaTok);
        row.meta = `${match.name} (${n} campaigns)`;
      } catch (e) {
        row.meta = `linked ${match.name} but sync failed: ${e.message}`;
      }
    } else {
      row.meta = "no name match";
    }
  }
  report.push(row);
}

console.log("\nLink + sync report:");
console.table(report);
await pool.end();
