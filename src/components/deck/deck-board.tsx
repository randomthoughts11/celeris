"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import {
  Archive,
  Kanban,
  MoreHorizontal,
  Pencil,
  Plus,
  Tags,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  archiveBoardAction,
  createBoardAction,
  createLabelAction,
  createStackAction,
  deleteLabelAction,
  deleteStackAction,
  moveCardAction,
  renameBoardAction,
  renameStackAction,
} from "@/features/deck/actions";
import type { DeckBoard, DeckCard, DeckLabel, DeckStack } from "@/types";
import { cn } from "@/lib/utils";
import { CardItem, CardPreview } from "./deck-card-item";
import { CreateCardDialog } from "./card-dialogs";

export interface DeckMember {
  id: string;
  name: string;
}

interface DeckBoardViewProps {
  companyId: string;
  boards: DeckBoard[];
  board: DeckBoard;
  stacks: DeckStack[];
  cards: DeckCard[];
  labels: DeckLabel[];
  members: DeckMember[];
}

const LABEL_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
];

function groupCards(
  stacks: DeckStack[],
  cards: DeckCard[]
): Record<string, DeckCard[]> {
  const grouped: Record<string, DeckCard[]> = {};
  for (const stack of stacks) grouped[stack.id] = [];
  for (const card of cards) {
    if (card.stack_id && grouped[card.stack_id]) {
      grouped[card.stack_id].push(card);
    }
  }
  for (const id of Object.keys(grouped)) {
    grouped[id].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }
  return grouped;
}

