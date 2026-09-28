"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, isPast, isToday } from "date-fns";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { TaskWithAssignee } from "@/lib/db/tasks";
import type { TaskStatus } from "@/types";
import { cn } from "@/lib/utils";

const STATUS: { id: TaskStatus; label: string; dot: string }[] = [
  { id: "backlog", label: "Backlog", dot: "bg-slate-400" },
  { id: "todo", label: "To do", dot: "bg-slate-500" },
  { id: "in_progress", label: "In progress", dot: "bg-blue-600" },
  { id: "review", label: "Review", dot: "bg-purple-600" },
  { id: "blocked", label: "Blocked", dot: "bg-red-600" },
];

const PRIORITY_CLASS: Record<string, string> = {
  urgent: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-blue-100 text-blue-700",
  low: "bg-slate-100 text-slate-600",
};

type Scope = "mine" | "all" | "unassigned";

export function AllTasksClient({
  tasks,
  currentUserId,
  defaultScope,
}: {
  tasks: TaskWithAssignee[];
  currentUserId: string;
  defaultScope: Scope;
}) {
  const [scope, setScope] = useState<Scope>(defaultScope);
  const [brand, setBrand] = useState("all");
  const [status, setStatus] = useState<TaskStatus | "all">("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [query, setQuery] = useState("");

  const brands = useMemo(
    () => [...new Map(tasks.map((t) => [t.company_slug, t.company_name])).entries()].sort((a, b) => a[1].localeCompare(b[1])),
    [tasks]
  );

  const isOverdue = (t: TaskWithAssignee) =>
    Boolean(t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)));

  const inScope = tasks.filter((t) =>
    scope === "mine" ? t.assignee_id === currentUserId : scope === "unassigned" ? !t.assignee_id : true
  );
  const q = query.trim().toLowerCase();
  const visible = inScope.filter(
    (t) =>
      (brand === "all" || t.company_slug === brand) &&
      (status === "all" || t.status === status) &&
      (!overdueOnly || isOverdue(t)) &&
      (!q || t.title.toLowerCase().includes(q) || (t.assignee_name ?? "").toLowerCase().includes(q))
  );

  const count = (s: TaskStatus) => inScope.filter((t) => t.status === s).length;
  const overdueCount = inScope.filter(isOverdue).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STATUS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStatus(status === s.id ? "all" : s.id)}
            className={cn(
              "rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted",
              status === s.id && "border-primary ring-1 ring-primary"
            )}
          >
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-full", s.dot)} />
              {s.label}
            </p>
            <p className="mt-1 text-2xl font-semibold">{count(s.id)}</p>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOverdueOnly((v) => !v)}
          className={cn(
            "rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted",
            overdueOnly && "border-orange-500 ring-1 ring-orange-500"
          )}
        >
          <p className="text-xs text-muted-foreground">Overdue</p>
          <p className="mt-1 text-2xl font-semibold text-orange-600">{overdueCount}</p>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border bg-card p-0.5">
          {(
            [
              ["mine", "My tasks"],
              ["all", "All tasks"],
              ["unassigned", "Unassigned"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setScope(id)}
              className={cn(
                "rounded px-3 py-1 text-sm transition-colors",
                scope === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          aria-label="Brand"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="h-9 rounded-md border border-input bg-card px-3 text-sm"
        >
          <option value="all">All brands</option>
          {brands.map(([slug, name]) => (
            <option key={slug} value={slug}>{name}</option>
          ))}
        </select>
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks or people…"
            className="pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Task</th>
              <th className="px-4 py-2.5 font-medium">Brand</th>
              <th className="px-4 py-2.5 font-medium">Assignee</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Priority</th>
              <th className="px-4 py-2.5 font-medium">Due</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visible.map((t) => {
              const st = STATUS.find((s) => s.id === t.status);
              const overdue = isOverdue(t);
              return (
                <tr key={t.id} className="hover:bg-muted/50">
                  <td className="px-4 py-2.5">
                    <Link href={`/companies/${t.company_slug}/board`} className="font-medium hover:text-primary hover:underline">
                      {t.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{t.company_name}</td>
                  <td className="px-4 py-2.5">
                    {t.assignee_name ?? <span className="text-muted-foreground">Unassigned</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-1.5">
                      <span className={cn("h-2 w-2 rounded-full", st?.dot ?? "bg-slate-400")} />
                      {st?.label ?? t.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge className={cn("capitalize", PRIORITY_CLASS[t.priority])}>{t.priority}</Badge>
                  </td>
                  <td className={cn("px-4 py-2.5 whitespace-nowrap", overdue ? "font-medium text-orange-600" : "text-muted-foreground")}>
                    {t.due_date ? format(new Date(t.due_date), "MMM d") : "—"}
                    {overdue && " · overdue"}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  {scope === "mine" ? "Nothing assigned to you matches these filters." : "No tasks match these filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Showing {visible.length} of {inScope.length} open tasks. Done and cancelled tasks are hidden.
      </p>
    </div>
  );
}
