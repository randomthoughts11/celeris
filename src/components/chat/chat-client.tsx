"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { sendChatMessageAction } from "@/features/chat/actions";
import type { ChatMessage, ChatRoom } from "@/types";
import { cn } from "@/lib/utils";

interface ChatClientProps {
  rooms: ChatRoom[];
  initialRoomId?: string;
  currentUserId: string;
}

export function ChatClient({
  rooms,
  initialRoomId,
  currentUserId,
}: ChatClientProps) {
  const router = useRouter();
  const [activeRoom, setActiveRoom] = useState(initialRoomId ?? rooms[0]?.id ?? "");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = async (roomId: string) => {
    const res = await fetch(`/api/chat/${roomId}/messages`);
    if (res.ok) {
      const data = (await res.json()) as { messages: ChatMessage[] };
      setMessages(data.messages);
    }
  };

  useEffect(() => {
    if (activeRoom) loadMessages(activeRoom);
  }, [activeRoom]);

  useEffect(() => {
    if (!activeRoom) return;
    const interval = setInterval(() => loadMessages(activeRoom), 5000);
    return () => clearInterval(interval);
  }, [activeRoom]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !activeRoom) return;
    startTransition(async () => {
      const result = await sendChatMessageAction(activeRoom, text);
      if (result.success && result.message) {
        setMessages((prev) => [...prev, result.message!]);
        setText("");
        router.refresh();
      }
    });
  };

  const active = rooms.find((r) => r.id === activeRoom);

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <Card className="flex w-72 shrink-0 flex-col border-white/5 bg-white/[0.02]">
        <div className="border-b border-white/5 p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <MessageSquare className="h-4 w-4" />
            Messages
          </h2>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2">
            {rooms.map((room) => (
              <button
                key={room.id}
                type="button"
                onClick={() => setActiveRoom(room.id)}
                className={cn(
                  "w-full rounded-lg p-3 text-left transition-colors",
                  activeRoom === room.id ? "bg-white/10" : "hover:bg-white/5"
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="truncate text-sm font-medium">{room.name}</p>
                  {(room.unread_count ?? 0) > 0 && (
                    <span className="rounded-full bg-violet-500 px-1.5 text-xs text-white">
                      {room.unread_count}
                    </span>
                  )}
                </div>
                {room.last_message && (
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {room.last_message}
                  </p>
                )}
              </button>
            ))}
            {rooms.length === 0 && (
              <p className="p-4 text-center text-sm text-muted-foreground">
                No conversations yet. Open a company to start team chat.
              </p>
            )}
          </div>
        </ScrollArea>
      </Card>

      <Card className="flex flex-1 flex-col border-white/5 bg-white/[0.02]">
        {active ? (
          <>
            <div className="border-b border-white/5 p-4">
              <h3 className="font-semibold">{active.name}</h3>
            </div>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "flex flex-col max-w-[80%]",
                      m.sender_id === currentUserId ? "ml-auto items-end" : "items-start"
                    )}
                  >
                    <p className="text-xs text-muted-foreground">
                      {m.sender_id === currentUserId ? "You" : m.sender_name} ·{" "}
                      {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                    </p>
                    <div
                      className={cn(
                        "mt-1 rounded-lg px-3 py-2 text-sm",
                        m.sender_id === currentUserId
                          ? "bg-violet-600 text-white"
                          : "bg-white/10"
                      )}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>
            <form onSubmit={handleSend} className="flex gap-2 border-t border-white/5 p-4">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a message…"
                disabled={pending}
              />
              <Button type="submit" size="icon" disabled={pending || !text.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            Select a conversation
          </div>
        )}
      </Card>
    </div>
  );
}
