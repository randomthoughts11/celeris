import { getSql } from "./client";
import { hasPermission } from "@/lib/rbac/permissions";
import type { SessionUser, VaultCategory, VaultEntry } from "@/types";

/** God mode and admins can see and manage every vault entry. */
export function isVaultAdmin(user: SessionUser): boolean {
  return hasPermission(user.roles, "MANAGE_USERS");
}

function mapEntry(row: Record<string, unknown>, user: SessionUser): VaultEntry {
  const createdBy = (row.created_by as string) ?? null;
  return {
    id: row.id as string,
    company_id: (row.company_id as string) ?? null,
    company_name: (row.company_name as string) ?? null,
    created_by: createdBy,
    created_by_name: (row.created_by_name as string) ?? null,
    title: row.title as string,
    category: (row.category as VaultCategory) ?? "other",
    username: (row.username as string) ?? null,
    url: (row.url as string) ?? null,
    notes: (row.notes as string) ?? null,
    shared_with: Array.isArray(row.shared_with)
      ? (row.shared_with as Array<{ id: string; name: string }>)
      : [],
    can_manage: isVaultAdmin(user) || createdBy === user.id,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

/**
 * Entries visible to the user: everything for vault admins, otherwise
 * entries they created plus entries explicitly shared with them.
 */
export async function listVaultEntries(
  user: SessionUser
): Promise<VaultEntry[]> {
  const sql = getSql();
  const admin = isVaultAdmin(user);
  const rows = admin
    ? await sql`
        SELECT v.*,
          c.name AS company_name,
          p.full_name AS created_by_name,
          COALESCE(
            (
              SELECT json_agg(json_build_object('id', sp.id, 'name', sp.full_name))
              FROM vault_credential_access va
              JOIN profiles sp ON sp.id = va.user_id
              WHERE va.credential_id = v.id
            ),
            '[]'::json
          ) AS shared_with
        FROM vault_credentials v
        LEFT JOIN companies c ON c.id = v.company_id
        LEFT JOIN profiles p ON p.id = v.created_by
        ORDER BY v.updated_at DESC
      `
    : await sql`
        SELECT v.*,
          c.name AS company_name,
          p.full_name AS created_by_name,
          COALESCE(
            (
              SELECT json_agg(json_build_object('id', sp.id, 'name', sp.full_name))
              FROM vault_credential_access va
              JOIN profiles sp ON sp.id = va.user_id
              WHERE va.credential_id = v.id
            ),
            '[]'::json
          ) AS shared_with
        FROM vault_credentials v
        LEFT JOIN companies c ON c.id = v.company_id
        LEFT JOIN profiles p ON p.id = v.created_by
        WHERE v.created_by = ${user.id}
          OR EXISTS (
            SELECT 1 FROM vault_credential_access va
            WHERE va.credential_id = v.id AND va.user_id = ${user.id}
          )
        ORDER BY v.updated_at DESC
      `;
  return rows.map((r) => mapEntry(r, user));
}

/** True if the user may view/reveal this entry (admin, creator, or shared). */
export async function canViewVaultEntry(
  user: SessionUser,
  credentialId: string
): Promise<boolean> {
  if (isVaultAdmin(user)) return true;
  const sql = getSql();
  const rows = await sql`
    SELECT 1 FROM vault_credentials v
    WHERE v.id = ${credentialId}
      AND (
        v.created_by = ${user.id}
        OR EXISTS (
          SELECT 1 FROM vault_credential_access va
          WHERE va.credential_id = v.id AND va.user_id = ${user.id}
        )
      )
  `;
  return Boolean(rows[0]);
}

/** True if the user may edit/delete/share this entry (admin or creator). */
export async function canManageVaultEntry(
  user: SessionUser,
  credentialId: string
): Promise<boolean> {
  if (isVaultAdmin(user)) return true;
  const sql = getSql();
  const rows = await sql`
    SELECT 1 FROM vault_credentials
    WHERE id = ${credentialId} AND created_by = ${user.id}
  `;
  return Boolean(rows[0]);
}

export async function getEncryptedPassword(
  credentialId: string
): Promise<string | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT password_encrypted FROM vault_credentials WHERE id = ${credentialId}
  `;
  return (rows[0]?.password_encrypted as string) ?? null;
}

export async function setVaultShares(
  credentialId: string,
  userIds: string[],
  grantedBy: string
): Promise<void> {
  const sql = getSql();
  await sql`
    DELETE FROM vault_credential_access WHERE credential_id = ${credentialId}
  `;
  for (const userId of userIds) {
    await sql`
      INSERT INTO vault_credential_access (credential_id, user_id, granted_by)
      VALUES (${credentialId}, ${userId}, ${grantedBy})
      ON CONFLICT DO NOTHING
    `;
  }
}
