"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Brain, Loader2, PauseCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { pauseMetaObjectAction, runAdsBrainAction } from "@/features/ads/actions";
import type { AiInsight } from "@/types";
import { cn } from "@/lib/utils";

const ACTION_LABEL: Record<string, string> = {
  pause: "Pause",
  scale: "Scale up",
  refresh_creative: "Refresh creative",
  fix_targeting: "Fix targeting",
  reallocate_budget: "Move budget",
  investigate: "Investigate",
  keep: "Keep running",
};

const ACTION_CLASS: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  warning: "bg-orange-100 text-orange-700",
  success: "bg-emerald-100 text-emerald-700",
  info: "bg-slate-100 text-slate-600",
};

export function AdsBrainPanel({
  companyId,
  insights,
  canApply,
  configured,
}: {
  companyId: string;
  insights: AiInsight[];
  canApply: boolean;
  configured: boolean;
}) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [running, startRun] = useTransition();
  const [pausing, setPausing] = useState<string | null>(null);

  const summary = insights.find((i) => i.metadata?.kind === "summary");
  const decisions = insights.filter((i) => i.metadata?.kind === "decision");
  const shownAnswer = answer ?? (summary?.explanation || null);

  const run = () =>
    startRun(async () => {
      const res = await runAdsBrainAction(companyId, question);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      setAnswer(res.answer ?? null);
      setQuestion("");
      router.refresh();
    });

  async function pause(externalId: string, name: string) {
    if (!confirm(`Pause "${name}" in Meta Ads now? This takes effect on the live account.`)) return;
    setPausing(externalId);
    const res = await pauseMetaObjectAction(companyId, externalId);
    setPausing(null);
    if ("error" in res && res.error) toast.error(res.error);
    else {
      toast.success(`Paused ${name}`);
      router.refresh();
    }
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Brain className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold leading-tight">Ads brain</p>
            <p className="text-xs text-muted-foreground">
              {summary
                ? `Last analysis ${formatDistanceToNow(new Date(summary.created_at), { addSuffix: true })}`
                : "AI media buyer that audits this account and tells you what to do"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          className="min-w-[240px] flex-1"
          placeholder="Ask anything, e.g. “Where am I wasting money?” (optional)"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && configured && !running && run()}
          disabled={!configured}
        />
        <Button onClick={run} disabled={running || !configured}>
          {running ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Brain className="mr-1.5 h-4 w-4" />}
          {running ? "Analysing…" : summary ? "Re-analyse" : "Analyse account"}
        </Button>
      </div>
      {!configured && <p className="text-sm text-orange-700">Add OPENAI_API_KEY on the server to enable the ads brain.</p>}

      {summary && (
        <div className="space-y-3">
          <p className="rounded-md bg-muted/50 p-3 text-sm leading-relaxed">{summary.recommendation}</p>
          {shownAnswer && (
            <p className="rounded-md border border-primary/20 bg-accent p-3 text-sm leading-relaxed">{shownAnswer}</p>
          )}
          <ol className="space-y-2">
            {decisions.map((d) => {
              const action = String(d.metadata?.action ?? "investigate");
              const externalId = String(d.metadata?.externalId ?? "");
              const applied = Boolean(d.metadata?.applied);
              return (
                <li key={d.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("rounded px-2 py-0.5 text-xs font-medium", ACTION_CLASS[d.severity])}>
                          {ACTION_LABEL[action] ?? action}
                        </span>
                        <span className="text-xs capitalize text-muted-foreground">{String(d.metadata?.level ?? "")}</span>
                        <span className="font-medium">{d.title}</span>
                      </div>
                      <p className="mt-1 text-sm">{d.recommendation}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{d.explanation}</p>
                    </div>
                    {action === "pause" && canApply && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={applied || pausing === externalId}
                        onClick={() => pause(externalId, d.title)}
                      >
                        <PauseCircle className="mr-1 h-3.5 w-3.5" />
                        {applied ? "Paused" : pausing === externalId ? "Pausing…" : "Pause in Meta"}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </Card>
  );
}
