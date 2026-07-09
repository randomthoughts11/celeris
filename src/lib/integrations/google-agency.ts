import { google } from "googleapis";
import { encrypt, decrypt } from "@/lib/crypto";
import {
  getAgencyTokens,
  upsertAgencyCredential,
  isAgencyConnected,
} from "@/lib/db/agency-credentials";
import type { AgencyAdAccount } from "@/types";
import { getGoogleOAuthEnv, isGoogleAdsApiConfigured } from "@/lib/config/google-oauth";

export const GOOGLE_AGENCY_SCOPES = [
  "https://www.googleapis.com/auth/adwords",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
];

export interface GoogleAgencyTokens extends Record<string, unknown> {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

export function isGoogleAgencyConfigured(): boolean {
  return isGoogleAdsApiConfigured();
}

function getOAuthClient() {
  const { clientId, clientSecret, appUrl } = getGoogleOAuthEnv();
  if (!clientId || !clientSecret || !appUrl) {
    throw new Error("Google OAuth credentials not configured");
  }
  const redirectUri = `${appUrl}/api/integrations/google/callback`;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getGoogleAgencyAuthUrl(): string {
  const oauth2 = getOAuthClient();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_AGENCY_SCOPES,
    state: Buffer.from(JSON.stringify({ provider: "google" })).toString("base64url"),
  });
}

export async function exchangeGoogleAgencyCode(code: string): Promise<void> {
  const oauth2 = getOAuthClient();
  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("No refresh token. Revoke app access in Google Account and retry.");
  }
  oauth2.setCredentials(tokens);
  const oauth2api = google.oauth2({ version: "v2", auth: oauth2 });
  const { data } = await oauth2api.userinfo.get();

  await upsertAgencyCredential({
    provider: "google",
    credentials: {
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date ?? Date.now() + 3600_000,
    },
    config: { email: data.email },
  });
}

export async function getGoogleAccessToken(): Promise<string> {
  const tokens = await getAgencyTokens<GoogleAgencyTokens>("google");
  if (!tokens?.refresh_token) {
    throw new Error("Google agency account not connected");
  }

  const oauth2 = getOAuthClient();
  oauth2.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  });

  if (!tokens.expiry_date || tokens.expiry_date < Date.now() + 60_000) {
    const { credentials } = await oauth2.refreshAccessToken();
    await upsertAgencyCredential({
      provider: "google",
      credentials: {
        access_token: credentials.access_token!,
        refresh_token: credentials.refresh_token ?? tokens.refresh_token,
        expiry_date: credentials.expiry_date ?? Date.now() + 3600_000,
      },
    });
    return credentials.access_token!;
  }

  return tokens.access_token;
}

