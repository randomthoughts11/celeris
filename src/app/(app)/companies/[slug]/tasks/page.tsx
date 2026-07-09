import { notFound } from "next/navigation";
import { TasksBoard } from "@/components/tasks/tasks-board";
import { getTasks } from "@/features/companies/company-data";
import { getCompanyBySlug } from "@/features/companies/queries";
import { requireCompanyPageAccess } from "@/lib/auth/page-guards";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TasksPage({ params }: PageProps) {
  await requireCompanyPageAccess("tasks");
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const tasks = await getTasks(company.id);
  const overdue = tasks.filter(
    (t) =>
      t.due_date &&
      new Date(t.due_date) < new Date() &&
      t.status !== "done"
  ).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Task Management
        </h1>
        <p className="text-muted-foreground">
          {tasks.length} tasks · {overdue} overdue
        </p>
      </div>
      <TasksBoard tasks={tasks} companyId={company.id} />
    </div>
  );
}
