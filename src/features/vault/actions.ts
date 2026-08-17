"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import {
  canAccessCompany,
  getAccessibleCompanyIds,
  requireCompanyAccess,
} from "@/lib/auth/access";
import { isTelecallerFocused } from "@/lib/rbac/nav";
import { logAudit } from "@/lib/db/audit";
import { getSql } from "@/lib/db/client";
import {
  canManageVaultEntry,
  canViewVaultEntry,
  getEncryptedPassword,
  setVaultShares,
} from "@/lib/db/vault";
import { decrypt, encrypt } from "@/lib/crypto";

function readEntryForm(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim(),
    category: String(formData.get("category") ?? "other"),
    username: String(formData.get("username") ?? "").trim() || null,
    password: String(formData.get("password") ?? ""),
    url: String(formData.get("url") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    companyId: String(formData.get("companyId") ?? "") || null,
  };
}

async function assertCompanyTag(
  user: Awaited<ReturnType<typeof requireAuth>>,
  companyId: string | null
): Promise<{ error: string } | null> {
  if (!companyId) return null;
  if (!(await canAccessCompany(user, companyId))) {
    return { error: "You don't have access to that company" };
  }
  return null;
}

/** Share targets must be approved; if entry is company-tagged, must be members. */
async function filterShareTargets(
  credentialId: string,
  userIds: string[]
): Promise<string[]> {
  if (userIds.length === 0) return [];
  const sql = getSql();
  const entry = await sql`
    SELECT company_id FROM vault_credentials WHERE id = ${credentialId} LIMIT 1
  `;
  const companyId = (entry[0]?.company_id as string | null) ?? null;

  const approved = await sql`
    SELECT id FROM profiles
    WHERE approval_status = 'approved'
      AND is_active = true
      AND id = ANY(${userIds}::uuid[])
  `;
  let allowed = new Set(approved.map((r) => r.id as string));

  if (companyId) {
    const members = await sql`
      SELECT user_id FROM company_members WHERE company_id = ${companyId}
    `;
    const memberSet = new Set(members.map((r) => r.user_id as string));
    // Admins/god may still be shared even without membership — keep approved ∩ requested ∩ (members ∪ already filtered)
    allowed = new Set([...allowed].filter((id) => memberSet.has(id)));
  }

  return userIds.filter((id) => allowed.has(id));
}

export async function createVaultEntryAction(formData: FormData) {
  const user = await requireAuth();
  if (isTelecallerFocused(user.roles)) return { error: "Forbidden" };
  const entry = readEntryForm(formData);
  if (!entry.title) return { error: "Title required" };
  if (!entry.password) return { error: "Password required" };

  const denied = await assertCompanyTag(user, entry.companyId);
  if (denied) return denied;

  const sql = getSql();
  const rows = await sql`
    INSERT INTO vault_credentials
      (company_id, created_by, title, category, username, password_encrypted, url, notes)
    VALUES (
      ${entry.companyId}, ${user.id}, ${entry.title}, ${entry.category},
      ${entry.username}, ${encrypt(entry.password)}, ${entry.url}, ${entry.notes}
    )
    RETURNING id
  `;

  await logAudit({
    userId: user.id,
    companyId: entry.companyId ?? undefined,
    action: "vault.created",
    resourceType: "vault_credential",
    resourceId: rows[0].id as string,
    newValues: { title: entry.title },
  });
  revalidatePath("/vault");
  return { success: true };
}

