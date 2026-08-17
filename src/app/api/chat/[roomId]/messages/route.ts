import { NextResponse } from "next/server";
import { listRoomMessages } from "@/lib/db/chat";
import { isRoomMember } from "@/lib/db/chat";
import { requireApprovedApiUser } from "@/lib/auth/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const auth = await requireApprovedApiUser();
  if (auth.error) return auth.error;

  const { roomId } = await params;
  const member = await isRoomMember(roomId, auth.user.id);
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
