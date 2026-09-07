export type GoogleAdsApiRow = {
  campaign?: { id?: string; name?: string; status?: string };
  campaignBudget?: { amountMicros?: string };
  metrics?: Record<string, string>;
};

export type FoldedGoogleCampaign = {
  id: string;
  name: string;
  status: string;
  dailyBudget: number;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  conversionValue: number;
  ctr: number;
  cpc: number;
  costPerConversion: number;
  roas: number;
};

/** GAQL with segments.date returns one row per campaign per day. Fold to 30-day totals. */
export function foldGoogleCampaignRows(
  rows: GoogleAdsApiRow[]
): FoldedGoogleCampaign[] {
  const byId = new Map<
    string,
    {
      id: string;
      name: string;
      status: string;
      dailyBudget: number;
      spend: number;
      clicks: number;
      impressions: number;
      conversions: number;
      conversionValue: number;
    }
  >();

  for (const row of rows) {
    const id = row.campaign?.id;
    if (!id) continue;
    const m = row.metrics ?? {};
    const existing = byId.get(id);
    const spend = Number(m.costMicros ?? 0) / 1_000_000;
    const clicks = Number(m.clicks ?? 0);
    const impressions = Number(m.impressions ?? 0);
    const conversions = Number(m.conversions ?? 0);
    const conversionValue = Number(m.conversionsValue ?? 0);
    const dailyBudget = Number(row.campaignBudget?.amountMicros ?? 0) / 1_000_000;

    if (!existing) {
      byId.set(id, {
        id,
        name: row.campaign?.name ?? "Campaign",
        status: row.campaign?.status ?? "ENABLED",
        dailyBudget,
        spend,
        clicks,
        impressions,
        conversions,
        conversionValue,
      });
      continue;
    }

    existing.spend += spend;
    existing.clicks += clicks;
    existing.impressions += impressions;
    existing.conversions += conversions;
    existing.conversionValue += conversionValue;
    if (dailyBudget > 0) existing.dailyBudget = dailyBudget;
    if (row.campaign?.name) existing.name = row.campaign.name;
    if (row.campaign?.status) existing.status = row.campaign.status;
  }

  return [...byId.values()].map((c) => {
    const ctr = c.impressions > 0 ? c.clicks / c.impressions : 0;
    const cpc = c.clicks > 0 ? c.spend / c.clicks : 0;
    const costPerConversion = c.conversions > 0 ? c.spend / c.conversions : 0;
    const roas = c.spend > 0 ? c.conversionValue / c.spend : 0;
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      dailyBudget: c.dailyBudget,
      spend: c.spend,
      clicks: c.clicks,
      impressions: c.impressions,
      conversions: c.conversions,
      conversionValue: c.conversionValue,
      ctr,
      cpc,
      costPerConversion,
      roas,
    };
  });
}

type ActionStat = { action_type?: string; value?: string };

function actionSum(actions: unknown, types: string[]): number {
  if (!Array.isArray(actions)) return 0;
  return (actions as ActionStat[])
    .filter((a) => types.includes(a.action_type ?? ""))
    .reduce((sum, a) => sum + Number(a.value ?? 0), 0);
}

const PURCHASE_TYPES = [
  "purchase",
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
];
const CONVERSION_TYPES = [...PURCHASE_TYPES, "lead", "omni_lead", "complete_registration"];

export function metaRoasFromInsights(insights: Record<string, unknown>): {
  spend: number;
  conversions: number;
  conversionValue: number;
  roas: number;
  reach: number;
  impressions: number;
  frequency: number;
  ctr: number;
} {
  const spend = Number(insights.spend ?? 0);
  const purchaseRoas = Array.isArray(insights.purchase_roas)
    ? Number((insights.purchase_roas as ActionStat[])[0]?.value ?? 0)
    : 0;
  const conversionValue = actionSum(insights.action_values, PURCHASE_TYPES);
  const conversions = actionSum(insights.actions, CONVERSION_TYPES);
  const roas =
    purchaseRoas > 0
      ? purchaseRoas
      : spend > 0 && conversionValue > 0
        ? conversionValue / spend
        : 0;

  const rawCtr = Number(insights.ctr ?? 0);
  const ctr = rawCtr / 100;

  return {
    spend,
    conversions,
    conversionValue,
    roas,
    reach: Number(insights.reach ?? 0),
    impressions: Number(insights.impressions ?? 0),
    frequency: Number(insights.frequency ?? 0),
    ctr,
  };
}

export function metaHealthScore(roas: number, ctr: number, spend: number): number {
  const ctrPercent = ctr <= 1 ? ctr * 100 : ctr;
  let score = 50;
  if (roas >= 2) score += 25;
  else if (roas >= 1) score += 10;
  else if (spend > 0) score -= 10;
  if (ctrPercent >= 2) score += 15;
  else if (ctrPercent >= 1) score += 5;
  return Math.max(0, Math.min(100, score));
}