export async function updateVaultEntryAction(
  credentialId: string,
  formData: FormData
) {
  const user = await requireAuth();
  if (!(await canManageVaultEntry(user, credentialId))) {
    return { error: "You can't edit this entry" };
  }
  const entry = readEntryForm(formData);
  if (!entry.title) return { error: "Title required" };

  const denied = await assertCompanyTag(user, entry.companyId);
  if (denied) return denied;

  const sql = getSql();
  if (entry.password) {
    await sql`
      UPDATE vault_credentials SET
        title = ${entry.title}, category = ${entry.category},
        username = ${entry.username}, password_encrypted = ${encrypt(entry.password)},
        url = ${entry.url}, notes = ${entry.notes}, company_id = ${entry.companyId},
        updated_at = now()
      WHERE id = ${credentialId}
    `;
  } else {
    await sql`
      UPDATE vault_credentials SET
        title = ${entry.title}, category = ${entry.category},
        username = ${entry.username}, url = ${entry.url}, notes = ${entry.notes},
        company_id = ${entry.companyId}, updated_at = now()
      WHERE id = ${credentialId}
    `;
  }

  await logAudit({
    userId: user.id,
    companyId: entry.companyId ?? undefined,
    action: "vault.updated",
    resourceType: "vault_credential",
    resourceId: credentialId,
    newValues: { title: entry.title, passwordChanged: Boolean(entry.password) },
  });
  revalidatePath("/vault");
  return { success: true };
}

export async function deleteVaultEntryAction(credentialId: string) {
  const user = await requireAuth();
  if (!(await canManageVaultEntry(user, credentialId))) {
    return { error: "You can't delete this entry" };
  }
  const sql = getSql();
  await sql`DELETE FROM vault_credentials WHERE id = ${credentialId}`;

  await logAudit({
    userId: user.id,
    action: "vault.deleted",
    resourceType: "vault_credential",
    resourceId: credentialId,
  });
  revalidatePath("/vault");
  return { success: true };
}

export async function setVaultSharesAction(
  credentialId: string,
  userIds: string[]
) {
  const user = await requireAuth();
  if (!(await canManageVaultEntry(user, credentialId))) {
    return { error: "You can't share this entry" };
  }
  const filtered = await filterShareTargets(credentialId, userIds);
  await setVaultShares(credentialId, filtered, user.id);

  await logAudit({
    userId: user.id,
    action: "vault.shared",
    resourceType: "vault_credential",
    resourceId: credentialId,
    newValues: { sharedWith: filtered },
  });
  revalidatePath("/vault");
  return { success: true };
}

/** Returns the decrypted password. Every reveal is audit-logged. */
export async function revealVaultPasswordAction(credentialId: string) {
  const user = await requireAuth();
  if (!(await canViewVaultEntry(user, credentialId))) {
    return { error: "You don't have access to this credential" };
  }
  const encrypted = await getEncryptedPassword(credentialId);
  if (!encrypted) return { error: "Entry not found" };

  let password: string;
  try {
    password = decrypt(encrypted);
  } catch {
    return {
      error:
        "Could not decrypt — the encryption key has changed since this entry was saved",
    };
  }

  await logAudit({
    userId: user.id,
    action: "vault.revealed",
    resourceType: "vault_credential",
    resourceId: credentialId,
  });
  return { password };
}

export async function listShareableVaultUsersAction(companyId: string | null) {
  const user = await requireAuth();
  const sql = getSql();

  if (companyId) {
    await requireCompanyAccess(user, companyId);
    const rows = await sql`
      SELECT p.id, p.full_name
      FROM profiles p
      JOIN company_members cm ON cm.user_id = p.id
      WHERE cm.company_id = ${companyId}
        AND p.approval_status = 'approved'
        AND p.is_active = true
      ORDER BY p.full_name
    `;
    return rows.map((r) => ({ id: r.id as string, name: r.full_name as string }));
  }

  const accessible = await getAccessibleCompanyIds(user);
  if (accessible === "all") {
    const rows = await sql`
      SELECT id, full_name FROM profiles
      WHERE approval_status = 'approved' AND is_active = true
      ORDER BY full_name
    `;
    return rows.map((r) => ({ id: r.id as string, name: r.full_name as string }));
  }

  if (accessible.length === 0) {
    return [{ id: user.id, name: user.fullName }];
  }

  const rows = await sql`
    SELECT DISTINCT p.id, p.full_name
    FROM profiles p
    JOIN company_members cm ON cm.user_id = p.id
    WHERE cm.company_id = ANY(${accessible}::uuid[])
      AND p.approval_status = 'approved'
      AND p.is_active = true
    ORDER BY p.full_name
  `;
  return rows.map((r) => ({ id: r.id as string, name: r.full_name as string }));
}
