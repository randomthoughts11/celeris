import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import {
  canSeeCompanyNavItem,
  canSeeGlobalNav,
  getHomePathForRole,
  type CompanyNavItem,
} from "@/lib/rbac/nav";
import { canManageBrandSetup } from "@/lib/auth/access";
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
  item: "chat" | "settings" | "admin" | "team" | "vault"
): Promise<SessionUser> {
  const user = await requireSession();
  if (!canSeeGlobalNav(user.roles, item)) {
    redirect(getHomePathForRole(user.roles));
  }
  return user;
}
