import { AllTasksClient } from "@/components/tasks/all-tasks-client";
import { getAccessibleCompanyIds } from "@/lib/auth/access";
import { requireGlobalNavAccess } from "@/lib/auth/page-guards";
import { fetchAgencyTasks } from "@/lib/db/tasks";
import { hasAnyRole } from "@/lib/rbac/permissions";

export default async function TasksPage() {
  const user = await requireGlobalNavAccess("tasks");
  const tasks = await fetchAgencyTasks(await getAccessibleCompanyIds(user));
  const lead = hasAnyRole(user.roles, ["god_mode", "admin", "manager"]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <p className="text-muted-foreground">Every open task across all brands, in one place.</p>
      </div>
      <AllTasksClient tasks={tasks} currentUserId={user.id} defaultScope={lead ? "all" : "mine"} />
    </div>
  );
}
