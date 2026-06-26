import type { AiInsight, CompanyMetrics } from "@/types";

interface InsightContext {
  companyId: string;
  companyName: string;
  metrics: CompanyMetrics | null;
  budgetUsedPercent: number;
  monthlyBudget: number;
}

export function generateInsights(ctx: InsightContext): Omit<AiInsight, "id" | "created_at">[] {
  const insights: Omit<AiInsight, "id" | "created_at">[] = [];

  if (ctx.budgetUsedPercent > 90) {
    insights.push({
      company_id: ctx.companyId,
      module: "budget",
      severity: "critical",
      title: "Budget nearly exhausted",
      recommendation: "Pause underperforming campaigns",
      explanation: `Monthly budget is ${ctx.budgetUsedPercent.toFixed(0)}% depleted. Pausing low-ROAS campaigns would extend runway while protecting profitable spend.`,
      action_label: "View Analytics",
      action_link: null,
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
      action_label: null,
      action_link: null,
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
      recommendation: "Schedule content from approved drafts",
      explanation:
        "Posting frequency is below target. Consistent posting drives 20%+ higher engagement across platforms.",
      action_label: "Open Scheduler",
      action_link: null,
      is_dismissed: false,
      metadata: {},
      expires_at: null,
    });
  }

  return insights;
}