export function DeckBoardView({
  companyId,
  boards,
  board,
  stacks,
  cards,
  labels,
  members,
}: DeckBoardViewProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [columns, setColumns] = useState(() => groupCards(stacks, cards));
  const [activeCard, setActiveCard] = useState<DeckCard | null>(null);

  // Re-derive columns when fresh server data arrives (after router.refresh()).
  const [prevData, setPrevData] = useState({ stacks, cards });
  if (prevData.stacks !== stacks || prevData.cards !== cards) {
    setPrevData({ stacks, cards });
    setColumns(groupCards(stacks, cards));
  }

  const stackStatus = useMemo(() => {
    const map = new Map<string, DeckStack["status_map"]>();
    for (const s of stacks) map.set(s.id, s.status_map);
    return map;
  }, [stacks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const cardById = useMemo(() => {
    const map = new Map<string, DeckCard>();
    for (const c of cards) map.set(c.id, c);
    return map;
  }, [cards]);

  const findStackOf = (id: string): string | null => {
    if (columns[id]) return id;
    for (const [stackId, list] of Object.entries(columns)) {
      if (list.some((c) => c.id === id)) return stackId;
    }
    return null;
  };

  const applyMoveLocally = (
    prev: Record<string, DeckCard[]>,
    activeId: string,
    from: string,
    to: string,
    overId: string
  ): Record<string, DeckCard[]> => {
    const next = { ...prev };
    const moving =
      next[from]?.find((c) => c.id === activeId) ?? cardById.get(activeId);
    if (!moving) return prev;

    const fromList = next[from].filter((c) => c.id !== activeId);
    const toList = (
      from === to ? fromList : (next[to] ?? []).filter((c) => c.id !== activeId)
    ).slice();
    const overIndex = toList.findIndex((c) => c.id === overId);
    const insertAt = overIndex >= 0 ? overIndex : toList.length;
    const status = stackStatus.get(to) ?? moving.status;
    toList.splice(insertAt, 0, {
      ...moving,
      stack_id: to,
      status,
      completed_at:
        status === "done"
          ? moving.completed_at ?? new Date().toISOString()
          : null,
    });
    next[from] = from === to ? toList : fromList;
    next[to] = toList;
    return next;
  };

  const onDragStart = (event: DragStartEvent) => {
    setActiveCard(cardById.get(String(event.active.id)) ?? null);
  };

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const from = findStackOf(activeId);
    const to = findStackOf(overId);
    if (!from || !to || from === to) return;
    setColumns((prev) => applyMoveLocally(prev, activeId, from, to, overId));
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const from = findStackOf(activeId);
    const to = findStackOf(overId) ?? from;
    if (!from || !to) return;

    let finalColumns: Record<string, DeckCard[]> | null = null;
    setColumns((prev) => {
      finalColumns = applyMoveLocally(prev, activeId, from, to, overId);
      return finalColumns;
    });

    const index = finalColumns
      ? (finalColumns as Record<string, DeckCard[]>)[to].findIndex(
          (c) => c.id === activeId
        )
      : 0;

    startTransition(async () => {
      const result = await moveCardAction(
        companyId,
        activeId,
        to,
        Math.max(index, 0)
      );
      if (result?.error) {
        toast.error(result.error);
        setColumns(groupCards(stacks, cards));
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <BoardToolbar
        companyId={companyId}
        boards={boards}
        board={board}
        labels={labels}
      />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stacks.map((stack) => (
            <StackColumn
              key={stack.id}
              companyId={companyId}
              board={board}
              stack={stack}
              cards={columns[stack.id] ?? []}
              labels={labels}
              members={members}
            />
          ))}
          <AddStackButton companyId={companyId} boardId={board.id} />
        </div>
        <DragOverlay>
          {activeCard ? <CardPreview card={activeCard} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function BoardToolbar({
  companyId,
  boards,
  board,
  labels,
}: {
  companyId: string;
  boards: DeckBoard[];
  board: DeckBoard;
  labels: DeckLabel[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newBoardOpen, setNewBoardOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);

  const switchBoard = (boardId: string) => {
    router.push(`?board=${boardId}`);
  };

  const createBoard = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const title = String(new FormData(e.currentTarget).get("title") ?? "");
    startTransition(async () => {
      const result = await createBoardAction(companyId, title);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Board created");
        setNewBoardOpen(false);
        if (result.boardId) router.push(`?board=${result.boardId}`);
        router.refresh();
      }
    });
  };

  const renameBoard = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const title = String(new FormData(e.currentTarget).get("title") ?? "");
    startTransition(async () => {
      const result = await renameBoardAction(companyId, board.id, title);
      if (result.error) toast.error(result.error);
      else {
        setRenameOpen(false);
        router.refresh();
      }
    });
  };

  const archiveBoard = () => {
    startTransition(async () => {
      await archiveBoardAction(companyId, board.id);
      toast.success("Board archived");
      router.push("?");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Kanban className="h-4 w-4 text-muted-foreground" />
        <Select value={board.id} onValueChange={(v) => v && switchBoard(v)}>
          <SelectTrigger className="h-8 w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {boards.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            }
          />
          <DropdownMenuContent className="w-44">
            <DropdownMenuItem onClick={() => setRenameOpen(true)}>
              <Pencil /> Rename board
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLabelsOpen(true)}>
              <Tags /> Manage labels
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={archiveBoard}
              disabled={pending || boards.length <= 1}
            >
              <Archive /> Archive board
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={newBoardOpen} onOpenChange={setNewBoardOpen}>
        <DialogTrigger
          render={
            <Button size="sm" variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              New board
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create board</DialogTitle>
          </DialogHeader>
          <form onSubmit={createBoard} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="board-title">Title</Label>
              <Input id="board-title" name="title" required autoFocus />
            </div>
            <Button type="submit" disabled={pending}>
              Create
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename board</DialogTitle>
          </DialogHeader>
          <form onSubmit={renameBoard} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rename-title">Title</Label>
              <Input
                id="rename-title"
                name="title"
                defaultValue={board.title}
                required
                autoFocus
              />
            </div>
            <Button type="submit" disabled={pending}>
              Save
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ManageLabelsDialog
        companyId={companyId}
        boardId={board.id}
        labels={labels}
        open={labelsOpen}
        onOpenChange={setLabelsOpen}
      />
    </div>
  );
}

function ManageLabelsDialog({
  companyId,
  boardId,
  labels,
  open,
  onOpenChange,
}: {
  companyId: string;
  boardId: string;
  labels: DeckLabel[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [color, setColor] = useState(LABEL_COLORS[5]);

  const addLabel = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await createLabelAction(companyId, boardId, title, color);
      if (result.error) toast.error(result.error);
      else {
        setTitle("");
        router.refresh();
      }
    });
  };

  const removeLabel = (labelId: string) => {
    startTransition(async () => {
      await deleteLabelAction(companyId, labelId);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Board labels</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {labels.length === 0 && (
            <p className="text-sm text-muted-foreground">No labels yet.</p>
          )}
          {labels.map((label) => (
            <div
              key={label.id}
              className="flex items-center justify-between gap-2 rounded-md border border-white/5 px-3 py-2"
            >
              <span className="flex items-center gap-2 text-sm">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: label.color }}
                />
                {label.title}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => removeLabel(label.id)}
                disabled={pending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <form onSubmit={addLabel} className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="New label"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <Button type="submit" size="sm" disabled={pending}>
              Add
            </Button>
          </div>
          <div className="flex gap-1.5">
            {LABEL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  "h-6 w-6 rounded-full transition",
                  color === c && "ring-2 ring-white ring-offset-2 ring-offset-background"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StackColumn({
  companyId,
  board,
  stack,
  cards,
  labels,
  members,
}: {
  companyId: string;
  board: DeckBoard;
  stack: DeckStack;
  cards: DeckCard[];
  labels: DeckLabel[];
  members: DeckMember[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState(stack.title);
  const { setNodeRef, isOver } = useDroppable({ id: stack.id });

  const saveTitle = () => {
    setRenaming(false);
    if (titleDraft.trim() && titleDraft !== stack.title) {
      startTransition(async () => {
        await renameStackAction(companyId, stack.id, titleDraft);
        router.refresh();
      });
    } else {
      setTitleDraft(stack.title);
    }
  };

  const removeStack = () => {
    startTransition(async () => {
      const result = await deleteStackAction(companyId, stack.id);
      if (result.error) toast.error(result.error);
      else router.refresh();
    });
  };

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        {renaming ? (
          <Input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === "Enter" && saveTitle()}
            className="h-7 text-sm"
            autoFocus
          />
        ) : (
          <h3
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
            onDoubleClick={() => setRenaming(true)}
          >
            {stack.title}
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">
              {cards.length}
            </span>
          </h3>
        )}
        <div className="flex items-center">
          <CreateCardDialog
            companyId={companyId}
            boardId={board.id}
            stackId={stack.id}
            stackTitle={stack.title}
            members={members}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              }
            />
            <DropdownMenuContent className="w-40">
              <DropdownMenuItem onClick={() => setRenaming(true)}>
                <Pencil /> Rename list
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={removeStack}
                disabled={pending}
              >
                <Trash2 /> Delete list
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <SortableContext
        items={cards.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className={cn(
            "flex min-h-24 flex-1 flex-col gap-2 rounded-lg p-1 transition-colors",
            isOver && "bg-white/[0.04]"
          )}
        >
          {cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              companyId={companyId}
              boardLabels={labels}
              members={members}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function AddStackButton({
  companyId,
  boardId,
}: {
  companyId: string;
  boardId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [statusMap, setStatusMap] = useState("todo");

  const createStack = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = String(formData.get("title") ?? "");
    startTransition(async () => {
      const result = await createStackAction(
        companyId,
        boardId,
        title,
        statusMap as never
      );
      if (result.error) toast.error(result.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <div className="w-64 shrink-0">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 border border-dashed border-white/10 text-muted-foreground"
            >
              <Plus className="h-4 w-4" />
              Add list
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add list</DialogTitle>
          </DialogHeader>
          <form onSubmit={createStack} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stack-title">Title</Label>
              <Input id="stack-title" name="title" required autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Counts as status</Label>
              <Select
                value={statusMap}
                onValueChange={(v) => setStatusMap(v ?? "todo")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="backlog">Backlog</SelectItem>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Cards in this list report as this status on dashboards.
              </p>
            </div>
            <Button type="submit" disabled={pending}>
              Add list
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
