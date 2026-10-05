import { getSql } from "@/lib/db/client";
import { META_API, getMetaAccessToken } from "@/lib/integrations/meta-agency";
import { phoneKey } from "@/lib/call-audit/engine";

interface GraphLead {
  id: string;
  created_time: string;
  ad_id?: string;
  ad_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  form_id?: string;
  field_data?: Array<{ name: string; values?: string[] }>;
}

async function graph<T>(url: string): Promise<T[]> {
  const out: T[] = [];
  let next: string | undefined = url;
  for (let i = 0; next && i < 20; i++) {
    const res: Response = await fetch(next);
    if (!res.ok) throw new Error(`Meta leads failed: ${(await res.text()).slice(0, 300)}`);
    const body = (await res.json()) as { data?: T[]; paging?: { next?: string } };
    out.push(...(body.data ?? []));
    next = body.paging?.next;
  }
  return out;
}

const day = (d: Date) => d.toISOString().slice(0, 10);

/** Store every lead-form lead created since `since` for ads that produced leads. Returns the count fetched. */
export async function syncMetaLeads(companyId: string, adAccountId: string, since: Date): Promise<number> {
  const token = await getMetaAccessToken();
  const range = JSON.stringify({ since: day(new Date(+since - 86_400_000)), until: day(new Date(Date.now() + 86_400_000)) });
  const rows = await graph<{ ad_id: string; actions?: Array<{ action_type: string; value: string }> }>(
    `${META_API}/act_${adAccountId}/insights?level=ad&fields=ad_id,actions&time_range=${encodeURIComponent(range)}&limit=500&access_token=${token}`
  );
  const adIds = rows
    .filter((r) => r.actions?.some((a) => /lead/.test(a.action_type) && Number(a.value) > 0))
    .map((r) => r.ad_id);

  const filter = encodeURIComponent(
    JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: Math.floor(+since / 1000) }])
  );
  const sql = getSql();
  let count = 0;
  for (const adId of adIds) {
    const leads = await graph<GraphLead>(
      `${META_API}/${adId}/leads?fields=id,created_time,ad_id,ad_name,campaign_id,campaign_name,form_id,field_data&filtering=${filter}&limit=500&access_token=${token}`
    );
    for (const l of leads) {
      const field = (re: RegExp) => l.field_data?.find((f) => re.test(f.name))?.values?.[0] ?? "";
      const name = field(/^full_?name$/i) || [field(/^first_?name$/i), field(/^last_?name$/i)].filter(Boolean).join(" ");
      const phone = field(/phone/i);
      await sql`
        INSERT INTO meta_leads (company_id, external_id, ad_external_id, ad_name, campaign_external_id, campaign_name, form_id,
          full_name, phone, phone_key, email, lead_created_at, raw)
        VALUES (${companyId}, ${l.id}, ${l.ad_id ?? adId}, ${l.ad_name ?? null}, ${l.campaign_id ?? null}, ${l.campaign_name ?? null},
          ${l.form_id ?? null}, ${name || null}, ${phone || null}, ${phoneKey(phone) || null}, ${field(/email/i) || null},
          ${l.created_time}, ${JSON.stringify(l)})
        ON CONFLICT (company_id, external_id) DO NOTHING
      `;
      count++;
    }
  }
  return count;
}
