"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { auditAd, type AdAudit, type AuditSeverity } from "@/lib/ads/audit";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { MetaAd, MetaAdSet, MetaAdsCampaign } from "@/types";
import { cn } from "@/lib/utils";

type Level = "campaign" | "adset" | "ad";
type StatusFilter = "all" | "active" | "paused" | "ended";
type SortKey = "spend" | "results" | "cpr" | "ctr" | "score";

interface Row {
  id: string;
  externalId: string;
  name: string;
  parent?: string;
  status: string;
  spend: number;
  results: number;
  impressions: number;
  clicks?: number;
  ctr: number;
  frequency: number;
  audit: AdAudit;
}

const SEVERITY_DOT: Record<AuditSeverity, string> = {
  critical: "bg-red-600",
  warning: "bg-orange-500",
  good: "bg-emerald-600",
  info: "bg-slate-400",
};

const LABEL_CLASS: Record<AdAudit["label"], string> = {
  Healthy: "bg-emerald-100 text-emerald-700",
  "Needs attention": "bg-orange-100 text-orange-700",
  Problem: "bg-red-100 text-red-700",
  "Not running": "bg-slate-100 text-slate-500",
};

const normStatus = (s: string) => {
  const v = s.toLowerCase();
  return v === "archived" || v === "deleted" ? "ended" : v;
};

