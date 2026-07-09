"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { requireAuth } from "@/lib/auth/session";
import { requireCompanyAccess } from "@/lib/auth/access";
import { hasPermission } from "@/lib/rbac/permissions";
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
  if (!hasPermission(user.roles, "LOG_CALLS")) {
    return { error: "Forbidden" };
  }
  await requireCompanyAccess(user, companyId);

  const sql = getSql();
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
      UPDATE leads SET last_contact_at = now(), status = CASE WHEN status = 'new' THEN 'contacted' ELSE status END, updated_at = now()
      WHERE id = ${input.leadId}
    `;
  }

  revalidatePath(`/companies`);
  return { success: true };
}
