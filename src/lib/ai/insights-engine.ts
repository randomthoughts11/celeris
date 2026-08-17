import type { AiInsight, CompanyMetrics } from "@/types";

interface InsightContext {
  companyId: string;
  companyName: string;
  companySlug: string;
  metrics: CompanyMetrics | null;
  budgetUsedPercent: number;
  monthlyBudget: number;
}

export function generateInsights(ctx: InsightContext): Omit<AiInsight, "id" | "created_at">[] {
  const insights: Omit<AiInsight, "id" | "created_at">[] = [];
  const base = `/companies/${ctx.companySlug}`;

  if (ctx.budgetUsedPercent > 90) {
    insights.push({
      company_id: ctx.companyId,
      module: "budget",
      severity: "critical",
      title: "Budget nearly exhausted",
      recommendation: "Pause underperforming campaigns",
      explanation: `Monthly budget is ${ctx.budgetUsedPercent.toFixed(0)}% depleted. Pausing low-ROAS campaigns would extend runway while protecting profitable spend.`,
      action_label: "View Analytics",
      action_link: `${base}/analytics`,
      is_dismissed: false,
      metadata: {},
      expires_at: null,
    });
  }

  if (ctx.metrics && ctx.metrics.roas < 2) {
    insights.push({
      company_id: ctx.companyId,
      module: "analytics",
      severity: "warning",
      title: "ROAS below target",
      recommendation: "Review campaign targeting and creatives",
      explanation: `Current ROAS of ${ctx.metrics.roas.toFixed(1)}x is below the 2x minimum threshold. Review audience targeting and pause broad match keywords with high spend.`,
      action_label: "Open Ads",
      action_link: `${base}/google-ads`,
      is_dismissed: false,
      metadata: {},
      expires_at: null,
    });
  }

  if (ctx.metrics?.social_posting_status === "behind") {
    insights.push({
      company_id: ctx.companyId,
      module: "social",
      severity: "warning",
      title: "Social posting behind schedule",
      recommendation: "Publish from native tools and mark Board tasks done",
      explanation:
        "Posting frequency is below target. Use Publish to open the native platform, then complete related Board cards.",
      action_label: "Open Publishing",
      action_link: `${base}/publish`,
      is_dismissed: false,
      metadata: {},
      expires_at: null,
    });
  }

  return insights;
}
