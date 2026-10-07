import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import {
  canSeeCompanyNavItem,
  canSeeGlobalNav,
  getHomePathForRole,
  type CompanyNavItem,
  type GlobalNavItem,
} from "@/lib/rbac/nav";
import { canManageBrandSetup } from "@/lib/auth/access";
import { CLIENT_BRAND_PAGES, isClient } from "@/lib/call-audit/access";
import type { SessionUser } from "@/types";

export async function requireSession(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.approvalStatus !== "approved") redirect("/pending-approval");
  return user;
}

export async function requireCompanyPageAccess(
  item: CompanyNavItem
): Promise<SessionUser> {
  const user = await requireSession();
  // Middleware limits clients to their own brands, so only the page type is checked here.
  if (isClient(user) && (CLIENT_BRAND_PAGES as readonly string[]).includes(item)) return user;
  if (!canSeeCompanyNavItem(user.roles, item)) {
    redirect(getHomePathForRole(user.roles));
  }
  return user;
}

export async function requireSettingsAccess(): Promise<SessionUser> {
  const user = await requireSession();
  if (!canManageBrandSetup(user)) redirect("/");
  return user;
}

export async function requireGlobalNavAccess(
  item: GlobalNavItem
): Promise<SessionUser> {
  const user = await requireSession();
  if (!canSeeGlobalNav(user.roles, item)) {
    redirect(getHomePathForRole(user.roles));
  }
  return user;
}
