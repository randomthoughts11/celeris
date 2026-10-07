/** Judge telecaller work: Meta leads + her claims (Privyr, sheet) against the RingCentral log. */

export const CUT_SECONDS = 20;
export const SLA_MINUTES = 120;
const HOUR = 3_600_000;
const IST = "Asia/Kolkata";

export interface AuditLead {
  id: string;
  name: string;
  phone: string;
  phoneKey: string;
  campaign: string;
  createdAt: Date;
}

export type ClaimKind = "call" | "conversation" | "message";

export interface Claim {
  phoneKey: string;
  name: string;
  source: "privyr" | "sheet";
  kind: ClaimKind;
  /** Exact time (Privyr). */
  at: Date | null;
  /** Calendar day YYYY-MM-DD when only a date is known (sheet). */
  day: string | null;
  text: string;
}

export interface AuditCall {
  phoneKey: string;
  direction: "inbound" | "outbound";
  start: Date;
  duration: number;
  result: string;
}

export interface AuditVoicemail {
  phoneKey: string;
  at: Date;
  duration: number;
  transcript: string;
}

export type LeadVerdict = "verified" | "cut_short" | "claimed_no_call" | "message_only" | "untouched" | "waiting" | "unchecked";
export type ClaimVerdict = "backed" | "cut_short" | "no_call" | "unchecked";

export interface LeadRow {
  name: string;
  phone: string;
  campaign: string;
  createdAt: string;
  verdict: LeadVerdict;
  flags: string[];
  evidence: string[];
}

export interface ClaimRow {
  name: string;
  phone: string;
  source: Claim["source"];
  kind: ClaimKind;
  when: string;
  text: string;
  verdict: ClaimVerdict;
  evidence: string;
}

export interface CallAuditReport {
  windowStart: string;
  windowEnd: string;
  totals: Record<LeadVerdict, number> & { leads: number; claims: number; claimsBacked: number; calls: number; realCalls: number };
  campaigns: Array<{ name: string } & Record<LeadVerdict | "leads", number>>;
  leads: LeadRow[];
  claims: ClaimRow[];
  voicemails: Array<{ phone: string; at: string; duration: number; transcript: string; returned: boolean }>;
}

export interface AuditInput {
  windowStart: Date;
  windowEnd: Date;
  leads: AuditLead[];
  claims: Claim[];
  /** null when the call log could not be read: leads and claims are listed but not judged. */
  calls: AuditCall[] | null;
  voicemails: AuditVoicemail[];
  /** Sheet claims dated this IST day are checked in this run. */
  sheetDay: string | null;
}

export function phoneKey(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

export function fmtIst(d: Date): string {
  return d.toLocaleString("en-IN", { timeZone: IST, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) + " IST";
}

const fmtDur = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);
const describe = (c: AuditCall) => `${fmtIst(c.start)} ${fmtDur(c.duration)} ${c.result || ""}`.trim();
const CONNECTED = /accepted|connected/i;

/** IST midnight that starts `day` (YYYY-MM-DD). */
export function istDayStart(day: string): Date {
  return new Date(`${day}T00:00:00+05:30`);
}

export function istDay(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: IST });
}