export async function listGoogleAdsCustomers(): Promise<AgencyAdAccount[]> {
  if (!(await isAgencyConnected("google"))) return [];

  const accessToken = await getGoogleAccessToken();
  const developerToken = getGoogleOAuthEnv().developerToken!;

  const res = await fetch(
    "https://googleads.googleapis.com/v17/customers:listAccessibleCustomers",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": developerToken,
      },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Ads API error: ${err}`);
  }

  const data = (await res.json()) as { resourceNames?: string[] };
  const accounts: AgencyAdAccount[] = [];

  for (const resource of data.resourceNames ?? []) {
    const customerId = resource.replace("customers/", "");
    let name = customerId;
    try {
      const detailRes = await fetch(
        `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:search`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "developer-token": developerToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: "SELECT customer.descriptive_name, customer.currency_code FROM customer LIMIT 1",
          }),
        }
      );
      if (detailRes.ok) {
        const detail = (await detailRes.json()) as {
          results?: Array<{ customer?: { descriptiveName?: string; currencyCode?: string } }>;
        };
        name = detail.results?.[0]?.customer?.descriptiveName ?? customerId;
        accounts.push({
          id: customerId,
          name,
          currency: detail.results?.[0]?.customer?.currencyCode,
        });
        continue;
      }
    } catch {
      // use customerId as name
    }
    accounts.push({ id: customerId, name });
  }

  return accounts;
}

export async function syncGoogleAdsCampaigns(companyId: string, customerId: string): Promise<number> {
  const accessToken = await getGoogleAccessToken();
  const developerToken = getGoogleOAuthEnv().developerToken!;

  const res = await fetch(
    `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:search`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": developerToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `SELECT campaign.id, campaign.name, campaign.status,
          campaign_budget.amount_micros, metrics.cost_micros, metrics.clicks,
          metrics.impressions, metrics.ctr, metrics.average_cpc, metrics.conversions,
          metrics.cost_per_conversion, metrics.conversions_value
          FROM campaign WHERE campaign.status != 'REMOVED'`,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Google Ads sync failed: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    results?: Array<{
      campaign?: { id?: string; name?: string; status?: string };
      campaignBudget?: { amountMicros?: string };
      metrics?: Record<string, string>;
    }>;
  };

  const { getSql } = await import("@/lib/db/client");
  const sql = getSql();
  let count = 0;

  const statusMap: Record<string, string> = {
    ENABLED: "active",
    PAUSED: "paused",
    REMOVED: "ended",
  };

  for (const row of data.results ?? []) {
    const c = row.campaign;
    if (!c?.id) continue;
    const m = row.metrics ?? {};
    const budget = Number(row.campaignBudget?.amountMicros ?? 0) / 1_000_000;
    const spend = Number(m.costMicros ?? 0) / 1_000_000;
    const convValue = Number(m.conversionsValue ?? 0);
    const roas = spend > 0 ? convValue / spend : 0;

    await sql`
      INSERT INTO google_ads_campaigns (
        company_id, external_id, name, status, budget, daily_spend,
        remaining_budget, clicks, impressions, ctr, cpc, conversions,
        cost_per_conversion, roas, synced_at
      ) VALUES (
        ${companyId}, ${c.id}, ${c.name ?? "Campaign"},
        ${statusMap[c.status ?? "ENABLED"] ?? "active"},
        ${budget}, ${spend}, ${Math.max(0, budget - spend)},
        ${Number(m.clicks ?? 0)}, ${Number(m.impressions ?? 0)},
        ${Number(m.ctr ?? 0)}, ${Number(m.averageCpc ?? 0) / 1_000_000},
        ${Number(m.conversions ?? 0)}, ${Number(m.costPerConversion ?? 0) / 1_000_000},
        ${roas}, now()
      )
      ON CONFLICT (company_id, external_id) DO UPDATE SET
        name = EXCLUDED.name, status = EXCLUDED.status,
        budget = EXCLUDED.budget, daily_spend = EXCLUDED.daily_spend,
        clicks = EXCLUDED.clicks, impressions = EXCLUDED.impressions,
        ctr = EXCLUDED.ctr, cpc = EXCLUDED.cpc, conversions = EXCLUDED.conversions,
        roas = EXCLUDED.roas, synced_at = now()
    `;
    count++;
  }

  const totalSpend = (data.results ?? []).reduce(
    (sum, r) => sum + Number(r.metrics?.costMicros ?? 0) / 1_000_000,
    0
  );
  await sql`
    UPDATE company_metrics SET
      monthly_ad_spend = ${totalSpend},
      ad_spend = ${totalSpend},
      active_campaigns = ${count},
      updated_at = now()
    WHERE company_id = ${companyId}
  `;

  return count;
}

export async function provisionDriveFoldersForCompany(
  companyId: string,
  companyName: string
): Promise<void> {
  const tokens = await getAgencyTokens<GoogleAgencyTokens>("google");
  if (!tokens?.refresh_token) return;

  const oauth2 = getOAuthClient();
  oauth2.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  });

  const drive = google.drive({ version: "v3", auth: oauth2 });

  async function findOrCreate(name: string, parentId: string): Promise<string> {
    const q =
      parentId === "root"
        ? `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`
        : `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
    const existing = await drive.files.list({ q, fields: "files(id)", spaces: "drive" });
    if (existing.data.files?.[0]?.id) return existing.data.files[0].id;
    const created = await drive.files.create({
      requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: parentId === "root" ? undefined : [parentId] },
      fields: "id",
    });
    return created.data.id!;
  }

  const rootId = await findOrCreate("Agency OS", "root");
  const companyFolderId = await findOrCreate(companyName, rootId);
  const postsFolderId = await findOrCreate("Posts", companyFolderId);
  const assetsFolderId = await findOrCreate("Assets", companyFolderId);
  const reportsFolderId = await findOrCreate("Reports", companyFolderId);

  const { upsertIntegration } = await import("@/lib/db/integrations");
  await upsertIntegration({
    companyId,
    provider: "google_drive",
    isConnected: true,
    config: {
      rootFolderId: companyFolderId,
      postsFolderId,
      assetsFolderId,
      reportsFolderId,
      agencyManaged: true,
    },
  });
}
