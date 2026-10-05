import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { RunNowButton } from "@/components/call-audit/run-now-button";
import { getSessionUser } from "@/lib/auth/session";
import { canViewCallAudit } from "@/lib/call-audit/access";
import { CUT_SECONDS, fmtIst, type ClaimVerdict, type LeadVerdict } from "@/lib/call-audit/engine";
import { callAuditCompany, type StoredReport } from "@/lib/call-audit/run";
import { getSql } from "@/lib/db/client";
import { cn } from "@/lib/utils";

export const metadata = { title: "Call audit" };

const LEAD_LABEL: Record<LeadVerdict, string> = {
  verified: "Called",
  cut_short: `Cut under ${CUT_SECONDS}s`,
  claimed_no_call: "Claimed, no call",
  message_only: "Message only",
  untouched: "Untouched",
  waiting: "Still in 2h window",
};
const LEAD_CLASS: Record<LeadVerdict, string> = {
  verified: "bg-emerald-100 text-emerald-700",
  cut_short: "bg-orange-100 text-orange-700",
  claimed_no_call: "bg-red-100 text-red-700",
  message_only: "bg-orange-100 text-orange-700",
  untouched: "bg-red-100 text-red-700",
  waiting: "bg-slate-100 text-slate-600",
};
const CLAIM_LABEL: Record<ClaimVerdict, string> = { backed: "Backed", cut_short: `Under ${CUT_SECONDS}s`, no_call: "No call on log" };
const CLAIM_CLASS: Record<ClaimVerdict, string> = {
  backed: "bg-emerald-100 text-emerald-700",
  cut_short: "bg-orange-100 text-orange-700",
  no_call: "bg-red-100 text-red-700",
};
const FLAG_LABEL: Record<string, string> = {
  late: "Late first call",
  not_logged: "Called but not logged",
  conversation_not_on_log: "Conversation not on log",
  voicemail_ignored: "Voicemail not returned",
};

const phone = (p: string) => {
  const d = p.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
};
const badge = (cls: string, text: string) => (
  <span className={cn("whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium", cls)}>{text}</span>
);

