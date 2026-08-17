"use server";

import { revalidateCompany } from "@/lib/cache/revalidate";
import { requireAuth } from "@/lib/auth/session";
import {
  requireCompanyAccess,
  requireCompanyFeature,
  shouldScopeLeadsToOwner,
} from "@/lib/auth/access";
import { logAudit } from "@/lib/db/audit";
import { getSql } from "@/lib/db/client";
import { createNotification } from "@/lib/db/notifications";
import type { LeadPriority, LeadStatus, SessionUser } from "@/types";

async function assertLeadWritable(
  user: SessionUser,
  companyId: string,
  leadId: string
): Promise<{ error: string } | null> {
  const sql = getSql();
  if (shouldScopeLeadsToOwner(user.roles)) {
    const rows = await sql`
      SELECT 1 FROM leads
      WHERE id = ${leadId}
        AND company_id = ${companyId}
        AND owner_id = ${user.id}
      LIMIT 1
    `;
    if (!rows[0]) return { error: "Forbidden: not your lead" };
    return null;
  }
  const rows = await sql`
    SELECT 1 FROM leads
    WHERE id = ${leadId} AND company_id = ${companyId}
    LIMIT 1
  `;
  if (!rows[0]) return { error: "Lead not found" };
  return null;
}

export async function createLeadAction(companyId: string, formData: FormData) {
  const user = await requireAuth();
  requireCompanyFeature(user, "leads");
  await requireCompanyAccess(user, companyId);

  const firstName = String(formData.get("firstName") ?? "").trim();
  if (!firstName) return { error: "First name required" };

  const sql = getSql();
  const rows = await sql`
    INSERT INTO leads (company_id, owner_id, first_name, last_name, email, phone, source, status, priority, notes)
    VALUES (
      ${companyId}, ${user.id},
      ${firstName},
      ${String(formData.get("lastName") ?? "") || null},
      ${String(formData.get("email") ?? "") || null},
      ${String(formData.get("phone") ?? "") || null},
      ${String(formData.get("source") ?? "") || null},
      ${(String(formData.get("status") ?? "new") as LeadStatus)},
      ${(String(formData.get("priority") ?? "medium") as LeadPriority)},
      ${String(formData.get("notes") ?? "") || null}
    )
    RETURNING id
  `;

  const leadId = rows[0].id as string;

  await logAudit({
    userId: user.id,
    companyId,
    action: "lead.created",
    resourceType: "lead",
    resourceId: leadId,
    newValues: { firstName },
  });

  // Notify managers/admins on this company about the new lead.
  const managers = await sql`
    SELECT DISTINCT p.id
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.id
    JOIN company_members cm ON cm.user_id = p.id
    WHERE cm.company_id = ${companyId}
      AND ur.role IN ('god_mode', 'admin', 'manager')
      AND p.approval_status = 'approved'
      AND p.id != ${user.id}
  `;
  const company = await sql`SELECT slug, name FROM companies WHERE id = ${companyId} LIMIT 1`;
  const slug = (company[0]?.slug as string) ?? "";
  const companyName = (company[0]?.name as string) ?? "Company";
  for (const m of managers) {
    await createNotification({
      userId: m.id as string,
      companyId,
      type: "new_lead",
      title: "New lead",
      message: `${firstName} added for ${companyName} by ${user.fullName}`,
      link: slug ? `/companies/${slug}/leads` : undefined,
    });
  }

  revalidateCompany();
  return { success: true };
}

export async function updateLeadStatusAction(
  leadId: string,
  companyId: string,
  status: LeadStatus
) {
  const user = await requireAuth();
  requireCompanyFeature(user, "leads");
  await requireCompanyAccess(user, companyId);
  const denied = await assertLeadWritable(user, companyId, leadId);
  if (denied) return denied;

  const sql = getSql();
  await sql`
    UPDATE leads SET status = ${status}, updated_at = now()
    WHERE id = ${leadId} AND company_id = ${companyId}
  `;
  revalidateCompany();
  return { success: true };
}

export async function addLeadActivityAction(
  leadId: string,
  companyId: string,
  title: string,
  description: string,
  activityType: string
) {
  const user = await requireAuth();
  requireCompanyFeature(user, "leads");
  await requireCompanyAccess(user, companyId);
  const denied = await assertLeadWritable(user, companyId, leadId);
  if (denied) return denied;

  const sql = getSql();
  await sql`
    INSERT INTO lead_activities (lead_id, user_id, activity_type, title, description)
    VALUES (${leadId}, ${user.id}, ${activityType}, ${title}, ${description})
  `;
  await sql`
    UPDATE leads SET last_contact_at = now(), updated_at = now()
    WHERE id = ${leadId} AND company_id = ${companyId}
  `;
  revalidateCompany();
  return { success: true };
}
