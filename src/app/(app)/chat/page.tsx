import { ChatClient } from "@/components/chat/chat-client";
import { getChatRoomsAction } from "@/features/chat/actions";
import { listDirectoryUsers } from "@/lib/db/users";
import { requireGlobalNavAccess } from "@/lib/auth/page-guards";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string }>;
}) {
  const user = await requireGlobalNavAccess("chat");

  const { room } = await searchParams;
  const [rooms, teammates] = await Promise.all([
    getChatRoomsAction(),
    listDirectoryUsers(user),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Team Chat</h1>
        <p className="text-muted-foreground">
          Brand channels and direct messages — see which organization each person works on.
        </p>
      </div>
      <ChatClient
        rooms={rooms}
        initialRoomId={room}
        currentUserId={user.id}
        teammates={teammates}
      />
    </div>
  );
}
