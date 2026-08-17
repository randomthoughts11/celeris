"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { openDmChatAction } from "@/features/chat/actions";
import type { Profile } from "@/types";

interface NewDmDialogProps {
  teammates: Profile[];
  currentUserId: string;
}

export function NewDmDialog({ teammates, currentUserId }: NewDmDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const others = teammates.filter((t) => t.id !== currentUserId);
  const filtered = others.filter(
    (t) =>
      t.full_name.toLowerCase().includes(query.toLowerCase()) ||
      t.email.toLowerCase().includes(query.toLowerCase())
  );

  const startDm = (userId: string) => {
    startTransition(async () => {
      try {
        const result = await openDmChatAction(userId);
        if ("error" in result && result.error) {
          toast.error(result.error);
          return;
        }
        if (!("roomId" in result) || !result.roomId) {
          toast.error("Could not start conversation");
          return;
        }
        setOpen(false);
        router.push(`/chat?room=${result.roomId}`);
        router.refresh();
      } catch {
        toast.error("Could not start conversation");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" className="w-full gap-2">
            <UserPlus className="h-3.5 w-3.5" />
            New message
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Message a teammate</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Search by name or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ScrollArea className="max-h-64">
          <ul className="space-y-1 pt-2">
            {filtered.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => startDm(person.id)}
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-white/5"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-500/20 text-xs font-semibold text-violet-200">
                    {person.full_name
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{person.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{person.email}</p>
                  </div>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No teammates found.
              </p>
            )}
          </ul>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
