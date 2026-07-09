import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import {
  fetchNotifications,
  markAllRead,
  markNotificationRead,
} from "@/lib/db/notifications";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.approvalStatus !== "approved") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const notifications = await fetchNotifications(user.id);
  return NextResponse.json({ notifications });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user || user.approvalStatus !== "approved") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { id?: string; markAll?: boolean };

  if (body.markAll) {
    await markAllRead(user.id);
    return NextResponse.json({ success: true });
  }

  if (body.id) {
    await markNotificationRead(body.id, user.id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "id or markAll required" }, { status: 400 });
}
