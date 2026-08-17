import { getSql } from "./client";
import { generateInsights } from "@/lib/ai/insights-engine";
import type { CompanyWithMetrics } from "@/types";

export async function refreshCompanyInsights(
  company: CompanyWithMetrics
): Promise<void> {
  const sql = getSql();
  const metrics = company.metrics;
  const budgetUsedPercent = metrics?.budget_used_percent ?? 0;

  const generated = generateInsights({
    companyId: company.id,
    companyName: company.name,
    companySlug: company.slug,
    metrics,
    budgetUsedPercent,
    monthlyBudget: company.monthly_budget,
  });

  await sql`
    UPDATE ai_insights SET is_dismissed = true
    WHERE company_id = ${company.id} AND is_dismissed = false
  `;

  for (const insight of generated) {
    await sql`
      INSERT INTO ai_insights (
        company_id, module, severity, title, recommendation, explanation,
        action_label, action_link, is_dismissed, metadata
      )
      VALUES (
        ${insight.company_id},
        ${insight.module},
        ${insight.severity},
        ${insight.title},
        ${insight.recommendation},
        ${insight.explanation},
        ${insight.action_label},
        ${insight.action_link},
        false,
        ${JSON.stringify(insight.metadata ?? {})}
      )
    `;
  }
}

export async function dismissAiInsight(
  insightId: string,
  companyId: string
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE ai_insights SET is_dismissed = true
    WHERE id = ${insightId} AND company_id = ${companyId}
  `;
}
