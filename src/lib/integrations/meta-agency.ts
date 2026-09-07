import {
  getAgencyTokens,
  upsertAgencyCredential,
  isAgencyConnected,
  deleteAgencyCredential,
} from "@/lib/db/agency-credentials";
import { markIntegrationSynced } from "@/lib/db/integrations";
import { signOAuthState } from "@/lib/crypto";
import {
  metaHealthScore,
  metaRoasFromInsights,
} from "@/lib/integrations/ads-metrics";
import type { AgencyAdAccount } from "@/types";

const META_API = "https://graph.facebook.com/v21.0";

export interface MetaAgencyTokens extends Record<string, unknown> {
  access_token: string;
  expires_at?: number;
}

export function isMetaAgencyConfigured(): boolean {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET && process.env.NEXT_PUBLIC_APP_URL);
}

export function getMetaAgencyAuthUrl(userId: string): string {
  const appId = process.env.META_APP_ID!;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/meta/callback`;
  const scopes = [
    "ads_read",
    "ads_management",
    "pages_read_engagement",
    "pages_messaging",
    "instagram_manage_messages",
    "business_management",
    "instagram_basic",
  ].join(",");
  const state = signOAuthState({ provider: "meta", userId });
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

  const expiringSoon =
    tokens.expires_at != null &&
    tokens.expires_at < Date.now() + 7 * 24 * 60 * 60 * 1000;

  if (expiringSoon) {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (appId && appSecret) {
      try {
        const longRes = await fetch(
          `${META_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokens.access_token}`
        );
        if (longRes.ok) {
          const long = (await longRes.json()) as {
            access_token: string;
            expires_in?: number;
          };
          await upsertAgencyCredential({
            provider: "meta",
            credentials: {
              access_token: long.access_token,
              expires_at: long.expires_in
                ? Date.now() + long.expires_in * 1000
                : undefined,
            },
          });
          return long.access_token;
        }
      } catch {
        // fall through
      }
    }
    if (tokens.expires_at != null && tokens.expires_at < Date.now()) {
      throw new Error("Meta token expired — reconnect in Settings");
    }
  }

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

export async function syncMetaAdsCampaigns(
  companyId: string,
  adAccountId: string
): Promise<number> {
  const token = await getMetaAccessToken();
  const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

  const [campaignsRes, insightsRes] = await Promise.all([
    fetch(
      `${META_API}/${actId}/campaigns?fields=id,name,status&limit=200&access_token=${token}`
    ),
    fetch(
      `${META_API}/${actId}/insights?level=campaign&date_preset=last_30d&fields=campaign_id,campaign_name,spend,impressions,reach,frequency,ctr,clicks,actions,action_values,purchase_roas&limit=500&access_token=${token}`
    ),
  ]);

  if (!campaignsRes.ok) {
    throw new Error(`Meta sync failed: ${await campaignsRes.text()}`);
  }
  if (!insightsRes.ok) {
    throw new Error(`Meta insights failed: ${await insightsRes.text()}`);
  }

  const campaignData = (await campaignsRes.json()) as {
    data?: Array<{ id: string; name: string; status: string }>;
  };
  const insightData = (await insightsRes.json()) as {
    data?: Array<Record<string, unknown> & { campaign_id?: string }>;
  };

  const insightsById = new Map<string, Record<string, unknown>>();
  for (const row of insightData.data ?? []) {
    if (row.campaign_id) insightsById.set(String(row.campaign_id), row);
  }

  const { getSql } = await import("@/lib/db/client");
  const sql = getSql();

  const statusMap: Record<string, string> = {
    ACTIVE: "active",
    PAUSED: "paused",
    ARCHIVED: "ended",
    DELETED: "ended",
  };

  const campaigns = campaignData.data ?? [];
  for (const c of campaigns) {
    const parsed = metaRoasFromInsights(insightsById.get(c.id) ?? {});
    const health = metaHealthScore(parsed.roas, parsed.ctr, parsed.spend);

    await sql`
      INSERT INTO meta_ads_campaigns (
        company_id, external_id, name, status, reach, impressions,
        frequency, spend, conversions, roas, ctr, health_score, synced_at
      ) VALUES (
        ${companyId}, ${c.id}, ${c.name},
        ${statusMap[c.status] ?? "active"},
        ${parsed.reach}, ${parsed.impressions},
        ${parsed.frequency}, ${parsed.spend}, ${parsed.conversions},
        ${parsed.roas}, ${parsed.ctr}, ${health}, now()
      )
      ON CONFLICT (company_id, external_id) DO UPDATE SET
        name = EXCLUDED.name, status = EXCLUDED.status,
        reach = EXCLUDED.reach, impressions = EXCLUDED.impressions,
        frequency = EXCLUDED.frequency,
        spend = EXCLUDED.spend, conversions = EXCLUDED.conversions,
        roas = EXCLUDED.roas, ctr = EXCLUDED.ctr,
        health_score = EXCLUDED.health_score,
        synced_at = now()
    `;
  }

  const keepMetaIds = campaigns.map((c) => c.id);
  if (keepMetaIds.length > 0) {
    await sql`
      DELETE FROM meta_ads_campaigns
      WHERE company_id = ${companyId}
        AND NOT (external_id = ANY(${keepMetaIds}))
    `;
  } else {
    await sql`DELETE FROM meta_ads_campaigns WHERE company_id = ${companyId}`;
  }

  await markIntegrationSynced(companyId, "meta_ads");

  // Deep sync: ad sets + ads (best-effort; don't fail campaign sync)
  try {
    await syncMetaAdSetsAndAds(companyId, actId, token);
  } catch {
    // ponytail: ad-level sync optional until permissions granted
  }

  return campaigns.length;
}

async function syncMetaAdSetsAndAds(
  companyId: string,
  actId: string,
  token: string
): Promise<void> {
  const { upsertMetaAdSet, upsertMetaAd } = await import("@/lib/db/attribution");
  const { getSql } = await import("@/lib/db/client");
  const sql = getSql();

  const [adSetsRes, adsRes, adSetInsights, adInsights] = await Promise.all([
    fetch(
      `${META_API}/${actId}/adsets?fields=id,name,status,campaign_id&limit=200&access_token=${token}`
    ),
    fetch(
      `${META_API}/${actId}/ads?fields=id,name,status,adset_id,campaign_id&limit=200&access_token=${token}`
    ),
    fetch(
      `${META_API}/${actId}/insights?level=adset&date_preset=last_30d&fields=adset_id,spend,impressions,reach,clicks,actions&limit=500&access_token=${token}`
    ),
    fetch(
      `${META_API}/${actId}/insights?level=ad&date_preset=last_30d&fields=ad_id,spend,impressions,reach,clicks,actions&limit=500&access_token=${token}`
    ),
  ]);

  const insightNum = (row: Record<string, unknown> | undefined, key: string) =>
    Number(row?.[key] ?? 0) || 0;
  const leadCount = (row: Record<string, unknown> | undefined) => {
    const actions = row?.actions as Array<{ action_type?: string; value?: string }> | undefined;
    const lead = actions?.find(
      (a) => a.action_type === "lead" || a.action_type === "onsite_conversion.lead_grouped"
    );
    return Number(lead?.value ?? 0) || 0;
  };

  const adSetInsightMap = new Map<string, Record<string, unknown>>();
  if (adSetInsights.ok) {
    const data = (await adSetInsights.json()) as {
      data?: Array<Record<string, unknown> & { adset_id?: string }>;
    };
    for (const row of data.data ?? []) {
      if (row.adset_id) adSetInsightMap.set(String(row.adset_id), row);
    }
  }

  const campaignIdByExternal = new Map<string, string>();
  const campRows = await sql`
    SELECT id, external_id FROM meta_ads_campaigns WHERE company_id = ${companyId}
  `;
  for (const r of campRows) {
    campaignIdByExternal.set(r.external_id as string, r.id as string);
  }

  const adSetDbIdByExternal = new Map<string, string>();

  if (adSetsRes.ok) {
    const data = (await adSetsRes.json()) as {
      data?: Array<{ id: string; name: string; status: string; campaign_id?: string }>;
    };
    for (const s of data.data ?? []) {
      const ins = adSetInsightMap.get(s.id);
      await upsertMetaAdSet({
        companyId,
        campaignId: s.campaign_id
          ? campaignIdByExternal.get(s.campaign_id) ?? null
          : null,
        externalId: s.id,
        name: s.name,
        status: s.status,
        spend: insightNum(ins, "spend"),
        impressions: insightNum(ins, "impressions"),
        clicks: insightNum(ins, "clicks"),
        reach: insightNum(ins, "reach"),
        leadsCount: leadCount(ins),
      });
    }
    const adSetRows = await sql`
      SELECT id, external_id FROM meta_ad_sets WHERE company_id = ${companyId}
    `;
    for (const r of adSetRows) {
      adSetDbIdByExternal.set(r.external_id as string, r.id as string);
    }
  }

  const adInsightMap = new Map<string, Record<string, unknown>>();
  if (adInsights.ok) {
    const data = (await adInsights.json()) as {
      data?: Array<Record<string, unknown> & { ad_id?: string }>;
    };
    for (const row of data.data ?? []) {
      if (row.ad_id) adInsightMap.set(String(row.ad_id), row);
    }
  }

  if (adsRes.ok) {
    const data = (await adsRes.json()) as {
      data?: Array<{
        id: string;
        name: string;
        status: string;
        adset_id?: string;
        campaign_id?: string;
      }>;
    };
    for (const ad of data.data ?? []) {
      const ins = adInsightMap.get(ad.id);
      await upsertMetaAd({
        companyId,
        adSetId: ad.adset_id ? adSetDbIdByExternal.get(ad.adset_id) ?? null : null,
        campaignId: ad.campaign_id
          ? campaignIdByExternal.get(ad.campaign_id) ?? null
          : null,
        externalId: ad.id,
        name: ad.name,
        status: ad.status,
        spend: insightNum(ins, "spend"),
        impressions: insightNum(ins, "impressions"),
        clicks: insightNum(ins, "clicks"),
        reach: insightNum(ins, "reach"),
        leadsCount: leadCount(ins),
      });
    }
  }
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

/** Send Messenger / IG DM via Graph API. Needs Meta agency connect + pages_messaging. */
export async function sendMetaPageMessage(input: {
  pageId: string;
  recipientId: string;
  text: string;
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  if (!(await isAgencyConnected("meta"))) {
    return { ok: false, error: "Connect Meta in Settings to send messages" };
  }
  try {
    const userToken = await getMetaAccessToken();
    const pageRes = await fetch(
      `${META_API}/${input.pageId}?fields=access_token&access_token=${userToken}`
    );
    if (!pageRes.ok) {
      return {
        ok: false,
        error: `Meta page token failed: ${pageRes.status} ${(await pageRes.text()).slice(0, 160)}`,
      };
    }
    const page = (await pageRes.json()) as { access_token?: string };
    if (!page.access_token) {
      return { ok: false, error: "No page access token — reconnect Meta with pages_messaging" };
    }
    const res = await fetch(`${META_API}/${input.pageId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: input.recipientId },
        message: { text: input.text },
        messaging_type: "RESPONSE",
        access_token: page.access_token,
      }),
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `Meta send failed: ${res.status} ${(await res.text()).slice(0, 200)}`,
      };
    }
    const data = (await res.json()) as { message_id?: string };
    return { ok: true, messageId: data.message_id ?? `meta-${Date.now()}` };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Meta send failed",
    };
  }
}
