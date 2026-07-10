import Link from "next/link";
import { format, isPast } from "date-fns";
import { ArrowRight, CheckCircle2, Circle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { TaskWithAssignee } from "@/lib/db/tasks";
import { cn } from "@/lib/utils";

interface CompanyTasksPanelProps {
  tasks: TaskWithAssignee[];
  companySlug: string;
}

export function CompanyTasksPanel({ tasks, companySlug }: CompanyTasksPanelProps) {
  const open = tasks.filter((t) => !["done", "cancelled"].includes(t.status));
  const preview = open.slice(0, 6);
  const overdue = open.filter(
    (t) => t.due_date && isPast(new Date(t.due_date)) && t.status !== "done"
  ).length;

  return (
    <Card className="border-white/5 bg-white/[0.02] p-6 backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold">Your tasks for this brand</h3>
          <p className="text-sm text-muted-foreground">
            {open.length} open · {overdue} overdue
          </p>
        </div>
        <Link href={`/companies/${companySlug}/tasks`}>
          <Button variant="outline" size="sm" className="gap-2">
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      {preview.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No open tasks. Create work items on the Tasks page.
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
                    {task.assignee_name && <span>{task.assignee_name}</span>}
                    {task.due_date && (
                      <span className={cn("flex items-center gap-1", isOverdue && "text-amber-400")}>
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
