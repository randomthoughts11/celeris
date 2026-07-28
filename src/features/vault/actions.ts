"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
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

export async function createVaultEntryAction(formData: FormData) {
  const user = await requireAuth();
  const entry = readEntryForm(formData);
  if (!entry.title) return { error: "Title required" };
  if (!entry.password) return { error: "Password required" };

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

  const sql = getSql();
  // Blank password field means "keep the existing password".
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
  await setVaultShares(credentialId, userIds, user.id);

  await logAudit({
    userId: user.id,
    action: "vault.shared",
    resourceType: "vault_credential",
    resourceId: credentialId,
    newValues: { sharedWith: userIds },
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
