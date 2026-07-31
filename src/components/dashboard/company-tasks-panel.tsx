"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, isPast } from "date-fns";
import { ArrowRight, CheckCircle2, Circle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { TaskWithAssignee } from "@/lib/db/tasks";
import { cn } from "@/lib/utils";

type PanelScope = "mine" | "team";
type PanelStatus = "open" | "completed";

interface CompanyTasksPanelProps {
  tasks: TaskWithAssignee[];
  companySlug: string;
  currentUserId: string;
}

export function CompanyTasksPanel({
  tasks,
  companySlug,
  currentUserId,
}: CompanyTasksPanelProps) {
  const [scope, setScope] = useState<PanelScope>("mine");
  const [status, setStatus] = useState<PanelStatus>("open");

  const scoped = useMemo(() => {
    const base =
      scope === "mine"
        ? tasks.filter((t) => t.assignee_id === currentUserId)
        : tasks;
    if (status === "completed") {
      return base.filter((t) => t.status === "done");
    }
    return base.filter((t) => !["done", "cancelled"].includes(t.status));
  }, [tasks, scope, status, currentUserId]);

  const preview = scoped.slice(0, 8);
  const overdue = scoped.filter(
    (t) =>
      status === "open" &&
      t.due_date &&
      isPast(new Date(t.due_date)) &&
      t.status !== "done"
  ).length;

  return (
    <Card className="border-white/5 bg-white/[0.02] p-6 backdrop-blur-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">
            {scope === "mine" ? "Your tasks" : "Team tasks"} for this brand
          </h3>
          <p className="text-sm text-muted-foreground">
            {scoped.length} {status === "completed" ? "completed" : "open"}
            {status === "open" && overdue > 0 ? ` · ${overdue} overdue` : ""}
          </p>
        </div>
        <Link href={`/companies/${companySlug}/tasks?scope=${scope}`}>
          <Button variant="outline" size="sm" className="gap-2">
            Open board
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="flex rounded-lg border border-white/10 p-0.5">
          <Chip active={scope === "mine"} onClick={() => setScope("mine")}>
            My tasks
          </Chip>
          <Chip active={scope === "team"} onClick={() => setScope("team")}>
            Team tasks
          </Chip>
        </div>
        <div className="flex rounded-lg border border-white/10 p-0.5">
          <Chip active={status === "open"} onClick={() => setStatus("open")}>
            Open
          </Chip>
          <Chip
            active={status === "completed"}
            onClick={() => setStatus("completed")}
          >
            Completed
          </Chip>
        </div>
      </div>

      {preview.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {status === "completed"
            ? scope === "mine"
              ? "You have no completed tasks yet."
              : "No completed tasks for this brand yet."
            : scope === "mine"
              ? "Nothing assigned to you right now. Switch to Team tasks or open the board."
              : "No open tasks. Create work items on the Board."}
        </p>
      ) : (
        <ul className="space-y-3">
          {preview.map((task) => {
            const isOverdue =
              task.due_date &&
              isPast(new Date(task.due_date)) &&
              task.status !== "done";
            return (
              <li
                key={task.id}
                className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3"
              >
                {task.status === "done" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{task.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">
                      {task.status.replace("_", " ")}
                    </Badge>
                    {task.created_by_name && (
                      <span>Created by {task.created_by_name}</span>
                    )}
                    {task.assignee_name && (
                      <span>→ {task.assignee_name}</span>
                    )}
                    {task.due_date && (
                      <span
                        className={cn(
                          "flex items-center gap-1",
                          isOverdue && "text-amber-400"
                        )}
                      >
                        <Clock className="h-3 w-3" />
                        {format(new Date(task.due_date), "MMM d")}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1 text-xs transition-colors",
        active
          ? "bg-white/15 text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
