import { auth, currentUser } from "@clerk/nextjs/server";
import type { SessionUser } from "@/types";
import {
  isClerkConfigured,
  isDatabaseConfigured,
  isDemoMode,
} from "@/lib/config";
import { DEMO_USER } from "@/lib/demo/data";
import {
  ensureProfileForClerkUser,
  getUserByClerkId,
  getUserByEmail,
  getUserRoles,
} from "@/lib/db/users";

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isDatabaseConfigured() || (isDemoMode() && !isClerkConfigured())) {
    return DEMO_USER;
  }

  if (!isClerkConfigured()) {
    return null;
  }

  const { userId } = await auth();
  if (!userId) return null;

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email = clerkUser.primaryEmailAddress?.emailAddress;
  if (!email) return null;

  let profile =
    (await getUserByClerkId(userId)) ?? (await getUserByEmail(email));

  if (!profile) {
    profile = await ensureProfileForClerkUser({
      clerkUserId: userId,
      email,
      fullName:
        clerkUser.fullName ??
        ([clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
          email.split("@")[0]),
      avatarUrl: clerkUser.imageUrl ?? null,
    });
  }

  const roles = await getUserRoles(profile.id);

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    roles: roles.length > 0 ? roles : ["manager"],
    avatarUrl: profile.avatar_url ?? clerkUser.imageUrl ?? null,
  };
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
