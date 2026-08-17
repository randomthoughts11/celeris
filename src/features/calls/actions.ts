"use server";

import { revalidateCompany } from "@/lib/cache/revalidate";
import { randomUUID } from "crypto";
import { requireAuth } from "@/lib/auth/session";
import {
  requireCompanyAccess,
  requireCompanyFeature,
  shouldScopeLeadsToOwner,
} from "@/lib/auth/access";
import { getSql } from "@/lib/db/client";

export async function logManualCallAction(
  companyId: string,
  input: {
    leadId?: string;
    direction: "inbound" | "outbound";
    outcome: string;
    phone: string;
    durationSeconds?: number;
    notes?: string;
  }
) {
  const user = await requireAuth();
  requireCompanyFeature(user, "calls");
  await requireCompanyAccess(user, companyId);

  const sql = getSql();

  if (input.leadId) {
    if (shouldScopeLeadsToOwner(user.roles)) {
      const owned = await sql`
        SELECT 1 FROM leads
        WHERE id = ${input.leadId}
          AND company_id = ${companyId}
          AND owner_id = ${user.id}
        LIMIT 1
      `;
      if (!owned[0]) return { error: "Forbidden: not your lead" };
    } else {
      const exists = await sql`
        SELECT 1 FROM leads
        WHERE id = ${input.leadId} AND company_id = ${companyId}
        LIMIT 1
      `;
      if (!exists[0]) return { error: "Lead not found" };
    }
  }

  const externalId = `manual-${randomUUID()}`;

  await sql`
    INSERT INTO ringcentral_calls (
      company_id, lead_id, external_id, direction, outcome,
      caller, receiver, duration_seconds, notes, agent_id, started_at, metadata
    ) VALUES (
      ${companyId},
      ${input.leadId ?? null},
      ${externalId},
      ${input.direction},
      ${input.outcome},
      ${input.direction === "inbound" ? input.phone : user.fullName},
      ${input.direction === "outbound" ? input.phone : user.fullName},
      ${input.durationSeconds ?? 0},
      ${input.notes ?? null},
      ${user.id},
      now(),
      ${JSON.stringify({ source: "manual", logged_by: user.id })}
    )
  `;

  if (input.leadId) {
    await sql`
      INSERT INTO lead_activities (lead_id, user_id, activity_type, title, description)
      VALUES (
        ${input.leadId}, ${user.id}, 'call',
        ${`${input.direction === "outbound" ? "Outbound" : "Inbound"} call — ${input.outcome}`},
        ${input.notes ?? `Duration: ${input.durationSeconds ?? 0}s`}
      )
    `;
    await sql`
      UPDATE leads SET last_contact_at = now(),
        status = CASE WHEN status = 'new' THEN 'contacted' ELSE status END,
        updated_at = now()
      WHERE id = ${input.leadId} AND company_id = ${companyId}
    `;
  }

  revalidateCompany();
  return { success: true };
}
