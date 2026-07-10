import { notFound } from "next/navigation";
import { TasksBoard } from "@/components/tasks/tasks-board";
import { getCompanyBySlug } from "@/features/companies/queries";
import { requireCompanyPageAccess } from "@/lib/auth/page-guards";
import { getCompanyMembers } from "@/lib/db/companies";
import { fetchTasksWithAssignees } from "@/lib/db/tasks";
import { listApprovedUsers } from "@/lib/db/users";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TasksPage({ params }: PageProps) {
  await requireCompanyPageAccess("tasks");
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const [tasks, companyMembers, allUsers] = await Promise.all([
    fetchTasksWithAssignees(company.id),
    getCompanyMembers(company.id),
    listApprovedUsers(),
  ]);

  const memberIds = new Set(companyMembers.map((m) => m.user_id as string));
  const members = allUsers
    .filter((u) => memberIds.has(u.id))
    .map((u) => ({ id: u.id, name: u.full_name }));

  if (members.length === 0) {
    members.push(...allUsers.map((u) => ({ id: u.id, name: u.full_name })));
  }

  const overdue = tasks.filter(
    (t) =>
      t.due_date &&
      new Date(t.due_date) < new Date() &&
      t.status !== "done"
  ).length;

  const totalLogged = tasks.reduce((s, t) => s + (t.time_logged_minutes ?? 0), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Task Management
        </h1>
        <p className="text-muted-foreground">
          {tasks.length} tasks · {overdue} overdue · {totalLogged} minutes logged
        </p>
      </div>
      <TasksBoard tasks={tasks} companyId={company.id} members={members} />
    </div>
  );
}
