"use client";

import { useEffect, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, isPast } from "date-fns";
import { AlarmClock, MessageSquare, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { DeckCard, DeckLabel } from "@/types";
import { cn } from "@/lib/utils";
import { CardDetailDialog } from "./card-dialogs";
import type { DeckMember } from "./deck-board";

function isOverdue(card: DeckCard) {
  return Boolean(
    card.due_date && isPast(new Date(card.due_date)) && card.status !== "done"
  );
}

function CardBody({ card }: { card: DeckCard }) {
  const overdue = isOverdue(card);
  return (
    <>
      {card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.labels.map((label) => (
            <span
              key={label.id}
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: `${label.color}26`,
                color: label.color,
              }}
            >
              {label.title}
            </span>
          ))}
        </div>
      )}
      <p className={cn("font-medium", card.labels.length > 0 && "mt-2")}>
        {card.title}
      </p>
      {card.description && (
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
          {card.description}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {(card.priority === "high" || card.priority === "urgent") && (
          <Badge variant="destructive" className="text-[10px]">
            {card.priority}
          </Badge>
        )}
        {card.due_date && (
          <span
            className={cn(
              "flex items-center gap-1",
              overdue && "text-red-400"
            )}
          >
            <AlarmClock className="h-3 w-3" />
            {format(new Date(card.due_date), "MMM d")}
          </span>
        )}
        {card.comment_count > 0 && (
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {card.comment_count}
          </span>
        )}
        {card.time_logged_minutes > 0 && (
          <span className="flex items-center gap-1">
            <Timer className="h-3 w-3" />
            {card.time_logged_minutes}m
          </span>
        )}
        {card.assignee_name && (
          <span className="ml-auto max-w-28 truncate">
            {card.assignee_name}
          </span>
        )}
      </div>
    </>
  );
}

export function CardPreview({ card }: { card: DeckCard }) {
  return (
    <Card className="w-72 rotate-2 border-white/10 bg-zinc-900 p-3 shadow-xl">
      <CardBody card={card} />
    </Card>
  );
}

export function CardItem({
  card,
  companyId,
  boardLabels,
  members,
}: {
  card: DeckCard;
  companyId: string;
  boardLabels: DeckLabel[];
  members: DeckMember[];
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const wasDragged = useRef(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  useEffect(() => {
    if (isDragging) wasDragged.current = true;
  }, [isDragging]);

  const handleClick = () => {
    // Suppress the click that fires right after a drag ends.
    if (wasDragged.current) {
      wasDragged.current = false;
      return;
    }
    setDetailOpen(true);
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
        }}
        {...attributes}
        {...listeners}
        onClick={handleClick}
      >
        <Card
          className={cn(
            "cursor-grab border-white/5 bg-white/[0.02] p-3 backdrop-blur-sm transition-colors hover:border-white/15 active:cursor-grabbing",
            isOverdue(card) && "border-red-500/30",
            isDragging && "opacity-40"
          )}
        >
          <CardBody card={card} />
        </Card>
      </div>
      <CardDetailDialog
        card={card}
        companyId={companyId}
        boardLabels={boardLabels}
        members={members}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  );
}
