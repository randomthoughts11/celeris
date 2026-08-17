import { getSql } from "./client";
import type { AdminUser, ApprovalStatus, Profile, SessionUser, UserRole } from "@/types";
import { hasPermission } from "@/lib/rbac/permissions";

export interface DbUser extends Profile {
  clerk_user_id?: string | null;
}

function mapProfile(row: Record<string, unknown>): Profile {
  return {
    id: row.id as string,
    email: row.email as string,
    full_name: row.full_name as string,
    avatar_url: (row.avatar_url as string) ?? null,
    phone: (row.phone as string) ?? null,
    is_active: row.is_active as boolean,
    approval_status: (row.approval_status as ApprovalStatus) ?? "pending",
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function ensureAppMetaTable() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

export async function getUserByEmail(email: string): Promise<DbUser | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, email, full_name, avatar_url, phone, is_active,
           approval_status, created_at, updated_at, clerk_user_id
    FROM profiles
    WHERE email = ${email.toLowerCase()} AND is_active = true
    LIMIT 1
  `;
  if (!rows[0]) return null;
  return {
    ...mapProfile(rows[0]),
    clerk_user_id: rows[0].clerk_user_id as string | null,
  };
}

export async function getUserByClerkId(clerkUserId: string): Promise<Profile | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, email, full_name, avatar_url, phone, is_active, approval_status, created_at, updated_at
    FROM profiles
    WHERE clerk_user_id = ${clerkUserId} AND is_active = true
    LIMIT 1
  `;
  return rows[0] ? mapProfile(rows[0]) : null;
}

export async function getUserById(id: string): Promise<Profile | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, email, full_name, avatar_url, phone, is_active, approval_status, created_at, updated_at
    FROM profiles
    WHERE id = ${id} AND is_active = true
    LIMIT 1
  `;
  return rows[0] ? mapProfile(rows[0]) : null;
}

export async function getUserRoles(userId: string): Promise<UserRole[]> {
  const sql = getSql();
  const rows = await sql`SELECT role FROM user_roles WHERE user_id = ${userId}`;
  return rows.map((r) => r.role as UserRole);
}

export async function getFirstApprovedAdmin(): Promise<Profile | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT p.id, p.email, p.full_name, p.avatar_url, p.phone, p.is_active,
           p.approval_status, p.created_at, p.updated_at
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.id
    WHERE p.is_active = true
      AND p.approval_status = 'approved'
      AND ur.role IN ('god_mode', 'admin')
    ORDER BY p.created_at ASC
    LIMIT 1
  `;
  return rows[0] ? mapProfile(rows[0]) : null;
}

export async function ensureProfileForClerkUser(input: {
  clerkUserId: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
}): Promise<Profile> {
  const sql = getSql();
  const existing = await getUserByClerkId(input.clerkUserId);
  if (existing) return existing;

  const byEmail = await getUserByEmail(input.email);
  if (byEmail?.clerk_user_id && byEmail.clerk_user_id !== input.clerkUserId) {
    throw new Error("This email is already linked to another account");
  }

  if (byEmail && !byEmail.clerk_user_id) {
    await sql`
      UPDATE profiles
      SET clerk_user_id = ${input.clerkUserId},
          full_name = COALESCE(NULLIF(full_name, ''), ${input.fullName}),
          avatar_url = COALESCE(avatar_url, ${input.avatarUrl}),
          approval_status = 'pending',
          updated_at = now()
      WHERE id = ${byEmail.id}
    `;
    await sql`DELETE FROM user_roles WHERE user_id = ${byEmail.id}`;
    await sql`INSERT INTO user_roles (user_id, role) VALUES (${byEmail.id}, 'designer')`;
    await notifyGodsOfSignup(input.fullName, input.email);
    const linked = await getUserByClerkId(input.clerkUserId);
    if (linked) return linked;
  }

  const rows = await sql`
    INSERT INTO profiles (email, full_name, avatar_url, clerk_user_id, approval_status)
    VALUES (${input.email.toLowerCase()}, ${input.fullName}, ${input.avatarUrl}, ${input.clerkUserId}, 'pending')
    RETURNING id, email, full_name, avatar_url, phone, is_active, approval_status, created_at, updated_at
  `;
  const profile = mapProfile(rows[0]);
  await sql`INSERT INTO user_roles (user_id, role) VALUES (${profile.id}, 'designer')`;

  await ensureAppMetaTable();
  const claimed = await sql`
    INSERT INTO app_meta (key, value)
    VALUES ('tenant_owner', ${profile.id})
    ON CONFLICT (key) DO NOTHING
    RETURNING key
  `;
  if (claimed[0]) {
    await sql`
      UPDATE profiles SET approval_status = 'approved', updated_at = now()
      WHERE id = ${profile.id}
    `;
    await sql`DELETE FROM user_roles WHERE user_id = ${profile.id}`;
    await sql`INSERT INTO user_roles (user_id, role) VALUES (${profile.id}, 'god_mode')`;
    const owner = await getUserById(profile.id);
    if (owner) return owner;
  } else {
    await notifyGodsOfSignup(input.fullName, input.email);
  }

  return profile;
}

