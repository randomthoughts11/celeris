import { getSql } from "@/lib/db/client";
import { listMetaAdSets, listMetaAds } from "@/lib/db/attribution";
import { fetchMetaAdsCampaigns } from "@/lib/db/queries";
import { auditAd } from "@/lib/ads/audit";

export const BRAIN_MODULE = "meta_ads_brain";

export type BrainAction =
  | "pause"
  | "scale"
  | "refresh_creative"
  | "fix_targeting"
  | "reallocate_budget"
  | "investigate"
  | "keep";

export interface BrainDecision {
  priority: number;
  action: BrainAction;
  level: "campaign" | "adset" | "ad";
  target_id: string;
  target_name: string;
  reason: string;
  evidence: string;
  expected_impact: string;
}

interface BrainResult {
  summary: string;
  answer?: string;
  decisions: BrainDecision[];
}

const SEVERITY: Record<BrainAction, "critical" | "warning" | "success" | "info"> = {
  pause: "critical",
  refresh_creative: "warning",
  fix_targeting: "warning",
  reallocate_budget: "warning",
  scale: "success",
  investigate: "info",
  keep: "info",
};

const round = (n: number) => Math.round(n * 100) / 100;

/** Compact snapshot of the brand's Meta account for the model. */
export async function buildMetaSnapshot(companyId: string) {
  const [campaigns, adSets, ads] = await Promise.all([
    fetchMetaAdsCampaigns(companyId),
    listMetaAdSets(companyId).catch(() => []),
    listMetaAds(companyId).catch(() => []),
  ]);

  const leadsByCampaign = new Map<string, number>();
  for (const s of adSets) {
    if (s.campaign_id) leadsByCampaign.set(s.campaign_id, (leadsByCampaign.get(s.campaign_id) ?? 0) + s.leads_count);
  }
  const results = (c: (typeof campaigns)[number]) => leadsByCampaign.get(c.id) ?? c.conversions;
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalResults = campaigns.reduce((s, c) => s + results(c), 0);
  const accountCpl = totalResults > 0 ? totalSpend / totalResults : 0;

  const campaignRows = campaigns
    .map((c) => {
      const audit = auditAd(
        { status: c.status, spend: c.spend, impressions: c.impressions, ctr: c.ctr, frequency: c.frequency, results: results(c) },
        accountCpl
      );
      return { c, audit, results: results(c) };
    })
    .filter((r) => r.audit.score !== null);

  const adSetRows = adSets.filter((s) => s.spend > 0).slice(0, 40);
  const adRows = ads.filter((a) => a.spend > 0).slice(0, 40);
  const campaignExternal = new Map(campaigns.map((c) => [c.id, c.external_id]));

  return {
    accountCpl,
    snapshot: {
      window: "last 30 days",
      totals: {
        spend: round(totalSpend),
        results: totalResults,
        cost_per_result: round(accountCpl),
        running_campaigns: campaignRows.length,
        total_campaigns: campaigns.length,
      },
      campaigns: campaignRows.map(({ c, audit, results }) => ({
        id: c.external_id,
        name: c.name,
        status: c.status,
        spend: round(c.spend),
        results,
        cost_per_result: results ? round(c.spend / results) : null,
        impressions: c.impressions,
        reach: c.reach,
        ctr_pct: round(c.ctr * 100),
        frequency: round(c.frequency),
        audit_score: audit.score,
        audit_findings: audit.findings.map((f) => `${f.severity}: ${f.title}`),
      })),
      ad_sets: adSetRows.map((s) => ({
        id: s.external_id,
        name: s.name,
        campaign_id: s.campaign_id ? campaignExternal.get(s.campaign_id) : null,
        status: s.status,
        spend: round(s.spend),
        leads: s.leads_count,
        cpl: s.leads_count ? round(s.spend / s.leads_count) : null,
        ctr_pct: s.impressions ? round((s.clicks / s.impressions) * 100) : 0,
      })),
      ads: adRows.map((a) => ({
        id: a.external_id,
        name: a.name,
        status: a.status,
        spend: round(a.spend),
        leads: a.leads_count,
        cpl: a.leads_count ? round(a.spend / a.leads_count) : null,
        ctr_pct: a.impressions ? round((a.clicks / a.impressions) * 100) : 0,
      })),
    },
  };
}

