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
  listAllUsers,
  setUserApproval,
  setUserRoles,
} from "@/lib/db/users";
import type { ApprovalStatus, UserRole } from "@/types";

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
  await setUserRoles(userId, [role]);
  revalidatePath("/admin");
  return { success: true };
}

export async function assignUserToCompanyAction(
  userId: string,
  companyId: string,
  role: UserRole
) {
  const user = await requireAuth();
  if (!canManageUsers(user)) return { error: "Forbidden" };
  await addCompanyMember(companyId, userId, role);
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