export default async function CallAuditPage({ searchParams }: { searchParams: Promise<{ run?: string }> }) {
  const user = await getSessionUser();
  if (!canViewCallAudit(user)) notFound();
  const { run } = await searchParams;
  const company = await callAuditCompany();
  if (!company) notFound();

  const sql = getSql();
  const runs = await sql`
    SELECT id, window_end FROM call_audit_runs WHERE company_id = ${company.id} ORDER BY window_end DESC LIMIT 60
  `;
  const selectedId = (run && runs.some((r) => r.id === run) ? run : runs[0]?.id) as string | undefined;
  const [row] = selectedId ? await sql`SELECT report FROM call_audit_runs WHERE id = ${selectedId}` : [];
  const report = row?.report as StoredReport | undefined;

  const attention = report?.leads.filter((l) => l.verdict !== "verified" && l.verdict !== "waiting") ?? [];
  const flagged = report?.leads.filter((l) => l.verdict === "verified" && l.flags.length) ?? [];
  const claims = [...(report?.claims ?? [])].sort((a, b) => (a.verdict === b.verdict ? 0 : a.verdict === "no_call" ? -1 : b.verdict === "no_call" ? 1 : 0));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-blue-600">Private · {company.name}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Call audit</h1>
          <p className="text-muted-foreground">
            Every lead from Meta, checked against what was logged and the RingCentral call log. Runs at 12:00 PM and 12:00 AM IST.
          </p>
        </div>
        <RunNowButton />
      </div>

      {runs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {runs.slice(0, 14).map((r) => (
            <Link
              key={r.id as string}
              href={`/call-audit?run=${r.id}`}
              className={cn(
                "rounded border px-2.5 py-1 text-xs",
                r.id === selectedId ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
              )}
            >
              {fmtIst(new Date(r.window_end as string))}
            </Link>
          ))}
        </div>
      )}

      {!report ? (
        <Card className="p-10 text-center text-muted-foreground">No report yet. The first one runs at the next 12 o&apos;clock IST.</Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Window {fmtIst(new Date(report.windowStart))} to {fmtIst(new Date(report.windowEnd))} · {report.totals.calls} outbound calls in the window,{" "}
            {report.totals.realCalls} of them {CUT_SECONDS}s or longer
          </p>

          {report.inconclusive && (
            <Card className="flex-row items-start gap-3 border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{report.inconclusive}</p>
            </Card>
          )}
          {report.warnings.length > 0 && (
            <Card className="gap-1 border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
              {report.warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
            </Card>
          )}

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {(["verified", "cut_short", "claimed_no_call", "message_only", "untouched", "waiting"] as const).map((v) => (
              <Card key={v} className="gap-1 p-4">
                <p className="text-xs text-muted-foreground">{LEAD_LABEL[v]}</p>
                <p className="text-2xl font-semibold">{report.totals[v]}</p>
              </Card>
            ))}
          </div>
          <Card className="flex-row flex-wrap items-center gap-x-8 gap-y-2 p-4 text-sm">
            <span>
              <span className="font-semibold">{report.totals.leads}</span> new leads
            </span>
            <span>
              <span className="font-semibold">
                {report.totals.claimsBacked} of {report.totals.claims}
              </span>{" "}
              logged calls are backed by a real RingCentral call
            </span>
            <span className="text-muted-foreground">
              Sources: {report.sources.metaLeads} Meta leads pulled · {report.sources.calls} calls · {report.sources.voicemails} voicemails ·
              Privyr {report.sources.privyr ?? "not connected"} · sheet {report.sources.sheetClaims ?? "not set"}
            </span>
          </Card>

          {report.campaigns.length > 0 && (
            <Section title="By campaign">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Campaign</th>
                    <th className="px-3 py-2.5 text-right font-medium">Leads</th>
                    {(["verified", "cut_short", "claimed_no_call", "message_only", "untouched", "waiting"] as const).map((v) => (
                      <th key={v} className="px-3 py-2.5 text-right font-medium">
                        {LEAD_LABEL[v]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {report.campaigns.map((c) => (
                    <tr key={c.name}>
                      <td className="px-3 py-2.5 font-medium">{c.name}</td>
                      <td className="px-3 py-2.5 text-right">{c.leads}</td>
                      {(["verified", "cut_short", "claimed_no_call", "message_only", "untouched", "waiting"] as const).map((v) => (
                        <td key={v} className={cn("px-3 py-2.5 text-right", c[v] && v !== "verified" && v !== "waiting" && "font-semibold text-red-700")}>
                          {c[v]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          <Section title={`Leads that were not properly called (${attention.length + flagged.length})`}>
            <LeadTable leads={[...attention, ...flagged]} empty="Every lead past the 2-hour window got a real call." />
          </Section>

          <Section title={`Logged calls checked against RingCentral (${claims.length})`}>
            {claims.length ? (
              <table className="w-full min-w-[860px] text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Result</th>
                    <th className="px-3 py-2.5 font-medium">Lead</th>
                    <th className="px-3 py-2.5 font-medium">What she logged</th>
                    <th className="px-3 py-2.5 font-medium">RingCentral</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {claims.map((c, i) => (
                    <tr key={i} className="align-top">
                      <td className="px-3 py-2.5">{badge(CLAIM_CLASS[c.verdict], CLAIM_LABEL[c.verdict])}</td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{phone(c.phone)}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="text-xs uppercase text-muted-foreground">
                          {c.source} · {c.when}
                        </p>
                        <p>{c.text}</p>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{c.evidence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="p-6 text-center text-sm text-muted-foreground">No logged calls fell in this window.</p>
            )}
          </Section>

          {report.voicemails.length > 0 && (
            <Section title={`Voicemails (${report.voicemails.length})`}>
              <ul className="divide-y text-sm">
                {report.voicemails.map((v, i) => (
                  <li key={i} className="flex flex-wrap gap-3 px-4 py-3">
                    {badge(v.returned ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700", v.returned ? "Called back" : "Not returned")}
                    <span className="font-medium">{phone(v.phone)}</span>
                    <span className="text-muted-foreground">
                      {fmtIst(new Date(v.at))} · {v.duration}s
                    </span>
                    <p className="w-full text-muted-foreground">{v.transcript || "No transcript."}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title={`All new leads (${report.leads.length})`}>
            <LeadTable leads={report.leads} empty="No new Meta leads in this window." />
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">{title}</h2>
      <div className="overflow-x-auto rounded-lg border bg-card">{children}</div>
    </section>
  );
}

function LeadTable({ leads, empty }: { leads: StoredReport["leads"]; empty: string }) {
  if (!leads.length) return <p className="p-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <table className="w-full min-w-[860px] text-sm">
      <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
        <tr>
          <th className="px-3 py-2.5 font-medium">Result</th>
          <th className="px-3 py-2.5 font-medium">Lead</th>
          <th className="px-3 py-2.5 font-medium">Campaign</th>
          <th className="px-3 py-2.5 font-medium">Came in</th>
          <th className="px-3 py-2.5 font-medium">Evidence</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {leads.map((l, i) => (
          <tr key={i} className="align-top">
            <td className="space-y-1 px-3 py-2.5">
              {badge(LEAD_CLASS[l.verdict], LEAD_LABEL[l.verdict])}
              {l.flags.map((f) => (
                <div key={f}>{badge("bg-slate-100 text-slate-600", FLAG_LABEL[f] ?? f)}</div>
              ))}
            </td>
            <td className="px-3 py-2.5">
              <p className="font-medium">{l.name}</p>
              <p className="text-xs text-muted-foreground">{phone(l.phone)}</p>
            </td>
            <td className="px-3 py-2.5 text-muted-foreground">{l.campaign}</td>
            <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{fmtIst(new Date(l.createdAt))}</td>
            <td className="px-3 py-2.5">
              <ul className="space-y-0.5">
                {l.evidence.map((e, j) => (
                  <li key={j} className={j ? "text-muted-foreground" : ""}>
                    {e}
                  </li>
                ))}
              </ul>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
