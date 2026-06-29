import { getSql } from "./client";
import type { Profile, UserRole } from "@/types";

export interface DbUser extends Profile {
  password_hash: string | null;
  clerk_user_id?: string | null;
}

export async function getUserByEmail(
  email: string
): Promise<DbUser | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, email, password_hash, full_name, avatar_url, phone, is_active, created_at, updated_at, clerk_user_id
    FROM profiles
    WHERE email = ${email.toLowerCase()} AND is_active = true
    LIMIT 1
  `;
  return (rows[0] as DbUser) ?? null;
}

export async function getUserByClerkId(
  clerkUserId: string
): Promise<Profile | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, email, full_name, avatar_url, phone, is_active, created_at, updated_at
    FROM profiles
    WHERE clerk_user_id = ${clerkUserId} AND is_active = true
    LIMIT 1
  `;
  return (rows[0] as Profile) ?? null;
}

export async function getUserById(id: string): Promise<Profile | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, email, full_name, avatar_url, phone, is_active, created_at, updated_at
    FROM profiles
    WHERE id = ${id} AND is_active = true
    LIMIT 1
  `;
  return (rows[0] as Profile) ?? null;
}

export async function getUserRoles(userId: string): Promise<UserRole[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT role FROM user_roles WHERE user_id = ${userId}
  `;
  return rows.map((r) => r.role as UserRole);
}

export async function countUsers(): Promise<number> {
  const sql = getSql();
  const rows = await sql`SELECT COUNT(*)::int AS count FROM profiles`;
  return (rows[0]?.count as number) ?? 0;
}

export async function createUser(input: {
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
}): Promise<string> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO profiles (email, password_hash, full_name)
    VALUES (${input.email.toLowerCase()}, ${input.passwordHash}, ${input.fullName})
    RETURNING id
  `;
  const userId = rows[0].id as string;
  await sql`
    INSERT INTO user_roles (user_id, role) VALUES (${userId}, ${input.role})
  `;
  return userId;
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
  const role: UserRole = userCount === 0 ? "god_mode" : "manager";

  const rows = await sql`
    INSERT INTO profiles (email, full_name, avatar_url, clerk_user_id)
    VALUES (${input.email.toLowerCase()}, ${input.fullName}, ${input.avatarUrl}, ${input.clerkUserId})
    RETURNING id, email, full_name, avatar_url, phone, is_active, created_at, updated_at
  `;
  const profile = rows[0] as Profile;
  await sql`
    INSERT INTO user_roles (user_id, role) VALUES (${profile.id}, ${role})
  `;
  return profile;
}
