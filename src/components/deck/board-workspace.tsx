"use client";

import { useMemo, useState } from "react";
import { DeckBoardView, type DeckMember } from "@/components/deck/deck-board";
import type { DeckBoard, DeckCard, DeckLabel, DeckStack } from "@/types";
import { cn } from "@/lib/utils";

export type BoardScope = "mine" | "team";

interface BoardWorkspaceProps {
  companyId: string;
  currentUserId: string;
  boards: DeckBoard[];
  board: DeckBoard;
  stacks: DeckStack[];
  cards: DeckCard[];
  labels: DeckLabel[];
  members: DeckMember[];
  initialScope?: BoardScope;
}

function isMine(card: DeckCard, userId: string) {
  return card.assignee_id === userId;
}

export function BoardWorkspace({
  companyId,
  currentUserId,
  boards,
  board,
  stacks,
  cards,
  labels,
  members,
  initialScope = "mine",
}: BoardWorkspaceProps) {
  const [scope, setScope] = useState<BoardScope>(initialScope);

  const visibleCards = useMemo(() => {
    if (scope === "mine") {
      return cards.filter((c) => isMine(c, currentUserId));
    }
    return cards;
  }, [cards, scope, currentUserId]);

  const open = visibleCards.filter(
    (c) => c.status !== "done" && c.status !== "cancelled"
  ).length;
  const completed = visibleCards.filter((c) => c.status === "done").length;
  const overdue = visibleCards.filter(
    (c) =>
      c.due_date &&
      new Date(c.due_date) < new Date() &&
      c.status !== "done"
  ).length;
  const totalLogged = visibleCards.reduce(
    (s, c) => s + c.time_logged_minutes,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Board</h1>
          <p className="text-muted-foreground">
            {scope === "mine" ? "Your tasks" : "All team tasks"} · {open} open ·{" "}
            {completed} completed · {overdue} overdue · {totalLogged} minutes
            logged
          </p>
        </div>
        <div className="flex rounded-lg border border-white/10 bg-white/[0.02] p-1">
          <ScopeChip
            active={scope === "mine"}
            onClick={() => setScope("mine")}
            label="My tasks"
          />
          <ScopeChip
            active={scope === "team"}
            onClick={() => setScope("team")}
            label="Team tasks"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
          <p className="text-xs text-muted-foreground">Open</p>
          <p className="text-2xl font-semibold">{open}</p>
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <p className="text-xs text-emerald-300/80">Completed</p>
          <p className="text-2xl font-semibold text-emerald-300">{completed}</p>
        </div>
        <div className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
          <p className="text-xs text-muted-foreground">Overdue</p>
          <p className="text-2xl font-semibold text-amber-300">{overdue}</p>
        </div>
      </div>

      {scope === "mine" && visibleCards.length === 0 && (
        <p className="rounded-lg border border-dashed border-white/10 px-4 py-3 text-sm text-muted-foreground">
          No tasks assigned to you on this board. Switch to{" "}
          <button
            type="button"
            className="text-violet-300 underline-offset-2 hover:underline"
            onClick={() => setScope("team")}
          >
            Team tasks
          </button>{" "}
          to see everyone’s work, or ask to be assigned.
        </p>
      )}

      <DeckBoardView
        companyId={companyId}
        boards={boards}
        board={board}
        stacks={stacks}
        cards={visibleCards}
        labels={labels}
        members={members}
      />
    </div>
  );
}

function ScopeChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm transition-colors",
        active
          ? "bg-white/15 text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}