const SYSTEM = `You are the ads brain for a performance marketing agency: a senior Meta Ads media buyer who audits accounts and makes concrete calls.
You get a JSON snapshot of one brand's Meta account (last 30 days). Most campaigns are lead generation, so "results" = leads and cost_per_result = CPL.
Rules:
- Only reference ids and names that exist in the snapshot. Never invent numbers; cite the numbers you used as evidence.
- Prefer a few high-impact decisions (max 8) over many small ones. Rank by money saved or gained.
- "pause" only for clear waste (meaningful spend, no/poor results). "scale" only for clearly efficient items with enough data.
- Judge CPL relative to the account average, not in absolute terms.
Respond with JSON only:
{"summary": "2-4 sentence plain-English state of the account",
 "answer": "direct answer to the user's question if one was asked, else omit",
 "decisions": [{"priority": 1-5 (1 = do first), "action": "pause|scale|refresh_creative|fix_targeting|reallocate_budget|investigate|keep",
   "level": "campaign|adset|ad", "target_id": "id from snapshot", "target_name": "...", "reason": "one sentence", "evidence": "numbers", "expected_impact": "one sentence"}]}`;

export function brainConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function runMetaBrain(companyId: string, question?: string): Promise<BrainResult> {
  if (!brainConfigured()) throw new Error("Add OPENAI_API_KEY to enable the ads brain");
  const { snapshot } = await buildMetaSnapshot(companyId);
  if (snapshot.campaigns.length === 0) {
    throw new Error("No running campaigns in the last 30 days to analyse. Sync the account first.");
  }

  const res = await fetch(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.REASONING_MODEL || "gpt-4.1",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `${question?.trim() ? `Question: ${question.trim().slice(0, 500)}\n\n` : ""}Snapshot:\n${JSON.stringify(snapshot)}`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}") as Partial<BrainResult>;

  const known = new Set([
    ...snapshot.campaigns.map((c) => c.id),
    ...snapshot.ad_sets.map((s) => s.id),
    ...snapshot.ads.map((a) => a.id),
  ]);
  const decisions = (parsed.decisions ?? [])
    .filter((d) => d && known.has(String(d.target_id)) && d.action in SEVERITY)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 8);

  const result = { summary: parsed.summary ?? "", answer: parsed.answer, decisions };
  await saveBrainResult(companyId, result);
  return result;
}

async function saveBrainResult(companyId: string, result: BrainResult) {
  const sql = getSql();
  await sql`
    UPDATE ai_insights SET is_dismissed = true
    WHERE company_id = ${companyId} AND module = ${BRAIN_MODULE} AND is_dismissed = false
  `;
  await sql`
    INSERT INTO ai_insights (company_id, module, severity, title, recommendation, explanation, metadata)
    VALUES (${companyId}, ${BRAIN_MODULE}, 'info', 'Account summary', ${result.summary},
      ${result.answer ?? ""}, ${JSON.stringify({ kind: "summary" })})
  `;
  for (const d of result.decisions) {
    await sql`
      INSERT INTO ai_insights (company_id, module, severity, title, recommendation, explanation, metadata)
      VALUES (${companyId}, ${BRAIN_MODULE}, ${SEVERITY[d.action]}, ${d.target_name}, ${d.reason},
        ${`${d.evidence} ${d.expected_impact}`.trim()},
        ${JSON.stringify({ kind: "decision", action: d.action, level: d.level, externalId: d.target_id, priority: d.priority })})
    `;
  }
}

export async function metaObjectBelongsTo(companyId: string, externalId: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    SELECT 1 FROM meta_ads_campaigns WHERE company_id = ${companyId} AND external_id = ${externalId}
    UNION ALL SELECT 1 FROM meta_ad_sets WHERE company_id = ${companyId} AND external_id = ${externalId}
    UNION ALL SELECT 1 FROM meta_ads WHERE company_id = ${companyId} AND external_id = ${externalId}
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function markMetaObjectPaused(companyId: string, externalId: string) {
  const sql = getSql();
  await sql`UPDATE meta_ads_campaigns SET status = 'paused' WHERE company_id = ${companyId} AND external_id = ${externalId}`;
  await sql`UPDATE meta_ad_sets SET status = 'PAUSED' WHERE company_id = ${companyId} AND external_id = ${externalId}`;
  await sql`UPDATE meta_ads SET status = 'PAUSED' WHERE company_id = ${companyId} AND external_id = ${externalId}`;
  await sql`
    UPDATE ai_insights SET metadata = metadata || '{"applied": true}'::jsonb
    WHERE company_id = ${companyId} AND module = ${BRAIN_MODULE} AND metadata->>'externalId' = ${externalId}
  `;
}
