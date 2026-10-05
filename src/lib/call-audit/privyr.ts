import { getSql } from "@/lib/db/client";
import type { Claim } from "@/lib/call-audit/engine";

/** Privyr activities since `since` as claims. Returns null when nothing has ever been synced. */
export async function privyrClaims(companyId: string, since: Date): Promise<Claim[] | null> {
  const sql = getSql();
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM privyr_activities WHERE company_id = ${companyId}`;
  if (!n) return null;
  const rows = await sql`
    SELECT client_name, phone_key, activity_type, title, notes, activity_at FROM privyr_activities
    WHERE company_id = ${companyId} AND activity_at >= ${since.toISOString()} AND phone_key IS NOT NULL
  `;
  return rows.flatMap((r): Claim[] => {
    const type = String(r.activity_type).toLowerCase();
    const text = [r.title, r.notes].filter(Boolean).join(" — ");
    const isCall = /phone|call/.test(type);
    if (!isCall && !/message|whatsapp|sms|email/.test(type)) return [];
    const spoke = isCall && !/did ?n.?t|not received|no answer|busy/i.test(text) && /receiv|spoke|talk|connect|answer/i.test(text);
    return [{
      phoneKey: String(r.phone_key),
      name: String(r.client_name ?? r.phone_key),
      source: "privyr",
      kind: spoke ? "conversation" : isCall ? "call" : "message",
      at: new Date(r.activity_at as string),
      day: null,
      text: `${type}${text ? `: ${text}` : ""}`,
    }];
  });
}
