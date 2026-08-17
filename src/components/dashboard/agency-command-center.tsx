import Link from "next/link";
import { format, isPast } from "date-fns";
import { ArrowRight, Building2, Clock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { TaskWithAssignee } from "@/lib/db/tasks";
import { cn } from "@/lib/utils";

interface AgencyCommandCenterProps {
  tasks: TaskWithAssignee[];
}

export function AgencyCommandCenter({ tasks }: AgencyCommandCenterProps) {
  const overdue = tasks.filter(
    (t) => t.due_date && isPast(new Date(t.due_date))
  );
  const byBrand = new Map<string, TaskWithAssignee[]>();
  for (const task of tasks) {
    const list = byBrand.get(task.company_slug) ?? [];
    list.push(task);
    byBrand.set(task.company_slug, list);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">What&apos;s due</h2>
          <p className="text-sm text-muted-foreground">
            Across every brand — {tasks.length} open · {overdue.length} overdue
          </p>
        </div>
        <Link href="/team">
          <Button variant="outline" size="sm" className="gap-2">
            <Users className="h-3.5 w-3.5" />
            Team dashboard
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-white/5 bg-white/[0.02] p-5">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">
            Due soon / overdue
          </h3>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open tasks agency-wide.</p>
          ) : (
            <ul className="space-y-2">
              {tasks.slice(0, 8).map((task) => {
                const late = task.due_date && isPast(new Date(task.due_date));
                return (
                  <li key={task.id}>
                    <Link
                      href={`/companies/${task.company_slug}/board`}
                      className="flex items-start justify-between gap-3 rounded-lg p-2 transition-colors hover:bg-white/5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {task.company_name}
                          {task.assignee_name ? ` · ${task.assignee_name}` : ""}
                        </p>
                      </div>
                      {task.due_date && (
                        <span className={cn("shrink-0 text-xs", late && "text-amber-400")}>
                          {format(new Date(task.due_date), "MMM d")}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="border-white/5 bg-white/[0.02] p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            Open tasks by brand
          </h3>
          <ul className="space-y-2">
            {[...byBrand.entries()].map(([slug, brandTasks]) => (
              <li key={slug}>
                <Link
                  href={`/companies/${slug}`}
                  className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-white/5"
                >
                  <span className="text-sm">{brandTasks[0]?.company_name}</span>
                  <Badge variant="secondary">{brandTasks.length}</Badge>
                </Link>
              </li>
            ))}
            {byBrand.size === 0 && (
              <p className="text-sm text-muted-foreground">No brand workload yet.</p>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
