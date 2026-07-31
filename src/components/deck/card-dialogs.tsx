"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Check, ImagePlus, Plus, Send, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { LogTaskTimeButton } from "@/components/tasks/log-task-time-button";
import {
  addCommentAction,
  createCardAction,
  deleteCardAction,
  deleteCardAttachmentAction,
  fetchAttachmentsAction,
  fetchCommentsAction,
  toggleCardLabelAction,
  updateCardAction,
  uploadCardAttachmentAction,
} from "@/features/deck/actions";
import type { DeckCard, DeckComment, DeckLabel } from "@/types";
import type { TaskAttachment } from "@/lib/db/attachments";
import { cn } from "@/lib/utils";
import type { DeckMember } from "./deck-board";

/** General work types first — social/ads types are optional, not the default. */
const typeLabels: Record<string, string> = {
  other: "General",
  design: "Design",
  development: "Development",
  meeting: "Meeting",
  support: "Support",
  copywriting: "Copywriting",
  approval: "Approval",
  seo: "SEO",
  publishing: "Social / Publishing",
  campaign_launch: "Ads / Campaign",
};

export function CreateCardDialog({
  companyId,
  boardId,
  stackId,
  stackTitle,
  members,
}: {
  companyId: string;
  boardId: string;
  stackId: string;
  stackTitle: string;
  members: DeckMember[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [taskType, setTaskType] = useState("other");
  const [priority, setPriority] = useState("medium");
  const [assigneeId, setAssigneeId] = useState("");

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("boardId", boardId);
    formData.set("stackId", stackId);
    formData.set("taskType", taskType);
    formData.set("priority", priority);
    if (assigneeId) formData.set("assigneeId", assigneeId);
    startTransition(async () => {
      const result = await createCardAction(companyId, formData);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Card created");
        setOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm">
            <Plus className="h-4 w-4" />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New card in “{stackTitle}”</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="card-title">Title</Label>
            <Input id="card-title" name="title" required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="card-description">Description</Label>
            <Textarea id="card-description" name="description" rows={3} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Type (optional)</Label>
              <Select
                value={taskType}
                onValueChange={(v) => setTaskType(v ?? "other")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(typeLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Defaults to General. Social / Ads types are only for that kind of
                work — not required on every card.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v ?? "medium")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="card-due">Due date</Label>
              <Input id="card-due" name="dueDate" type="date" />
            </div>
            {members.length > 0 && (
              <div className="space-y-2">
                <Label>Assign to</Label>
                <Select
                  value={assigneeId}
                  onValueChange={(v) => setAssigneeId(v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <Button type="submit" disabled={pending}>
            Create card
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CardDetailDialog({
  card,
  companyId,
  boardLabels,
  members,
  open,
  onOpenChange,
}: {
  card: DeckCard;
  companyId: string;
  boardLabels: DeckLabel[];
  members: DeckMember[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [taskType, setTaskType] = useState(card.task_type);
  const [priority, setPriority] = useState<string>(card.priority);
  const [assigneeId, setAssigneeId] = useState(card.assignee_id ?? "");
  const [comments, setComments] = useState<DeckComment[] | null>(null);
  const [attachments, setAttachments] = useState<TaskAttachment[] | null>(
    null
  );
  const [comment, setComment] = useState("");

  // Reset the form each time the dialog opens with the card's latest values.
  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setTaskType(card.task_type);
      setPriority(card.priority);
      setAssigneeId(card.assignee_id ?? "");
      setComments(null);
      setAttachments(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all([
      fetchCommentsAction(companyId, card.id),
      fetchAttachmentsAction(companyId, card.id),
    ])
      .then(([nextComments, nextAttachments]) => {
        if (cancelled) return;
        setComments(nextComments);
        setAttachments(nextAttachments);
      })
      .catch(() => {
        if (cancelled) return;
        setComments([]);
        setAttachments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, card.id, companyId]);

  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("taskType", taskType);
    formData.set("priority", priority);
    formData.set("assigneeId", assigneeId);
    startTransition(async () => {
      const result = await updateCardAction(companyId, card.id, formData);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Card updated");
        router.refresh();
      }
    });
  };

  const toggleLabel = (labelId: string) => {
    startTransition(async () => {
      await toggleCardLabelAction(companyId, card.id, labelId);
      router.refresh();
    });
  };

  const sendComment = (e: React.FormEvent) => {
    e.preventDefault();
    const content = comment;
    startTransition(async () => {
      const result = await addCommentAction(companyId, card.id, content);
      if (result.error) toast.error(result.error);
      else {
        setComment("");
        const updated = await fetchCommentsAction(companyId, card.id);
        setComments(updated);
        router.refresh();
      }
    });
  };

  const uploadScreenshot = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const result = await uploadCardAttachmentAction(
        companyId,
        card.id,
        formData
      );
      if (result.error) toast.error(result.error);
      else {
        toast.success("Screenshot uploaded");
        const updated = await fetchAttachmentsAction(companyId, card.id);
        setAttachments(updated);
        router.refresh();
      }
    });
  };

  const removeAttachment = (attachmentId: string) => {
    startTransition(async () => {
      const result = await deleteCardAttachmentAction(companyId, attachmentId);
      if (result.error) toast.error(result.error);
      else {
        setAttachments((prev) =>
          prev ? prev.filter((a) => a.id !== attachmentId) : prev
        );
        router.refresh();
      }
    });
  };

  const remove = () => {
    startTransition(async () => {
      await deleteCardAction(companyId, card.id);
      toast.success("Card deleted");
      onOpenChange(false);
      router.refresh();
    });
  };

  const cardLabelIds = new Set(card.labels.map((l) => l.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto sm:max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Card details</DialogTitle>
        </DialogHeader>

        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`title-${card.id}`}>Title</Label>
            <Input
              id={`title-${card.id}`}
              name="title"
              defaultValue={card.title}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`desc-${card.id}`}>Description</Label>
            <Textarea
              id={`desc-${card.id}`}
              name="description"
              defaultValue={card.description ?? ""}
              rows={3}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Type (optional)</Label>
              <Select
                value={taskType}
                onValueChange={(v) => setTaskType((v ?? "other") as never)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(typeLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v ?? "medium")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`due-${card.id}`}>Due date</Label>
              <Input
                id={`due-${card.id}`}
                name="dueDate"
                type="date"
                defaultValue={
                  card.due_date
                    ? format(new Date(card.due_date), "yyyy-MM-dd")
                    : ""
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Assignee</Label>
              <Select
                value={assigneeId}
                onValueChange={(v) => setAssigneeId(v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {boardLabels.length > 0 && (
            <div className="space-y-2">
              <Label>Labels</Label>
              <div className="flex flex-wrap gap-1.5">
                {boardLabels.map((label) => {
                  const active = cardLabelIds.has(label.id);
                  return (
                    <button
                      key={label.id}
                      type="button"
                      onClick={() => toggleLabel(label.id)}
                      disabled={pending}
                      className={cn(
                        "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition",
                        active
                          ? "border-transparent"
                          : "border-white/10 text-muted-foreground hover:border-white/25"
                      )}
                      style={
                        active
                          ? {
                              backgroundColor: `${label.color}26`,
                              color: label.color,
                            }
                          : undefined
                      }
                    >
                      {active && <Check className="h-3 w-3" />}
                      {label.title}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <LogTaskTimeButton
                taskId={card.id}
                companyId={companyId}
                loggedMinutes={card.time_logged_minutes}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-red-400 hover:text-red-300"
                onClick={remove}
                disabled={pending}
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </Button>
            </div>
            <Button type="submit" size="sm" disabled={pending}>
              Save changes
            </Button>
          </div>
        </form>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Screenshots</p>
              <p className="text-xs text-muted-foreground">
                Proof of work — posts, ads, deliverables, etc.
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors hover:bg-white/5">
              <ImagePlus className="h-3.5 w-3.5" />
              Upload
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="sr-only"
                disabled={pending}
                onChange={(e) => {
                  uploadScreenshot(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {attachments === null ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : attachments.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No screenshots yet. Upload one when the work is done.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {attachments.map((file) => (
                <div
                  key={file.id}
                  className="group relative overflow-hidden rounded-md border border-white/10 bg-black/20"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={file.data_url}
                    alt={file.file_name}
                    className="aspect-video w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/70 px-2 py-1">
                    <span className="truncate text-[10px] text-white/80">
                      {file.file_name}
                    </span>
                    <button
                      type="button"
                      className="text-red-300 hover:text-red-200"
                      disabled={pending}
                      onClick={() => removeAttachment(file.id)}
                      title="Remove"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-3">
          <p className="text-sm font-medium">Comments</p>
          {comments === null ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No comments yet.</p>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="rounded-md bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium">{c.user_name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(c.created_at), "MMM d, HH:mm")}
                    </p>
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-wrap">
                    {c.content}
                  </p>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={sendComment} className="flex gap-2">
            <Input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Write a comment…"
              required
            />
            <Button type="submit" size="icon" disabled={pending}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
