"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, CheckCircle, Info, Sparkles, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { dismissInsightAction } from "@/features/companies/actions";
import type { AiInsight } from "@/types";
import { getSeverityColor } from "@/lib/format";
import { cn } from "@/lib/utils";

interface AiInsightsPanelProps {
  insights: AiInsight[];
  companyId: string;
}

const severityIcons = {
  critical: AlertTriangle,
  warning: AlertTriangle,
  success: CheckCircle,
  info: Info,
};

export function AiInsightsPanel({ insights, companyId }: AiInsightsPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (insights.length === 0) return null;

  const dismiss = (insightId: string) => {
    startTransition(async () => {
      await dismissInsightAction(insightId, companyId);
      router.refresh();
    });
  };

  return (
    <Card className="border-white/5 bg-white/[0.02] p-6 backdrop-blur-sm">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-400" />
        <h3 className="font-semibold">AI Insights</h3>
        <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-xs text-violet-300">
          {insights.length} active
        </span>
      </div>

      <div className="space-y-3">
        {insights.map((insight, i) => {
          const Icon = severityIcons[insight.severity] ?? Info;
          return (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className={cn(
                "rounded-xl border p-4",
                getSeverityColor(insight.severity)
              )}
            >
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{insight.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {insight.recommendation}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => dismiss(insight.id)}
                      disabled={pending}
                      aria-label="Dismiss insight"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground/80">
                    {insight.explanation}
                  </p>
                  {insight.action_link && insight.action_label && (
                    <Link
                      href={insight.action_link}
                      className="inline-flex h-8 items-center gap-1 px-2 text-sm text-violet-400 hover:text-violet-300"
                    >
                      {insight.action_label}
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}
