import { getSql } from "@/lib/db/client";
import { phoneKey, type Claim } from "@/lib/call-audit/engine";

const PRIVYR_API = "https://web.privyr.com/api/dashboard-v2/api/v2";

type TimelineItem = {
  id: number;
  title: string;
  item_type: string;
  activity_date: number;
  type_specific_data?: { description?: string | null } | null;
  client?: { id: number; name: string } | null;
};

/**
 * Pull Privyr's activity timeline into privyr_activities, reading the web app's API with the
 * logged-in session cookie (PRIVYR_SESSION = the pss_system_id cookie). Privyr has no read API.
 */
export async function syncPrivyr(companyId: string, since: Date): Promise<number> {
  const session = process.env.PRIVYR_SESSION;
  if (!session) return 0;
  const get = async (path: string) => {
    const res = await fetch(`${PRIVYR_API}${path}`, { headers: { cookie: `pss_system_id=${session}`, accept: "application/json" } });
    if (res.status === 401 || res.status === 403) throw new Error("The Privyr login has expired. Log in to web.privyr.com again and refresh PRIVYR_SESSION.");
    if (!res.ok) throw new Error(`Privyr returned ${res.status}`);
    return res.json();
  };

  const items: TimelineItem[] = [];
  let next = "";
  for (let page = 0; page < 50; page++) {
    const data = await get(`/user-timeline/?ignore_prefs=true&next=${encodeURIComponent(next)}&start_date=${Math.floor(+since / 1000)}`);
    items.push(...(data.results ?? []));
    if (!data.next || !data.results?.length || data.next === next) break;
    next = data.next;
  }

  const sql = getSql();
  const phones = new Map<number, string | null>();
  for (const it of items) {
    const clientId = it.client?.id;
    if (clientId && !phones.has(clientId)) {
      const client = await get(`/user-client/${clientId}/`);
      phones.set(clientId, phoneKey(client.phone_number?.raw_input ?? client.whatsapp_number?.raw_input ?? ""));
    }
    await sql`
      INSERT INTO privyr_activities (company_id, external_id, client_name, phone_key, activity_type, title, notes, activity_at, raw)
      VALUES (${companyId}, ${String(it.id)}, ${it.client?.name ?? null}, ${clientId ? phones.get(clientId) ?? null : null},
              ${it.item_type}, ${it.title}, ${it.type_specific_data?.description ?? null},
              ${new Date(it.activity_date * 1000).toISOString()}, ${JSON.stringify(it)})
      ON CONFLICT (company_id, external_id) DO UPDATE SET
        notes = EXCLUDED.notes, phone_key = COALESCE(EXCLUDED.phone_key, privyr_activities.phone_key), raw = EXCLUDED.raw
    `;
  }
  return items.length;
}

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
