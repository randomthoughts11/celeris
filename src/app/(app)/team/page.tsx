import { redirect } from "next/navigation";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { TeamAttendancePanel } from "@/components/dashboard/team-attendance-panel";
import {
  TeamTaskStats,
  type TeamTaskFilter,
  type TeamTaskScope,
} from "@/components/dashboard/team-task-stats";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getAccessibleCompanyIds } from "@/lib/auth/access";
import { getSessionUser } from "@/lib/auth/session";
import { fetchRecentAuditLogs } from "@/lib/db/audit";
import {
  fetchAgencyTasks,
  fetchCompletedTaskCount,
  fetchEmployeeWorkload,
} from "@/lib/db/tasks";
import { fetchActiveShifts, fetchRecentShifts } from "@/lib/db/work-shifts";
import { hasAnyRole } from "@/lib/rbac/permissions";

interface PageProps {
  searchParams: Promise<{ filter?: string; scope?: string }>;
}

export default async function TeamDashboardPage({ searchParams }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.approvalStatus !== "approved") redirect("/pending-approval");
  if (!hasAnyRole(user.roles, ["god_mode", "admin", "manager"])) {
    redirect("/");
  }

  const { filter: filterParam, scope: scopeParam } = await searchParams;
  const filter: TeamTaskFilter =
    filterParam === "overdue"
      ? "overdue"
      : filterParam === "open"
        ? "open"
        : "all";
  const scope: TeamTaskScope = scopeParam === "mine" ? "mine" : "team";

  const accessible = await getAccessibleCompanyIds(user);
  const [workload, tasks, completedCount, activity, activeShifts, recentShifts] =
    await Promise.all([
      fetchEmployeeWorkload(accessible),
      fetchAgencyTasks(accessible),
      fetchCompletedTaskCount(accessible),
      fetchRecentAuditLogs(30, accessible),
      fetchActiveShifts(),
      fetchRecentShifts(30),
    ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team dashboard</h1>
        <p className="text-muted-foreground">
          Who is working on what, across every brand
        </p>
      </div>

      <TeamTaskStats
        tasks={tasks}
        completedCount={completedCount}
        activeMembers={workload.length}
        onClock={activeShifts.length}
        filter={filter}
        scope={scope}
        currentUserId={user.id}
      />

      <TeamAttendancePanel active={activeShifts} recent={recentShifts} />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Employee workload</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workload.map((person) => (
            <Card
              key={person.user_id}
              className="border-white/5 bg-white/[0.02] p-5"
            >
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
                Brands:{" "}
                {person.companies.length ? person.companies.join(", ") : "—"}
              </p>
            </Card>
          ))}
          {workload.length === 0 && (
            <Card className="border-white/5 bg-white/[0.02] p-8 text-center text-muted-foreground md:col-span-2">
              No assigned tasks yet. Assign tasks on each brand&apos;s Tasks
              page.
            </Card>
          )}
        </div>
      </section>

      <ActivityFeed entries={activity} title="Team activity log" />
    </div>
  );
}
