import { ChatClient } from "@/components/chat/chat-client";
import { getChatRoomsAction } from "@/features/chat/actions";
import { getSessionUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.approvalStatus !== "approved") redirect("/pending-approval");

  const { room } = await searchParams;
  const rooms = await getChatRoomsAction();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Team Chat</h1>
        <p className="text-muted-foreground">
          Company channels and direct messages with your team.
        </p>
      </div>
      <ChatClient
        rooms={rooms}
        initialRoomId={room}
        currentUserId={user.id}
      />
    </div>
  );
}
