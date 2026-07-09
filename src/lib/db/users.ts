import { getSql } from "./client";
import type { AdminUser, ApprovalStatus, Profile, UserRole } from "@/types";

export interface DbUser extends Profile {
  password_hash: string | null;
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

export async function getUserByEmail(email: string): Promise<DbUser | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, email, password_hash, full_name, avatar_url, phone, is_active,
           approval_status, created_at, updated_at, clerk_user_id
    FROM profiles
    WHERE email = ${email.toLowerCase()} AND is_active = true
    LIMIT 1
  `;
  if (!rows[0]) return null;
  return { ...mapProfile(rows[0]), password_hash: rows[0].password_hash as string | null, clerk_user_id: rows[0].clerk_user_id as string | null };
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

export async function countUsers(): Promise<number> {
  const sql = getSql();
  const rows = await sql`SELECT COUNT(*)::int AS count FROM profiles`;
  return (rows[0]?.count as number) ?? 0;
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
  if (byEmail) {
    await sql`
      UPDATE profiles
      SET clerk_user_id = ${input.clerkUserId},
          full_name = COALESCE(NULLIF(full_name, ''), ${input.fullName}),
          avatar_url = COALESCE(avatar_url, ${input.avatarUrl})
      WHERE id = ${byEmail.id}
    `;
    const linked = await getUserByClerkId(input.clerkUserId);
    if (linked) return linked;
  }

  const userCount = await countUsers();
  const isFirstUser = userCount === 0;
  const role: UserRole = isFirstUser ? "god_mode" : "manager";
  const approvalStatus: ApprovalStatus = isFirstUser ? "approved" : "pending";

  const rows = await sql`
    INSERT INTO profiles (email, full_name, avatar_url, clerk_user_id, approval_status)
    VALUES (${input.email.toLowerCase()}, ${input.fullName}, ${input.avatarUrl}, ${input.clerkUserId}, ${approvalStatus})
    RETURNING id, email, full_name, avatar_url, phone, is_active, approval_status, created_at, updated_at
  `;
  const profile = mapProfile(rows[0]);
  await sql`INSERT INTO user_roles (user_id, role) VALUES (${profile.id}, ${role})`;

  if (!isFirstUser) {
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
          ${`${input.fullName} (${input.email}) signed up and needs access.`},
          '/admin'
        )
      `;
    }
  }

  return profile;
}

export async function listAllUsers(): Promise<AdminUser[]> {
  const sql = getSql();
  const profiles = await sql`
    SELECT id, email, full_name, avatar_url, approval_status, created_at
    FROM profiles WHERE is_active = true
    ORDER BY created_at DESC
  `;
  const result: AdminUser[] = [];
  for (const p of profiles) {
    const roles = await getUserRoles(p.id as string);
    result.push({
      id: p.id as string,
      email: p.email as string,
      full_name: p.full_name as string,
      avatar_url: (p.avatar_url as string) ?? null,
      approval_status: (p.approval_status as ApprovalStatus) ?? "pending",
      roles,
      created_at: String(p.created_at),
    });
  }
  return result;
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
