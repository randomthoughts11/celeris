"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Notification } from "@/types";

export function NotificationsBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pending, startTransition] = useTransition();
  const unread = notifications.filter((n) => !n.is_read).length;

  const load = () => {
    fetch(`/api/notifications`)
      .then((r) => r.json())
      .then((d) => setNotifications(d.notifications ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, [userId]);

  const markRead = (id: string) => {
    startTransition(async () => {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    });
  };

  const markAllRead = () => {
    startTransition(async () => {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet-500 text-[10px] text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80">
        {notifications.length > 0 && unread > 0 && (
          <div className="border-b border-border px-3 py-2">
            <button
              type="button"
              className="text-xs text-violet-400 hover:underline"
              onClick={markAllRead}
              disabled={pending}
            >
              Mark all read
            </button>
          </div>
        )}
        {notifications.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            No notifications
          </p>
        ) : (
          notifications.slice(0, 10).map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="flex flex-col items-start gap-1 p-3"
              onClick={() => !n.is_read && markRead(n.id)}
            >
              <p
                className={`text-sm font-medium ${!n.is_read ? "" : "text-muted-foreground"}`}
              >
                {n.title}
              </p>
              <p className="text-xs text-muted-foreground">{n.message}</p>
              {n.link && (
                <Link
                  href={n.link}
                  className="text-xs text-violet-400 hover:underline"
                  onClick={() => markRead(n.id)}
                >
                  View
                </Link>
              )}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
