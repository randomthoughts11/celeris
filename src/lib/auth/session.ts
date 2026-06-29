import { auth } from "@/auth";
import type { SessionUser } from "@/types";
import { isDatabaseConfigured } from "@/lib/config";
import { DEMO_USER } from "@/lib/demo/data";

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isDatabaseConfigured()) {
    return DEMO_USER;
  }

  const session = await auth();
  if (!session?.user?.id) return null;

  return {
    id: session.user.id,
    email: session.user.email ?? "",
    fullName: session.user.name ?? "User",
    roles: session.user.roles ?? ["manager"],
    avatarUrl: null,
  };
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
