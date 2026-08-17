import { NextResponse } from "next/server";
import { requireApprovedApiUser } from "@/lib/auth/api";
import {
  fetchNotifications,
  markAllRead,
  markNotificationRead,
} from "@/lib/db/notifications";

export async function GET() {
  const auth = await requireApprovedApiUser();
  if (auth.error) return auth.error;
  const notifications = await fetchNotifications(auth.user.id);
  return NextResponse.json({ notifications });
}

export async function PATCH(request: Request) {
  const auth = await requireApprovedApiUser();
  if (auth.error) return auth.error;

  const body = (await request.json()) as { id?: string; markAll?: boolean };

  if (body.markAll) {
    await markAllRead(auth.user.id);
    return NextResponse.json({ success: true });
  }

  if (body.id) {
    await markNotificationRead(body.id, auth.user.id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "id or markAll required" }, { status: 400 });
}
