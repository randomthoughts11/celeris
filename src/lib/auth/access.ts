import type { SessionUser, UserRole } from "@/types";
import {
  hasAnyRole,
  hasPermission,
  hasRole,
  type Permission,
} from "@/lib/rbac/permissions";
import {
  canSeeCompanyNavItem,
  type CompanyNavItem,
} from "@/lib/rbac/nav";
import { getSql } from "@/lib/db/client";

export async function canAccessCompany(
  user: SessionUser,
  companyId: string
): Promise<boolean> {
  if (hasRole(user.roles, "god_mode") || hasRole(user.roles, "admin")) {
    return true;
  }
  const sql = getSql();
  const rows = await sql`
    SELECT 1 FROM company_members
    WHERE user_id = ${user.id} AND company_id = ${companyId}
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function requireCompanyAccess(
  user: SessionUser,
  companyId: string
): Promise<void> {
  const allowed = await canAccessCompany(user, companyId);
  if (!allowed) {
    throw new Error("Forbidden: no access to this company");
  }
}

export function requirePermission(user: SessionUser, permission: Permission): void {
  if (!hasPermission(user.roles, permission)) {
    throw new Error("Forbidden");
  }
}

export function requireCompanyFeature(
  user: SessionUser,
  item: CompanyNavItem
): void {
  if (!canSeeCompanyNavItem(user.roles, item)) {
    throw new Error("Forbidden");
  }
}

export function isApproved(user: SessionUser): boolean {
  return user.approvalStatus === "approved";
}

export function canManageUsers(user: SessionUser): boolean {
  return hasPermission(user.roles, "MANAGE_USERS");
}

export function canManageCompanies(user: SessionUser): boolean {
  return hasPermission(user.roles, "MANAGE_ALL_COMPANIES");
}

export function canCreateCompanies(user: SessionUser): boolean {
  return hasPermission(user.roles, "CREATE_COMPANY");
}

export function canManageBrandSetup(user: SessionUser): boolean {
  return hasPermission(user.roles, "MANAGE_BRAND_SETUP");
}

export function canViewAuditLogs(user: SessionUser): boolean {
  return hasPermission(user.roles, "VIEW_AUDIT_LOGS");
}

export function shouldScopeLeadsToOwner(roles: UserRole[]): boolean {
  return (
    hasRole(roles, "telecaller") &&
    !hasAnyRole(roles, ["god_mode", "admin", "manager"])
  );
}

export async function getAccessibleCompanyIds(
  user: SessionUser
): Promise<string[] | "all"> {
  if (hasRole(user.roles, "god_mode") || hasRole(user.roles, "admin")) {
    return "all";
  }
  const sql = getSql();
  const rows = await sql`
    SELECT company_id FROM company_members WHERE user_id = ${user.id}
  `;
  return rows.map((r) => r.company_id as string);
}

export async function canDirectMessage(
  user: SessionUser,
  otherUserId: string
): Promise<boolean> {
  if (user.id === otherUserId) return false;
  if (canManageUsers(user)) return true;
  const sql = getSql();
  const shared = await sql`
    SELECT 1 FROM company_members me
    JOIN company_members them ON them.company_id = me.company_id
    WHERE me.user_id = ${user.id} AND them.user_id = ${otherUserId}
    LIMIT 1
  `;
  if (shared.length > 0) return true;
  const leadership = await sql`
    SELECT 1 FROM user_roles
    WHERE user_id = ${otherUserId} AND role IN ('god_mode', 'admin')
    LIMIT 1
  `;
  return leadership.length > 0;
}
