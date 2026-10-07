import { getSql } from "@/lib/db/client";
import { callAuditViewers } from "@/lib/call-audit/access";
import { istDay, judge, SLA_MINUTES, type CallAuditReport, type Claim } from "@/lib/call-audit/engine";
import { syncMetaLeads } from "@/lib/call-audit/meta-leads";
import { privyrClaims, syncPrivyr } from "@/lib/call-audit/privyr";
import { fetchRingCentral, relayRingCentral, ringCentralConfigured } from "@/lib/call-audit/ringcentral";
import { fetchSheetClaims } from "@/lib/call-audit/sheet";

const HOUR = 3_600_000;

export type StoredReport = CallAuditReport & {
  inconclusive?: string;
  warnings: string[];
  sources: { metaLeads: number; calls: number; voicemails: number; privyr: number | null; sheetClaims: number | null };
};

/** 12 AM, 4 AM, 12 PM, 4 PM IST as UTC hours (all at :30). Keep in sync with vercel.json. */
const BOUNDARY_UTC_HOURS = [22, 18, 10, 6];

/** Most recent audit boundary at or before `now`. */
export function lastBoundary(now: Date): Date {
  const d = new Date(now);
  d.setUTCSeconds(0, 0);
  const minutes = d.getUTCHours() * 60 + d.getUTCMinutes();
  const hour = BOUNDARY_UTC_HOURS.find((h) => minutes >= h * 60 + 30);
  if (hour === undefined) d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCHours(hour ?? BOUNDARY_UTC_HOURS[0], 30);
  return d;
}

export async function callAuditCompany(): Promise<{ id: string; name: string; adAccountId: string | null } | null> {
  const sql = getSql();
  const [row] = await sql`
    SELECT c.id, c.name, i.config->>'adAccountId' AS ad_account_id
    FROM companies c LEFT JOIN integrations i ON i.company_id = c.id AND i.provider = 'meta_ads'
    WHERE c.slug = ${process.env.CALL_AUDIT_COMPANY_SLUG || "vande-wellness-us"}
  `;
  return row ? { id: row.id as string, name: row.name as string, adAccountId: (row.ad_account_id as string) ?? null } : null;
}

