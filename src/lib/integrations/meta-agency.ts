import {
  getAgencyTokens,
  upsertAgencyCredential,
  isAgencyConnected,
  deleteAgencyCredential,
} from "@/lib/db/agency-credentials";
import type { AgencyAdAccount } from "@/types";

const META_API = "https://graph.facebook.com/v21.0";

export interface MetaAgencyTokens extends Record<string, unknown> {
  access_token: string;
  expires_at?: number;
}

export function isMetaAgencyConfigured(): boolean {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET && process.env.NEXT_PUBLIC_APP_URL);
}

export function getMetaAgencyAuthUrl(): string {
  const appId = process.env.META_APP_ID!;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/meta/callback`;
  const scopes = [
    "ads_read",
    "ads_management",
    "pages_read_engagement",
    "business_management",
    "instagram_basic",
  ].join(",");
  const state = Buffer.from(JSON.stringify({ provider: "meta" })).toString("base64url");
  return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${state}&response_type=code`;
}

export async function exchangeMetaAgencyCode(code: string): Promise<void> {
  const appId = process.env.META_APP_ID!;
  const appSecret = process.env.META_APP_SECRET!;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/meta/callback`;

  const tokenRes = await fetch(
    `${META_API}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`
  );
  if (!tokenRes.ok) throw new Error(`Meta token exchange failed: ${await tokenRes.text()}`);
  const short = (await tokenRes.json()) as { access_token: string };

  const longRes = await fetch(
    `${META_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${short.access_token}`
  );
  if (!longRes.ok) throw new Error(`Meta long-lived token failed: ${await longRes.text()}`);
  const long = (await longRes.json()) as { access_token: string; expires_in?: number };

  await upsertAgencyCredential({
    provider: "meta",
    credentials: {
      access_token: long.access_token,
      expires_at: long.expires_in ? Date.now() + long.expires_in * 1000 : undefined,
    },
  });
}

export async function getMetaAccessToken(): Promise<string> {
  const tokens = await getAgencyTokens<MetaAgencyTokens>("meta");
  if (!tokens?.access_token) throw new Error("Meta agency account not connected");
  return tokens.access_token;
}

export async function listMetaAdAccounts(): Promise<AgencyAdAccount[]> {
  if (!(await isAgencyConnected("meta"))) return [];
  const token = await getMetaAccessToken();
  const res = await fetch(
    `${META_API}/me/adaccounts?fields=id,name,account_id,currency&limit=100&access_token=${token}`
  );
  if (!res.ok) throw new Error(`Meta ad accounts failed: ${await res.text()}`);
  const data = (await res.json()) as {
    data?: Array<{ id: string; name: string; account_id: string; currency?: string }>;
  };
  return (data.data ?? []).map((a) => ({
    id: a.id.replace("act_", ""),
    name: a.name || a.account_id,
    currency: a.currency,
  }));
}

export async function syncMetaAdsCampaigns(companyId: string, adAccountId: string): Promise<number> {
  const token = await getMetaAccessToken();
  const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

  const res = await fetch(
    `${META_API}/${actId}/campaigns?fields=id,name,status,insights{spend,impressions,reach,frequency,ctr,actions}&access_token=${token}`
  );
  if (!res.ok) throw new Error(`Meta sync failed: ${await res.text()}`);

  const data = (await res.json()) as {
    data?: Array<{
      id: string;
      name: string;
      status: string;
      insights?: { data?: Array<Record<string, unknown>> };
    }>;
  };

  const { getSql } = await import("@/lib/db/client");
  const sql = getSql();
  let count = 0;
  let totalSpend = 0;

  const statusMap: Record<string, string> = {
    ACTIVE: "active",
    PAUSED: "paused",
    ARCHIVED: "ended",
    DELETED: "ended",
  };

  for (const c of data.data ?? []) {
    const insights = c.insights?.data?.[0] ?? {};
    const spend = Number(insights.spend ?? 0);
    totalSpend += spend;
    const conversions = Array.isArray(insights.actions)
      ? (insights.actions as Array<{ action_type: string; value: string }>)
          .filter((a) => a.action_type === "purchase" || a.action_type === "lead")
          .reduce((s, a) => s + Number(a.value), 0)
      : 0;

    await sql`
      INSERT INTO meta_ads_campaigns (
        company_id, external_id, name, status, reach, impressions,
        frequency, spend, conversions, roas, ctr, synced_at
      ) VALUES (
        ${companyId}, ${c.id}, ${c.name},
        ${statusMap[c.status] ?? "active"},
        ${Number(insights.reach ?? 0)}, ${Number(insights.impressions ?? 0)},
        ${Number(insights.frequency ?? 0)}, ${spend}, ${conversions},
        ${spend > 0 ? conversions / spend : 0},
        ${Number(insights.ctr ?? 0)}, now()
      )
      ON CONFLICT (company_id, external_id) DO UPDATE SET
        name = EXCLUDED.name, status = EXCLUDED.status,
        reach = EXCLUDED.reach, impressions = EXCLUDED.impressions,
        spend = EXCLUDED.spend, conversions = EXCLUDED.conversions,
        synced_at = now()
    `;
    count++;
  }

  await sql`
    UPDATE company_metrics SET
      monthly_ad_spend = company_metrics.monthly_ad_spend + ${totalSpend},
      active_campaigns = ${count},
      updated_at = now()
    WHERE company_id = ${companyId}
  `;

  return count;
}

export async function syncMetaSocialAccounts(companyId: string, adAccountId: string): Promise<void> {
  const token = await getMetaAccessToken();
  const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

  const pagesRes = await fetch(
    `${META_API}/${actId}/promote_pages?fields=id,name,fan_count&access_token=${token}`
  );
  if (!pagesRes.ok) return;

  const pages = (await pagesRes.json()) as { data?: Array<{ id: string; name: string; fan_count?: number }> };
  const { getSql } = await import("@/lib/db/client");
  const sql = getSql();

  for (const page of pages.data ?? []) {
    await sql`
      INSERT INTO social_accounts (company_id, platform, account_name, followers, is_connected)
      VALUES (${companyId}, 'facebook', ${page.name}, ${page.fan_count ?? 0}, true)
      ON CONFLICT (company_id, platform) DO UPDATE SET
        account_name = EXCLUDED.account_name,
        followers = EXCLUDED.followers,
        is_connected = true,
        synced_at = now()
    `;

    const igRes = await fetch(
      `${META_API}/${page.id}?fields=instagram_business_account{id,username,followers_count}&access_token=${token}`
    );
    if (igRes.ok) {
      const igData = (await igRes.json()) as {
        instagram_business_account?: { id: string; username: string; followers_count?: number };
      };
      const ig = igData.instagram_business_account;
      if (ig) {
        await sql`
          INSERT INTO social_accounts (company_id, platform, account_name, followers, is_connected, metadata)
          VALUES (
            ${companyId}, 'instagram', ${ig.username},
            ${ig.followers_count ?? 0}, true,
            ${JSON.stringify({ page_id: page.id, ig_id: ig.id })}
          )
          ON CONFLICT (company_id, platform) DO UPDATE SET
            account_name = EXCLUDED.account_name,
            followers = EXCLUDED.followers,
            is_connected = true,
            synced_at = now()
        `;
      }
    }
  }
}

export async function disconnectMetaAgency(): Promise<void> {
  await deleteAgencyCredential("meta");
}
