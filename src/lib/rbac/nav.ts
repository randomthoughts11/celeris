import type { UserRole } from "@/types";
import { hasAnyRole, hasPermission } from "@/lib/rbac/permissions";

/** Desk-focused roles with limited global nav (telecaller or salesperson-only). */
export function isDeskFocused(roles: UserRole[]): boolean {
  const elevated = roles.some((r) =>
    ["god_mode", "admin", "manager", "designer"].includes(r)
  );
  if (elevated) return false;
  return roles.includes("telecaller") || roles.includes("salesperson");
}

/** @deprecated use isDeskFocused — kept for existing call sites */
export function isTelecallerFocused(roles: UserRole[]): boolean {
  return isDeskFocused(roles);
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
  | "analytics"
  | "customers"
  | "pipeline"
  | "appointments"
  | "messages"
  | "ai-calls"
  | "branches"
  | "knowledge"
  | "automations"
  | "dashboards";

export function canSeeCompanyNavItem(
  roles: UserRole[],
  item: CompanyNavItem
): boolean {
  if (isDeskFocused(roles)) {
    const deskItems: CompanyNavItem[] = [
      "leads",
      "calls",
      "customers",
      "pipeline",
      "appointments",
      "messages",
      "ai-calls",
      "knowledge",
    ];
    // Telecaller-only: leads + calls (+ messaging/ai)
    if (
      roles.includes("telecaller") &&
      !roles.includes("salesperson") &&
      !roles.some((r) => ["god_mode", "admin", "manager"].includes(r))
    ) {
      return (
        item === "leads" ||
        item === "calls" ||
        item === "messages" ||
        item === "ai-calls" ||
        item === "knowledge"
      );
    }
    return deskItems.includes(item);
  }
  if (item === "google-ads" || item === "meta-ads" || item === "analytics") {
    return hasPermission(roles, "VIEW_FINANCIALS");
  }
  if (item === "publish") {
    return hasPermission(roles, "PUBLISH_EXTERNALLY");
  }
  if (item === "leads" || item === "calls" || item === "pipeline") {
    return hasPermission(roles, "ACCESS_LEADS");
  }
  if (item === "customers") {
    return hasPermission(roles, "ACCESS_CUSTOMERS");
  }
  if (item === "appointments") {
    return hasPermission(roles, "ACCESS_APPOINTMENTS");
  }
  if (item === "messages") {
    return hasPermission(roles, "ACCESS_MESSAGING");
  }
  if (item === "ai-calls") {
    return hasPermission(roles, "ACCESS_AI_CALLS");
  }
  if (item === "knowledge") {
    return hasPermission(roles, "ACCESS_KNOWLEDGE");
  }
  if (item === "automations") {
    return hasPermission(roles, "MANAGE_AUTOMATIONS");
  }
  if (item === "branches") {
    return hasPermission(roles, "MANAGE_BRANCHES");
  }
  if (item === "dashboards") {
    return hasPermission(roles, "ACCESS_DASHBOARDS");
  }
  if (item === "board") {
    return hasPermission(roles, "ACCESS_BOARD");
  }
  return true;
}

export type GlobalNavItem =
  | "chat"
  | "settings"
  | "admin"
  | "team"
  | "vault"
  | "inbox"
  | "knowledge"
  | "ai-performance"
  | "dashboards";

export function canSeeGlobalNav(
  roles: UserRole[],
  item: GlobalNavItem
): boolean {
  if (isDeskFocused(roles)) {
    return (
      item === "chat" ||
      item === "inbox" ||
      item === "knowledge" ||
      item === "dashboards"
    );
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
  if (item === "ai-performance") {
    return hasPermission(roles, "ACCESS_AI_CALLS");
  }
  if (item === "dashboards") {
    return hasPermission(roles, "ACCESS_DASHBOARDS");
  }
  if (item === "knowledge") {
    return hasPermission(roles, "ACCESS_KNOWLEDGE");
  }
  if (item === "inbox") {
    return hasPermission(roles, "ACCESS_MESSAGING");
  }
  return true;
}

export function getHomePathForRole(roles: UserRole[]): string {
  if (isDeskFocused(roles)) return "/telecaller";
  return "/";
}
