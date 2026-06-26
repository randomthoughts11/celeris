import { createClient } from "@/lib/supabase/server";
import type { SessionUser, UserRole } from "@/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { DEMO_USER } from "@/lib/demo/data";

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isSupabaseConfigured()) {
    return DEMO_USER;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .single();

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name ?? user.email ?? "User",
    roles: (roles?.map((r) => r.role as UserRole) ?? ["manager"]) as UserRole[],
    avatarUrl: profile?.avatar_url ?? null,
  };
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