async function notifyGodsOfSignup(fullName: string, email: string) {
  const sql = getSql();
  const godUsers = await sql`
    SELECT p.id FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.id
    WHERE ur.role = 'god_mode' AND p.approval_status = 'approved'
  `;
  for (const g of godUsers) {
    await sql`
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (
        ${g.id as string},
        'approval',
        'New user awaiting approval',
        ${`${fullName} (${email}) signed up and needs access.`},
        '/admin'
      )
    `;
  }
}

export async function listAllUsers(): Promise<AdminUser[]> {
  const sql = getSql();
  const profiles = await sql`
    SELECT id, email, full_name, avatar_url, approval_status, created_at
    FROM profiles WHERE is_active = true
    ORDER BY created_at DESC
  `;
  if (profiles.length === 0) return [];
  const ids = profiles.map((p) => p.id as string);
  const roleRows = await sql`
    SELECT user_id, role FROM user_roles WHERE user_id = ANY(${ids}::uuid[])
  `;
  const rolesByUser = new Map<string, UserRole[]>();
  for (const row of roleRows) {
    const uid = row.user_id as string;
    const list = rolesByUser.get(uid) ?? [];
    list.push(row.role as UserRole);
    rolesByUser.set(uid, list);
  }
  return profiles.map((p) => ({
    id: p.id as string,
    email: p.email as string,
    full_name: p.full_name as string,
    avatar_url: (p.avatar_url as string) ?? null,
    approval_status: (p.approval_status as ApprovalStatus) ?? "pending",
    roles: rolesByUser.get(p.id as string) ?? [],
    created_at: String(p.created_at),
  }));
}

export async function setUserApproval(
  userId: string,
  status: ApprovalStatus
): Promise<void> {
  const sql = getSql();
  await sql`UPDATE profiles SET approval_status = ${status}, updated_at = now() WHERE id = ${userId}`;

  if (status === "approved") {
    await sql`
      INSERT INTO notifications (user_id, type, title, message, link)
      SELECT id, 'system', 'Account approved', 'Your account has been approved. You can now access Agency OS.', '/'
      FROM profiles WHERE id = ${userId}
    `;
  }
}

export async function setUserRoles(userId: string, roles: UserRole[]): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM user_roles WHERE user_id = ${userId}`;
  for (const role of roles) {
    await sql`INSERT INTO user_roles (user_id, role) VALUES (${userId}, ${role})`;
  }
}

export async function listApprovedUsers(): Promise<Profile[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, email, full_name, avatar_url, phone, is_active, approval_status, created_at, updated_at
    FROM profiles WHERE is_active = true AND approval_status = 'approved'
    ORDER BY full_name
  `;
  return rows.map(mapProfile);
}

/** Coworkers who share a company, plus admins. Admins see everyone. */
export async function listDirectoryUsers(viewer: SessionUser): Promise<Profile[]> {
  if (hasPermission(viewer.roles, "MANAGE_USERS")) {
    return listApprovedUsers();
  }
  const sql = getSql();
  const rows = await sql`
    SELECT DISTINCT p.id, p.email, p.full_name, p.avatar_url, p.phone, p.is_active,
           p.approval_status, p.created_at, p.updated_at
    FROM profiles p
    WHERE p.is_active = true
      AND p.approval_status = 'approved'
      AND (
        p.id = ${viewer.id}
        OR EXISTS (
          SELECT 1 FROM company_members me
          JOIN company_members them ON them.company_id = me.company_id
          WHERE me.user_id = ${viewer.id} AND them.user_id = p.id
        )
        OR EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = p.id AND ur.role IN ('god_mode', 'admin')
        )
      )
    ORDER BY p.full_name
  `;
  return rows.map(mapProfile);
}
