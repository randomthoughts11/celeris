import type { UserRole } from "@/types";

const ROLE_HIERARCHY: Record<UserRole, number> = {
  telecaller: 1,
  designer: 2,
  manager: 3,
  admin: 4,
  god_mode: 5,
};

export const PERMISSIONS = {
  VIEW_FINANCIALS: ["god_mode", "manager", "admin"] as UserRole[],
  MANAGE_CAMPAIGNS: ["god_mode", "manager", "admin"] as UserRole[],
  MANAGE_USERS: ["god_mode", "admin"] as UserRole[],
  VIEW_AUDIT_LOGS: ["god_mode", "admin"] as UserRole[],
  IMPERSONATE: ["god_mode"] as UserRole[],
  MANAGE_ALL_COMPANIES: ["god_mode", "admin"] as UserRole[],
  ACCESS_LEADS: ["god_mode", "manager", "admin", "telecaller"] as UserRole[],
  LOG_CALLS: ["god_mode", "manager", "admin", "telecaller"] as UserRole[],
  MANAGE_OWN_LEADS: ["telecaller"] as UserRole[],
  SCHEDULE_POSTS: ["god_mode", "manager", "designer", "admin"] as UserRole[],
  APPROVE_POSTS: ["god_mode", "manager", "admin"] as UserRole[],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function hasRole(userRoles: UserRole[], role: UserRole): boolean {
  return userRoles.includes(role);
}

export function hasAnyRole(userRoles: UserRole[], roles: UserRole[]): boolean {
  return roles.some((role) => userRoles.includes(role));
}

export function hasPermission(
  userRoles: UserRole[],
  permission: Permission
): boolean {
  return hasAnyRole(userRoles, [...PERMISSIONS[permission]]);
}

export function getHighestRole(roles: UserRole[]): UserRole {
  return roles.reduce((highest, role) =>
    ROLE_HIERARCHY[role] > ROLE_HIERARCHY[highest] ? role : highest
  );
}

export function canViewFinancials(roles: UserRole[]): boolean {
  return hasPermission(roles, "VIEW_FINANCIALS");
}

export function canAccessLeads(roles: UserRole[]): boolean {
  return hasPermission(roles, "ACCESS_LEADS");
}

export const ROLE_LABELS: Record<UserRole, string> = {
  god_mode: "God Mode",
  manager: "Manager",
  designer: "Designer",
  telecaller: "Telecaller",
  admin: "Admin",
};
