"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Building2, MessageSquare, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NewDmDialog } from "@/components/chat/new-dm-dialog";
import { sendChatMessageAction } from "@/features/chat/actions";
import type { ChatMessage, ChatRoom, Profile } from "@/types";
import { cn } from "@/lib/utils";

interface ChatClientProps {
  rooms: ChatRoom[];
  initialRoomId?: string;
  currentUserId: string;
  teammates: Profile[];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ChatClient({
  rooms,
  initialRoomId,
  currentUserId,
  teammates,
}: ChatClientProps) {
  const router = useRouter();
  const [activeRoom, setActiveRoom] = useState(initialRoomId ?? rooms[0]?.id ?? "");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  const brandRooms = useMemo(
    () => rooms.filter((r) => !r.is_dm).sort((a, b) => a.name.localeCompare(b.name)),
    [rooms]
  );
  const dmRooms = useMemo(() => rooms.filter((r) => r.is_dm), [rooms]);

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
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      loadMessages(activeRoom);
    };
    const interval = setInterval(tick, 2500);
    const onVis = () => {
      if (!document.hidden) loadMessages(activeRoom);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
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

  const renderRoom = (room: ChatRoom) => (
    <button
      key={room.id}
      type="button"
      onClick={() => setActiveRoom(room.id)}
      className={cn(
        "w-full rounded-lg p-3 text-left transition-colors",
        activeRoom === room.id ? "bg-white/10 ring-1 ring-white/10" : "hover:bg-white/5"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium">{room.name}</p>
        {(room.unread_count ?? 0) > 0 && (
          <span className="shrink-0 rounded-full bg-violet-500 px-1.5 text-xs text-white">
            {room.unread_count}
          </span>
        )}
      </div>
      {room.company_name && !room.is_dm && (
        <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-violet-300/80">
          <Building2 className="h-3 w-3 shrink-0" />
          {room.company_name}
        </p>
      )}
      {room.last_message && (
        <p className="mt-1 truncate text-xs text-muted-foreground">{room.last_message}</p>
      )}
    </button>
  );

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <Card className="flex w-80 shrink-0 flex-col border-white/5 bg-white/[0.02]">
        <div className="border-b border-white/5 p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <MessageSquare className="h-4 w-4" />
            Team messages
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Brand channels and direct messages
          </p>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-4 p-2">
            {brandRooms.length > 0 && (
              <div>
                <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Brand channels
                </p>
                <div className="space-y-1">{brandRooms.map(renderRoom)}</div>
              </div>
            )}
            {dmRooms.length > 0 && (
              <div>
                <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Direct messages
                </p>
                <div className="space-y-1">{dmRooms.map(renderRoom)}</div>
              </div>
            )}
            {rooms.length === 0 && (
              <p className="p-4 text-center text-sm text-muted-foreground">
                No conversations yet. Open a company to start team chat.
              </p>
            )}
          </div>
        </ScrollArea>
        <div className="border-t border-white/5 p-2">
          <NewDmDialog teammates={teammates} currentUserId={currentUserId} />
        </div>
      </Card>

      <Card className="flex flex-1 flex-col border-white/5 bg-white/[0.02]">
        {active ? (
          <>
            <div className="border-b border-white/5 p-4">
              <h3 className="font-semibold">{active.name}</h3>
              {active.company_name && (
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  {active.company_name} · agency channel
                </p>
              )}
              {active.is_dm && (
                <p className="mt-0.5 text-sm text-muted-foreground">Private conversation</p>
              )}
            </div>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((m) => {
                  const mine = m.sender_id === currentUserId;
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "flex max-w-[85%] gap-2",
                        mine ? "ml-auto flex-row-reverse" : "mr-auto"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                          mine ? "bg-violet-600 text-white" : "bg-white/10 text-muted-foreground"
                        )}
                      >
                        {m.sender_avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.sender_avatar}
                            alt=""
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          getInitials(m.sender_name ?? "?")
                        )}
                      </div>
                      <div className={cn("min-w-0", mine && "items-end text-right")}>
                        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground/90">
                            {mine ? "You" : m.sender_name}
                          </span>
                          {!mine && m.sender_companies && m.sender_companies.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px]">
                              <User className="h-2.5 w-2.5" />
                              {m.sender_companies.join(" · ")}
                            </span>
                          )}
                          <span>
                            {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <div
                          className={cn(
                            "inline-block rounded-2xl px-4 py-2 text-sm",
                            mine
                              ? "rounded-tr-md bg-violet-600 text-white"
                              : "rounded-tl-md bg-white/10"
                          )}
                        >
                          {m.content}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>
            <form onSubmit={handleSend} className="flex gap-2 border-t border-white/5 p-4">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  active.company_name
                    ? `Message ${active.company_name} team…`
                    : "Type a message…"
                }
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
