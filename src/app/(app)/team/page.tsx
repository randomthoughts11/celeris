import Link from "next/link";
import { format, isPast } from "date-fns";
import { redirect } from "next/navigation";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getAccessibleCompanyIds } from "@/lib/auth/access";
import { getSessionUser } from "@/lib/auth/session";
import { fetchRecentAuditLogs } from "@/lib/db/audit";
import { fetchAgencyTasks, fetchEmployeeWorkload } from "@/lib/db/tasks";
import { hasPermission } from "@/lib/rbac/permissions";
import { cn } from "@/lib/utils";

export default async function TeamDashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.approvalStatus !== "approved") redirect("/pending-approval");
  if (!hasPermission(user.roles, "MANAGE_ALL_COMPANIES")) {
    redirect("/");
  }

  const accessible = await getAccessibleCompanyIds(user);
  const [workload, tasks, activity] = await Promise.all([
    fetchEmployeeWorkload(accessible),
    fetchAgencyTasks(accessible),
    fetchRecentAuditLogs(30, accessible),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team dashboard</h1>
        <p className="text-muted-foreground">
          Who is working on what, across every brand
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-white/5 bg-white/[0.03] p-5">
          <p className="text-sm text-muted-foreground">Open tasks</p>
          <p className="text-3xl font-semibold">{tasks.length}</p>
        </Card>
        <Card className="border-white/5 bg-white/[0.03] p-5">
          <p className="text-sm text-muted-foreground">Team members active</p>
          <p className="text-3xl font-semibold">{workload.length}</p>
        </Card>
        <Card className="border-white/5 bg-white/[0.03] p-5">
          <p className="text-sm text-muted-foreground">Overdue</p>
          <p className="text-3xl font-semibold text-amber-400">
            {tasks.filter((t) => t.due_date && isPast(new Date(t.due_date))).length}
          </p>
        </Card>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Employee workload</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workload.map((person) => (
            <Card key={person.user_id} className="border-white/5 bg-white/[0.02] p-5">
              <div className="mb-3">
                <p className="font-semibold">{person.full_name}</p>
                <p className="text-xs text-muted-foreground">{person.email}</p>
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge variant="secondary">{person.open_tasks} open</Badge>
                <Badge variant={person.in_progress > 0 ? "default" : "outline"}>
                  {person.in_progress} in progress
                </Badge>
                {person.overdue_tasks > 0 && (
                  <Badge className="bg-amber-500/20 text-amber-300">
                    {person.overdue_tasks} overdue
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Brands: {person.companies.length ? person.companies.join(", ") : "—"}
              </p>
            </Card>
          ))}
          {workload.length === 0 && (
            <Card className="border-white/5 bg-white/[0.02] p-8 text-center text-muted-foreground md:col-span-2">
              No assigned tasks yet. Assign tasks on each brand&apos;s Tasks page.
            </Card>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">All open tasks</h2>
        <Card className="overflow-hidden border-white/5 bg-white/[0.02]">
          <ul className="divide-y divide-white/5">
            {tasks.map((task) => {
              const overdue = task.due_date && isPast(new Date(task.due_date));
              return (
                <li key={task.id}>
                  <Link
                    href={`/companies/${task.company_slug}/tasks`}
                    className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{task.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {task.company_name}
                        {task.assignee_name ? ` · ${task.assignee_name}` : " · Unassigned"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{task.status.replace("_", " ")}</Badge>
                      {task.due_date && (
                        <span className={cn("text-xs", overdue && "text-amber-400")}>
                          {format(new Date(task.due_date), "MMM d")}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
            {tasks.length === 0 && (
              <li className="p-8 text-center text-muted-foreground">No open tasks.</li>
            )}
          </ul>
        </Card>
      </section>

      <ActivityFeed entries={activity} title="Team activity log" />
    </div>
  );
}
