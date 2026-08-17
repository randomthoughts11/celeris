"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, isPast } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { TaskWithAssignee } from "@/lib/db/tasks";
import { cn } from "@/lib/utils";

export type TeamTaskFilter = "open" | "overdue" | "all";
export type TeamTaskScope = "mine" | "team";

interface TeamTaskStatsProps {
  tasks: TaskWithAssignee[];
  completedCount: number;
  activeMembers: number;
  onClock: number;
  filter: TeamTaskFilter;
  scope: TeamTaskScope;
  currentUserId: string;
}

export function TeamTaskStats({
  tasks,
  completedCount,
  activeMembers,
  onClock,
  filter,
  scope,
  currentUserId,
}: TeamTaskStatsProps) {
  const router = useRouter();

  const scopedTasks =
    scope === "mine"
      ? tasks.filter((t) => t.assignee_id === currentUserId)
      : tasks;

  const overdueTasks = scopedTasks.filter(
    (t) => t.due_date && isPast(new Date(t.due_date))
  );
  const visible = filter === "overdue" ? overdueTasks : scopedTasks;

  const pushState = (nextFilter: TeamTaskFilter, nextScope: TeamTaskScope) => {
    const params = new URLSearchParams();
    if (nextFilter !== "all" && nextFilter !== "open") {
      params.set("filter", nextFilter);
    } else if (nextFilter === "open") {
      params.set("filter", "open");
    }
    if (nextScope === "mine") params.set("scope", "mine");
    const qs = params.toString();
    router.push(qs ? `/team?${qs}` : "/team", { scroll: false });
    requestAnimationFrame(() => {
      document.getElementById("team-tasks")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const title =
    filter === "overdue"
      ? `${scope === "mine" ? "My overdue" : "Overdue"} tasks (${overdueTasks.length})`
      : `${scope === "mine" ? "My open" : "Open"} tasks (${scopedTasks.length})`;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <button
          type="button"
          onClick={() => pushState("open", scope)}
          className={cn(
            "rounded-xl border border-white/5 bg-white/[0.03] p-5 text-left transition-colors hover:border-white/20 hover:bg-white/[0.05]",
            filter === "open" && "border-violet-500/40 bg-violet-500/10"
          )}
        >
          <p className="text-sm text-muted-foreground">
            {scope === "mine" ? "My open tasks" : "Open tasks"}
          </p>
          <p className="text-3xl font-semibold">{scopedTasks.length}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Click to view</p>
        </button>

        <Card className="border-white/5 bg-white/[0.03] p-5">
          <p className="text-sm text-muted-foreground">Completed overall</p>
          <p className="text-3xl font-semibold text-emerald-400">
            {completedCount}
          </p>
        </Card>

        <Card className="border-white/5 bg-white/[0.03] p-5">
          <p className="text-sm text-muted-foreground">Team members active</p>
          <p className="text-3xl font-semibold">{activeMembers}</p>
        </Card>

        <Card className="border-white/5 bg-white/[0.03] p-5">
          <p className="text-sm text-muted-foreground">On the clock</p>
          <p className="text-3xl font-semibold text-emerald-400">{onClock}</p>
        </Card>

        <button
          type="button"
          onClick={() => pushState("overdue", scope)}
          className={cn(
            "rounded-xl border border-white/5 bg-white/[0.03] p-5 text-left transition-colors hover:border-amber-500/40 hover:bg-amber-500/5",
            filter === "overdue" && "border-amber-500/50 bg-amber-500/10"
          )}
        >
          <p className="text-sm text-muted-foreground">
            {scope === "mine" ? "My overdue" : "Overdue"}
          </p>
          <p className="text-3xl font-semibold text-amber-400">
            {overdueTasks.length}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Click to view</p>
        </button>
      </div>

      <section id="team-tasks" className="scroll-mt-24 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <div className="flex flex-wrap gap-2">
            <div className="flex gap-1 rounded-full bg-white/5 p-0.5">
              <FilterChip
                active={scope === "mine"}
                onClick={() => pushState(filter === "all" ? "open" : filter, "mine")}
                label="My tasks"
              />
              <FilterChip
                active={scope === "team"}
                onClick={() => pushState(filter === "all" ? "open" : filter, "team")}
                label="Team tasks"
              />
            </div>
            <div className="flex gap-1">
              <FilterChip
                active={filter === "open" || filter === "all"}
                onClick={() => pushState("open", scope)}
                label="Open"
              />
              <FilterChip
                active={filter === "overdue"}
                onClick={() => pushState("overdue", scope)}
                label="Overdue"
              />
            </div>
          </div>
        </div>
        <Card className="overflow-hidden border-white/5 bg-white/[0.02]">
          <ul className="divide-y divide-white/5">
            {visible.map((task) => {
              const overdue = Boolean(
                task.due_date && isPast(new Date(task.due_date))
              );
              return (
                <li key={task.id}>
                  <Link
                    href={`/companies/${task.company_slug}/board`}
                    className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{task.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {task.company_name}
                        {task.created_by_name
                          ? ` · Created by ${task.created_by_name}`
                          : ""}
                        {task.assignee_name
                          ? ` · Assigned to ${task.assignee_name}`
                          : " · Unassigned"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {task.status.replace("_", " ")}
                      </Badge>
                      {overdue && (
                        <Badge className="bg-amber-500/20 text-amber-300">
                          Overdue
                        </Badge>
                      )}
                      {task.due_date && (
                        <span
                          className={cn(
                            "text-xs",
                            overdue && "text-amber-400"
                          )}
                        >
                          Due {format(new Date(task.due_date), "MMM d")}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
            {visible.length === 0 && (
              <li className="p-8 text-center text-muted-foreground">
                {filter === "overdue"
                  ? scope === "mine"
                    ? "You have no overdue tasks."
                    : "No overdue tasks — nice work."
                  : scope === "mine"
                    ? "Nothing assigned to you right now."
                    : "No open tasks."}
              </li>
            )}
          </ul>
        </Card>
      </section>
    </>
  );
}

function FilterChip({
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
        "rounded-full px-3 py-1 text-xs transition-colors",
        active
          ? "bg-white/15 text-foreground"
          : "bg-white/5 text-muted-foreground hover:bg-white/10"
      )}
    >
      {label}
    </button>
  );
}