export function MetaAdsExplorer({
  campaigns,
  adSets,
  ads,
}: {
  campaigns: MetaAdsCampaign[];
  adSets: MetaAdSet[];
  ads: MetaAd[];
}) {
  const [level, setLevel] = useState<Level>("campaign");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [withSpend, setWithSpend] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("spend");
  const [open, setOpen] = useState<string | null>(null);

  const { rows, accountCpr } = useMemo(() => {
    const leadsByCampaign = new Map<string, number>();
    for (const s of adSets) {
      if (s.campaign_id) leadsByCampaign.set(s.campaign_id, (leadsByCampaign.get(s.campaign_id) ?? 0) + s.leads_count);
    }
    const campaignName = new Map(campaigns.map((c) => [c.id, c.name]));
    const adSetName = new Map(adSets.map((s) => [s.id, s.name]));
    const campaignResults = (c: MetaAdsCampaign) => leadsByCampaign.get(c.id) ?? c.conversions;
    const spend = campaigns.reduce((n, c) => n + c.spend, 0);
    const results = campaigns.reduce((n, c) => n + campaignResults(c), 0);
    const cpr = results > 0 ? spend / results : 0;

    const build = (r: Omit<Row, "audit">): Row => ({
      ...r,
      audit: auditAd({ status: normStatus(r.status), spend: r.spend, impressions: r.impressions, ctr: r.ctr, frequency: r.frequency, results: r.results }, cpr),
    });

    const byLevel: Record<Level, Row[]> = {
      campaign: campaigns.map((c) =>
        build({ id: c.id, externalId: c.external_id, name: c.name, status: c.status, spend: c.spend, results: campaignResults(c), impressions: c.impressions, ctr: c.ctr, frequency: c.frequency })
      ),
      adset: adSets.map((s) =>
        build({
          id: s.id, externalId: s.external_id, name: s.name, parent: s.campaign_id ? campaignName.get(s.campaign_id) : undefined,
          status: s.status, spend: s.spend, results: s.leads_count, impressions: s.impressions, clicks: s.clicks,
          ctr: s.impressions ? s.clicks / s.impressions : 0, frequency: 0,
        })
      ),
      ad: ads.map((a) =>
        build({
          id: a.id, externalId: a.external_id, name: a.name, parent: a.ad_set_id ? adSetName.get(a.ad_set_id) : undefined,
          status: a.status, spend: a.spend, results: a.leads_count, impressions: a.impressions, clicks: a.clicks,
          ctr: a.impressions ? a.clicks / a.impressions : 0, frequency: 0,
        })
      ),
    };
    return { rows: byLevel, accountCpr: cpr };
  }, [campaigns, adSets, ads]);

  const q = query.trim().toLowerCase();
  const cprOf = (r: Row) => (r.results ? r.spend / r.results : Infinity);
  const visible = rows[level]
    .filter((r) => status === "all" || normStatus(r.status) === status)
    .filter((r) => !withSpend || r.spend > 0)
    .filter((r) => !q || r.name.toLowerCase().includes(q) || (r.parent ?? "").toLowerCase().includes(q))
    .sort((a, b) => {
      if (sort === "results") return b.results - a.results;
      if (sort === "cpr") return cprOf(a) - cprOf(b);
      if (sort === "ctr") return b.ctr - a.ctr;
      if (sort === "score") return (a.audit.score ?? 101) - (b.audit.score ?? 101);
      return b.spend - a.spend;
    });

  const totals = visible.reduce((t, r) => ({ spend: t.spend + r.spend, results: t.results + r.results }), { spend: 0, results: 0 });
  const problems = visible.filter((r) => r.audit.label === "Problem").length;

  const chip = (active: boolean) =>
    cn("rounded px-3 py-1 text-sm transition-colors", active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground");

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border bg-card p-0.5">
          {([["campaign", "Campaigns"], ["adset", "Ad sets"], ["ad", "Ads"]] as const).map(([id, label]) => (
            <button key={id} type="button" className={chip(level === id)} onClick={() => setLevel(id)}>
              {label} <span className="opacity-70">({rows[id].length})</span>
            </button>
          ))}
        </div>
        <div className="flex rounded-md border bg-card p-0.5">
          {(["active", "paused", "ended", "all"] as const).map((s) => (
            <button key={s} type="button" className={cn(chip(status === s), "capitalize")} onClick={() => setStatus(s)}>
              {s}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <input type="checkbox" checked={withSpend} onChange={(e) => setWithSpend(e.target.checked)} />
          Only with spend
        </label>
        <select
          aria-label="Sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="h-9 rounded-md border border-input bg-card px-3 text-sm"
        >
          <option value="spend">Sort: highest spend</option>
          <option value="results">Sort: most results</option>
          <option value="cpr">Sort: cheapest per result</option>
          <option value="ctr">Sort: best CTR</option>
          <option value="score">Sort: worst audit first</option>
        </select>
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search by name…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {visible.length} shown · {formatCurrency(totals.spend)} spend · {totals.results} results
        {totals.results ? ` · ${formatCurrency(totals.spend / totals.results)} per result` : ""}
        {problems ? ` · ${problems} flagged as problems` : ""} · account average {formatCurrency(accountCpr)} per result · last 30 days
      </p>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-8 px-2 py-2.5" />
              <th className="px-3 py-2.5 font-medium">Name</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 text-right font-medium">Spend</th>
              <th className="px-3 py-2.5 text-right font-medium">Results</th>
              <th className="px-3 py-2.5 text-right font-medium">Cost / result</th>
              <th className="px-3 py-2.5 text-right font-medium">Impr.</th>
              <th className="px-3 py-2.5 text-right font-medium">CTR</th>
              <th className="px-3 py-2.5 font-medium">Audit</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visible.map((r) => {
              const expanded = open === r.id;
              return (
                <Fragment key={r.id}>
                  <tr className="cursor-pointer hover:bg-muted/50" onClick={() => setOpen(expanded ? null : r.id)}>
                    <td className="px-2 py-2.5 text-muted-foreground">
                      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium">{r.name}</p>
                      {r.parent && <p className="text-xs text-muted-foreground">{r.parent}</p>}
                    </td>
                    <td className="px-3 py-2.5 capitalize text-muted-foreground">{normStatus(r.status)}</td>
                    <td className="px-3 py-2.5 text-right">{formatCurrency(r.spend)}</td>
                    <td className="px-3 py-2.5 text-right">{r.results}</td>
                    <td className="px-3 py-2.5 text-right">{r.results ? formatCurrency(r.spend / r.results) : "—"}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{formatNumber(r.impressions)}</td>
                    <td className="px-3 py-2.5 text-right">{r.impressions ? `${(r.ctr * 100).toFixed(2)}%` : "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn("rounded px-2 py-0.5 text-xs font-medium", LABEL_CLASS[r.audit.label])}>
                        {r.audit.score !== null ? `${r.audit.score} · ` : ""}
                        {r.audit.label}
                      </span>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="bg-muted/30">
                      <td />
                      <td colSpan={8} className="px-3 py-3">
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Why this score · Meta ID {r.externalId}
                        </p>
                        <ul className="space-y-1.5">
                          {r.audit.findings.map((f) => (
                            <li key={f.title} className="flex gap-2">
                              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", SEVERITY_DOT[f.severity])} />
                              <span>
                                <span className="font-medium">{f.title}.</span>{" "}
                                <span className="text-muted-foreground">{f.detail}</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  Nothing matches these filters. Try &ldquo;All&rdquo; or untick &ldquo;Only with spend&rdquo;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
