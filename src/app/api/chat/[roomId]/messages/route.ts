import { NextResponse } from "next/server";
import { listRoomMessages } from "@/lib/db/chat";
import { isRoomMember } from "@/lib/db/chat";
import { getSessionUser } from "@/lib/auth/session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const user = await getSessionUser();
  if (!user || user.approvalStatus !== "approved") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;
  const member = await isRoomMember(roomId, user.id);
  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const since = new URL(request.url).searchParams.get("since");
  const messages = await listRoomMessages(roomId, 200);

  if (since) {
    const filtered = messages.filter((m) => m.created_at > since);
    return NextResponse.json({ messages: filtered });
  }

  return NextResponse.json({ messages });
}
