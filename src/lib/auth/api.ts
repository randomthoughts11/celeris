import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import type { SessionUser } from "@/types";

export async function requireApprovedApiUser(): Promise<
  { user: SessionUser; error?: undefined } | { user?: undefined; error: NextResponse }
> {
  try {
    const user = await requireAuth();
    return { user };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    const status = message.includes("pending") ? 403 : 401;
    return {
      error: NextResponse.json({ error: message }, { status }),
    };
  }
}
