export type AuditSeverity = "critical" | "warning" | "good" | "info";

export interface AuditFinding {
  severity: AuditSeverity;
  title: string;
  detail: string;
}

export interface AdAudit {
  /** null when the item isn't running, so there's nothing to judge */
  score: number | null;
  label: "Not running" | "Healthy" | "Needs attention" | "Problem";
  findings: AuditFinding[];
}

export interface AuditInput {
  status: string;
  spend: number;
  impressions: number;
  /** fraction, e.g. 0.012 = 1.2% */
  ctr: number;
  frequency: number;
  results: number;
}

const money = (n: number) => `$${n.toFixed(n >= 100 ? 0 : 2)}`;
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

/** Explainable audit for a Meta campaign / ad set over the synced 30-day window. */
export function auditAd(input: AuditInput, accountCpl: number): AdAudit {
  const active = input.status.toLowerCase() === "active";
  const findings: AuditFinding[] = [];

  if (input.spend === 0 && input.impressions === 0) {
    if (!active) {
      return {
        score: null,
        label: "Not running",
        findings: [{ severity: "info", title: "Not running", detail: "Paused or ended, with no spend in the last 30 days." }],
      };
    }
    findings.push({
      severity: "critical",
      title: "Active but not delivering",
      detail: "Marked active yet got zero impressions in 30 days. Check budget, ad approval, schedule and audience size.",
    });
  }

  const cpl = input.results > 0 ? input.spend / input.results : 0;
  const noResultThreshold = accountCpl > 0 ? accountCpl * 2 : 20;

  if (input.spend > 0 && input.results === 0 && input.spend >= noResultThreshold) {
    findings.push({
      severity: "critical",
      title: `Spent ${money(input.spend)} with no results`,
      detail: `That's more than ${accountCpl > 0 ? `2× the account's ${money(accountCpl)} cost per result` : "$20"} without a single lead or conversion. Pause it or fix the offer, form, or targeting.`,
    });
  } else if (cpl > 0 && accountCpl > 0) {
    const ratio = cpl / accountCpl;
    if (ratio >= 1.5) {
      findings.push({
        severity: "warning",
        title: `Expensive results: ${money(cpl)} each`,
        detail: `${ratio.toFixed(1)}× the account average of ${money(accountCpl)}. Move budget to cheaper campaigns or test new creative.`,
      });
    } else if (ratio <= 0.7) {
      findings.push({
        severity: "good",
        title: `Cheap results: ${money(cpl)} each`,
        detail: `${Math.round((1 - ratio) * 100)}% below the account average of ${money(accountCpl)}. A candidate for more budget.`,
      });
    }
  }

  if (input.impressions >= 1000) {
    if (input.ctr < 0.008) {
      findings.push({
        severity: "warning",
        title: `Low click-through rate (${pct(input.ctr)})`,
        detail: "Under the ~1% baseline for Meta. The hook or visual isn't stopping the scroll; test new creative.",
      });
    } else if (input.ctr >= 0.02) {
      findings.push({ severity: "good", title: `Strong click-through rate (${pct(input.ctr)})`, detail: "People are engaging with the creative." });
    }
  } else if (input.spend > 0) {
    findings.push({ severity: "info", title: "Too little data", detail: "Under 1,000 impressions, so these numbers aren't reliable yet." });
  }

  if (input.frequency > 3.5) {
    findings.push({
      severity: "warning",
      title: `Ad fatigue (frequency ${input.frequency.toFixed(1)})`,
      detail: "The same people have seen this 3.5+ times. Refresh creative or widen the audience.",
    });
  }

  const weights: Record<AuditSeverity, number> = { critical: -35, warning: -15, good: 8, info: 0 };
  const score = Math.max(0, Math.min(100, 80 + findings.reduce((s, f) => s + weights[f.severity], 0)));
  if (findings.length === 0) {
    findings.push({ severity: "good", title: "No problems found", detail: "Costs, engagement and frequency are within normal ranges." });
  }
  return {
    score,
    label: score >= 75 ? "Healthy" : score >= 50 ? "Needs attention" : "Problem",
    findings,
  };
}
