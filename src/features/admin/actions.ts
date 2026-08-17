"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { canManageUsers } from "@/lib/auth/access";
import {
  addCompanyMember,
  listAllCompanyMemberships,
  removeCompanyMember,
} from "@/lib/db/companies";
import {
  getUserRoles,
  listAllUsers,
  setUserApproval,
  setUserRoles,
} from "@/lib/db/users";
import { getHighestRole } from "@/lib/rbac/permissions";
import type { UserRole } from "@/types";

export async function getAdminUsersAction() {
  const user = await requireAuth();
  if (!canManageUsers(user)) throw new Error("Forbidden");
  return listAllUsers();
}

export async function getAdminMembershipsAction() {
  const user = await requireAuth();
  if (!canManageUsers(user)) throw new Error("Forbidden");
  return listAllCompanyMemberships();
}

export async function approveUserAction(userId: string) {
  const user = await requireAuth();
  if (!canManageUsers(user)) return { error: "Forbidden" };
  await setUserApproval(userId, "approved");
  revalidatePath("/admin");
  return { success: true };
}

export async function rejectUserAction(userId: string) {
  const user = await requireAuth();
  if (!canManageUsers(user)) return { error: "Forbidden" };
  await setUserApproval(userId, "rejected");
  revalidatePath("/admin");
  return { success: true };
}

export async function setUserRoleAction(userId: string, role: UserRole) {
  const user = await requireAuth();
  if (!canManageUsers(user)) return { error: "Forbidden" };
  // Only god_mode may grant god_mode — prevents admin self-escalation.
  if (role === "god_mode" && !user.roles.includes("god_mode")) {
    return { error: "Only God Mode can assign God Mode" };
  }
  await setUserRoles(userId, [role]);
  revalidatePath("/admin");
  return { success: true };
}

export async function assignUserToCompanyAction(
  userId: string,
  companyId: string
) {
  const user = await requireAuth();
  if (!canManageUsers(user)) return { error: "Forbidden" };
  const roles = await getUserRoles(userId);
  const snapshot = getHighestRole(roles);
  await addCompanyMember(companyId, userId, snapshot);
  revalidatePath("/admin");
  return { success: true };
}

export async function removeUserFromCompanyAction(
  userId: string,
  companyId: string
) {
  const user = await requireAuth();
  if (!canManageUsers(user)) return { error: "Forbidden" };
  await removeCompanyMember(companyId, userId);
  revalidatePath("/admin");
  return { success: true };
}
