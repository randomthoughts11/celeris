import { requireGlobalNavAccess } from "@/lib/auth/page-guards";
import { getAiCallPerformance, listAllAiCalls } from "@/lib/db/ai-calls";
import { getSql, toNumber } from "@/lib/db/client";

export default async function AiPerformancePage() {
  await requireGlobalNavAccess("ai-performance");
  const [perf, calls] = await Promise.all([
    getAiCallPerformance(),
    listAllAiCalls(50),
  ]);
  const sql = getSql();
  const human = await sql`
    SELECT
      COUNT(*)::int AS total,
      COALESCE(AVG(duration_seconds), 0) AS avg_duration
    FROM ringcentral_calls
    WHERE created_at > now() - interval '30 days'
  `;
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI agent performance</h1>
        <p className="text-muted-foreground">
          AI vs human call metrics (last 30 days).
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "AI calls", value: perf.total },
          { label: "AI completed", value: perf.completed },
          { label: "Avg AI score", value: perf.avgScore.toFixed(1) },
          { label: "Transfers", value: perf.transferred },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
          >
            <p className="text-xs text-muted-foreground">{m.label}</p>
            <p className="mt-1 text-2xl font-semibold">{m.value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm font-medium">AI avg duration</p>
          <p className="text-xl">{Math.round(perf.avgDuration)}s</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm font-medium">Human (RingCentral) calls</p>
          <p className="text-xl">
            {toNumber(human[0]?.total)} · avg {Math.round(toNumber(human[0]?.avg_duration))}s
          </p>
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="text-sm font-medium">Recent AI calls</h2>
        {calls.map((c) => (
          <div
            key={c.id}
            className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm"
          >
            {c.phone_number || "—"} · {c.status} · score {c.score ?? "—"} ·{" "}
            {c.sentiment ?? "—"}
          </div>
        ))}
      </div>
    </div>
  );
}