export async function runCallAudit(
  windowEnd = lastBoundary(new Date()),
  notify = true
): Promise<{ runId: string; report: StoredReport }> {
  const company = await callAuditCompany();
  if (!company) throw new Error("Call audit brand not found. Set CALL_AUDIT_COMPANY_SLUG.");
  const windowStart = lastBoundary(new Date(+windowEnd - 60_000));
  const leadFrom = new Date(+windowStart - SLA_MINUTES * 60_000);
  const pullFrom = new Date(+windowEnd - 48 * HOUR);
  // Date-only sheet rows for yesterday are checked at the noon run, once the night shift is over.
  const sheetDay = windowEnd.getUTCHours() === 6 ? istDay(new Date(+windowEnd - 24 * HOUR)) : null;
  const warnings: string[] = [];
  const sql = getSql();

  let metaFetched = 0;
  if (company.adAccountId) {
    try {
      metaFetched = await syncMetaLeads(company.id, company.adAccountId, pullFrom);
    } catch (e) {
      warnings.push(`Meta leads: ${e instanceof Error ? e.message : e}. Reconnect Meta in Settings if this says permission.`);
    }
  } else warnings.push("No Meta ad account is linked to this brand.");

  const leadRows = await sql`
    SELECT external_id, full_name, phone, phone_key, campaign_name, lead_created_at FROM meta_leads
    WHERE company_id = ${company.id} AND lead_created_at >= ${leadFrom.toISOString()} AND lead_created_at < ${windowEnd.toISOString()}
    ORDER BY lead_created_at
  `;
  const leads = leadRows
    .filter((r) => r.phone_key)
    .map((r) => ({
      id: r.external_id as string,
      name: (r.full_name as string) || "Unnamed",
      phone: r.phone as string,
      phoneKey: r.phone_key as string,
      campaign: (r.campaign_name as string) || "Unknown campaign",
      createdAt: new Date(r.lead_created_at as string),
    }));
  if (leadRows.length > leads.length) warnings.push(`${leadRows.length - leads.length} leads had no usable phone number and were skipped.`);

  const claims: Claim[] = [];
  let privyrCount: number | null = null;
  try {
    await syncPrivyr(company.id, pullFrom);
    const p = await privyrClaims(company.id, pullFrom);
    if (p) {
      claims.push(...p);
      privyrCount = p.length;
    } else warnings.push("Privyr is not connected yet, so Privyr activities are not in this report.");
  } catch (e) {
    warnings.push(`Privyr: ${e instanceof Error ? e.message : e}`);
  }

  let sheetCount: number | null = null;
  const links = (process.env.CALL_AUDIT_SHEET_URLS ?? "").split(/[\s,]+/).filter(Boolean);
  if (links.length) {
    try {
      const s = await fetchSheetClaims(links, istDay(pullFrom));
      claims.push(...s.claims);
      sheetCount = s.claims.length;
    } catch (e) {
      warnings.push(`Sheet: ${e instanceof Error ? e.message : e}`);
    }
  } else warnings.push("No sheet link is set (CALL_AUDIT_SHEET_URLS), so sheet claims are not in this report.");

  let report: StoredReport;
  const sources = { metaLeads: metaFetched, calls: 0, voicemails: 0, privyr: privyrCount, sheetClaims: sheetCount };
  const unchecked = () => judge({ windowStart, windowEnd, leads, claims, calls: null, voicemails: [], sheetDay });
  let rc: Awaited<ReturnType<typeof relayRingCentral>> = null;
  let rcError: unknown = null;
  try {
    rc = ringCentralConfigured() ? await fetchRingCentral(company.id, pullFrom, windowEnd) : await relayRingCentral(company.id, pullFrom, windowEnd);
  } catch (e) {
    rcError = e;
  }
  if (rcError) {
    report = { ...unchecked(), warnings, sources, inconclusive: `RingCentral could not be read: ${rcError instanceof Error ? rcError.message : rcError}. Nobody was judged.` };
  } else if (!rc) {
    report = {
      ...unchecked(),
      warnings,
      sources,
      inconclusive: "RingCentral is not connected yet. The leads below are real, but none of them can be checked against calls until it is.",
    };
  } else {
    sources.calls = rc.calls.length;
    sources.voicemails = rc.voicemails.length;
    report = { ...judge({ windowStart, windowEnd, leads, claims, calls: rc.calls, voicemails: rc.voicemails, sheetDay }), warnings, sources };
    if (!rc.calls.length && (leads.length || claims.length)) {
      report.inconclusive =
        "RingCentral returned no calls at all for the last 48 hours. That usually means the key points at the wrong extension, so the verdicts below should not be trusted.";
    }
  }

  const [run] = await sql`
    INSERT INTO call_audit_runs (company_id, window_start, window_end, report)
    VALUES (${company.id}, ${windowStart.toISOString()}, ${windowEnd.toISOString()}, ${JSON.stringify(report)})
    ON CONFLICT (company_id, window_end) DO UPDATE SET report = EXCLUDED.report, created_at = now()
    RETURNING id
  `;
  const runId = run.id as string;

  const t = report.totals;
  const message = report.inconclusive
    ? `${t.leads} new leads, not checked yet. ${report.inconclusive}`
    : `${t.leads} new leads: ${t.verified} called, ${t.cut_short} cut under 20s, ${t.claimed_no_call} claimed with no call, ${t.untouched} untouched. ${t.claimsBacked} of ${t.claims} logged calls backed by RingCentral.`;
  const viewers = callAuditViewers();
  if (notify && viewers.length) {
    await sql`
      INSERT INTO notifications (user_id, company_id, type, title, message, link)
      SELECT id, ${company.id}, 'system', 'Call audit ready', ${message}, ${`/call-audit?run=${runId}`}
      FROM profiles WHERE lower(email) = ANY(${viewers})
    `;
  }
  return { runId, report };
}