export function judge(input: AuditInput): CallAuditReport {
  const { windowStart, windowEnd } = input;
  const outbound = new Map<string, AuditCall[]>();
  const noLog = input.calls === null;
  const allCalls = input.calls ?? [];
  for (const c of allCalls) {
    if (c.direction !== "outbound" || !c.phoneKey) continue;
    outbound.set(c.phoneKey, [...(outbound.get(c.phoneKey) ?? []), c]);
  }
  for (const list of outbound.values()) list.sort((a, b) => +a.start - +b.start);
  const callsBetween = (key: string, from: Date, to: Date) =>
    (outbound.get(key) ?? []).filter((c) => c.start >= from && c.start <= to);

  const leads: LeadRow[] = input.leads.map((lead) => {
    const calls = callsBetween(lead.phoneKey, new Date(+lead.createdAt - 5 * 60_000), windowEnd);
    const real = calls.filter((c) => c.duration >= CUT_SECONDS);
    const claims = input.claims.filter(
      (c) =>
        c.phoneKey === lead.phoneKey &&
        (c.at ? c.at >= new Date(+lead.createdAt - HOUR) : (c.day ?? "") >= istDay(lead.createdAt))
    );
    const callClaims = claims.filter((c) => c.kind !== "message");
    const flags: string[] = [];
    const evidence: string[] = [];
    let verdict: LeadVerdict;

    if (noLog) {
      verdict = "unchecked";
      evidence.push("Not checked yet: the RingCentral call log is not connected.");
    } else if (real.length) {
      verdict = "verified";
      const late = (+real[0].start - +lead.createdAt) / 60_000;
      if (late > SLA_MINUTES) {
        flags.push("late");
        evidence.push(`First real call came ${Math.round(late / 60)}h after the lead arrived (target ${SLA_MINUTES / 60}h).`);
      }
      if (claims.some((c) => c.kind === "conversation") && !real.some((c) => CONNECTED.test(c.result))) {
        flags.push("conversation_not_on_log");
        evidence.push("She logged a conversation, but no call to this number connected.");
      }
      if (!callClaims.length) {
        flags.push("not_logged");
        evidence.push("Real call on RingCentral that she never wrote down.");
      }
    } else if (calls.length) {
      verdict = "cut_short";
      evidence.push(`Every call was under ${CUT_SECONDS}s, so it was cut before it could ring through to voicemail.`);
    } else if (callClaims.length) {
      verdict = "claimed_no_call";
      evidence.push("She logged a call, but RingCentral has no call to this number.");
    } else if (claims.length) {
      verdict = "message_only";
      evidence.push("Only a message or WhatsApp was logged. No call was made.");
    } else if (+windowEnd - +lead.createdAt < SLA_MINUTES * 60_000) {
      verdict = "waiting";
      evidence.push(`Still inside the ${SLA_MINUTES / 60}h response window. It is judged again in the next report.`);
    } else {
      verdict = "untouched";
      evidence.push("No call, no message, nothing logged.");
    }

    if (calls.length) evidence.push(`RingCentral: ${calls.map(describe).join("; ")}`);
    for (const c of claims) evidence.push(`${c.source === "privyr" ? "Privyr" : "Sheet"}: ${c.text}`);
    for (const vm of input.voicemails) {
      if (vm.phoneKey !== lead.phoneKey || vm.at < lead.createdAt) continue;
      if (!callsBetween(lead.phoneKey, new Date(+vm.at - 60_000), windowEnd).length) {
        flags.push("voicemail_ignored");
        evidence.push(`Left a voicemail at ${fmtIst(vm.at)} that was never returned.`);
      }
    }
    return { name: lead.name, phone: lead.phone, campaign: lead.campaign, createdAt: lead.createdAt.toISOString(), verdict, flags, evidence };
  });

  const seen = new Set<string>();
  const claims: ClaimRow[] = [];
  for (const c of input.claims) {
    if (c.kind === "message") continue;
    let from: Date, to: Date, when: string;
    if (c.at) {
      if (c.at < windowStart || c.at >= windowEnd) continue;
      from = new Date(+c.at - 12 * HOUR);
      to = new Date(+c.at + HOUR);
      when = fmtIst(c.at);
    } else {
      if (!c.day || c.day !== input.sheetDay) continue;
      from = new Date(+istDayStart(c.day) - 12 * HOUR);
      to = new Date(+istDayStart(c.day) + 36 * HOUR);
      when = c.day;
    }
    const key = `${c.phoneKey}|${c.source}|${c.at ? +c.at : c.day}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const calls = callsBetween(c.phoneKey, from, to);
    const real = calls.filter((x) => x.duration >= CUT_SECONDS);
    const verdict: ClaimVerdict = noLog ? "unchecked" : real.length ? "backed" : calls.length ? "cut_short" : "no_call";
    claims.push({
      name: c.name,
      phone: c.phoneKey,
      source: c.source,
      kind: c.kind,
      when,
      text: c.text,
      verdict,
      evidence: noLog
        ? "Not checked yet: the RingCentral call log is not connected."
        : calls.length ? calls.map(describe).join("; ") : `No call to this number between ${fmtIst(from)} and ${fmtIst(to)}.`,
    });
  }

  const zero = (): Record<LeadVerdict | "leads", number> => ({
    leads: 0, verified: 0, cut_short: 0, claimed_no_call: 0, message_only: 0, untouched: 0, waiting: 0, unchecked: 0,
  });
  const byCampaign = new Map<string, Record<LeadVerdict | "leads", number>>();
  const totals = zero();
  for (const row of leads) {
    const bucket = byCampaign.get(row.campaign) ?? zero();
    bucket.leads++;
    bucket[row.verdict]++;
    byCampaign.set(row.campaign, bucket);
    totals.leads++;
    totals[row.verdict]++;
  }

  const windowCalls = allCalls.filter((c) => c.direction === "outbound" && c.start >= windowStart && c.start < windowEnd);
  return {
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    totals: {
      ...totals,
      claims: claims.length,
      claimsBacked: claims.filter((c) => c.verdict === "backed").length,
      calls: windowCalls.length,
      realCalls: windowCalls.filter((c) => c.duration >= CUT_SECONDS).length,
    },
    campaigns: [...byCampaign.entries()].map(([name, n]) => ({ name, ...n })).sort((a, b) => b.leads - a.leads),
    leads,
    claims,
    voicemails: input.voicemails
      .filter((vm) => vm.at >= windowStart && vm.at < windowEnd)
      .map((vm) => ({
        phone: vm.phoneKey,
        at: vm.at.toISOString(),
        duration: vm.duration,
        transcript: vm.transcript,
        returned: callsBetween(vm.phoneKey, new Date(+vm.at - 60_000), windowEnd).length > 0,
      })),
  };
}
