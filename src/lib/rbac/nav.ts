import type { UserRole } from "@/types";
import { hasAnyRole, hasPermission } from "@/lib/rbac/permissions";

export function isTelecallerFocused(roles: UserRole[]): boolean {
  return (
    roles.includes("telecaller") &&
    !roles.some((r) =>
      ["god_mode", "admin", "manager", "designer"].includes(r)
    )
  );
}

export type CompanyNavItem =
  | "overview"
  | "google-ads"
  | "meta-ads"
  | "social"
  | "publish"
  | "drive"
  | "leads"
  | "board"
  | "calls"
  | "analytics";

export function canSeeCompanyNavItem(
  roles: UserRole[],
  item: CompanyNavItem
): boolean {
  if (isTelecallerFocused(roles)) {
    return item === "leads" || item === "calls";
  }
  if (item === "google-ads" || item === "meta-ads" || item === "analytics") {
    return hasPermission(roles, "VIEW_FINANCIALS");
  }
  if (item === "publish") {
    return hasPermission(roles, "PUBLISH_EXTERNALLY");
  }
  if (item === "leads" || item === "calls") {
    return hasPermission(roles, "ACCESS_LEADS");
  }
  if (item === "board") {
    return hasPermission(roles, "ACCESS_BOARD");
  }
  return true;
}

export function canSeeGlobalNav(
  roles: UserRole[],
  item: "chat" | "settings" | "admin" | "team" | "vault"
): boolean {
  if (isTelecallerFocused(roles)) {
    return item === "chat";
  }
  if (item === "team") {
    return hasAnyRole(roles, ["god_mode", "admin", "manager"]);
  }
  if (item === "admin") {
    return hasPermission(roles, "MANAGE_USERS");
  }
  if (item === "settings") {
    return hasPermission(roles, "MANAGE_BRAND_SETUP");
  }
  return true;
}

export function getHomePathForRole(roles: UserRole[]): string {
  if (isTelecallerFocused(roles)) return "/telecaller";
  return "/";
}
