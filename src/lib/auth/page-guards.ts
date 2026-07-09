import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import {
  canSeeCompanyNavItem,
  type CompanyNavItem,
} from "@/lib/rbac/nav";
import { canManageCompanies } from "@/lib/auth/access";
import type { SessionUser } from "@/types";

export async function requireSession(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireCompanyPageAccess(
  item: CompanyNavItem
): Promise<SessionUser> {
  const user = await requireSession();
  if (!canSeeCompanyNavItem(user.roles, item)) {
    redirect("/telecaller");
  }
  return user;
}

export async function requireSettingsAccess(): Promise<SessionUser> {
  const user = await requireSession();
  if (!canManageCompanies(user)) redirect("/");
  return user;
}
