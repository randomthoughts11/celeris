"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { requireCompanyAccess } from "@/lib/auth/access";
import { getSql } from "@/lib/db/client";
import type { LeadPriority, LeadStatus } from "@/types";

export async function createLeadAction(companyId: string, formData: FormData) {
  const user = await requireAuth();
  await requireCompanyAccess(user, companyId);

  const firstName = String(formData.get("firstName") ?? "").trim();
  if (!firstName) return { error: "First name required" };

  const sql = getSql();
  await sql`
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
  `;

  revalidatePath(`/companies`);
  return { success: true };
}

export async function updateLeadStatusAction(
  leadId: string,
  companyId: string,
  status: LeadStatus
) {
  const user = await requireAuth();
  await requireCompanyAccess(user, companyId);
  const sql = getSql();
  await sql`UPDATE leads SET status = ${status}, updated_at = now() WHERE id = ${leadId} AND company_id = ${companyId}`;
  revalidatePath(`/companies`);
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
  await requireCompanyAccess(user, companyId);
  const sql = getSql();
  await sql`
    INSERT INTO lead_activities (lead_id, user_id, activity_type, title, description)
    VALUES (${leadId}, ${user.id}, ${activityType}, ${title}, ${description})
  `;
  await sql`UPDATE leads SET last_contact_at = now(), updated_at = now() WHERE id = ${leadId}`;
  revalidatePath(`/companies`);
  return { success: true };
}
