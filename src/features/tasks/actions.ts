"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { requireCompanyAccess } from "@/lib/auth/access";
import { getSql } from "@/lib/db/client";
import type { TaskPriority, TaskStatus, TaskType } from "@/types";

export async function createTaskAction(companyId: string, formData: FormData) {
  const user = await requireAuth();
  await requireCompanyAccess(user, companyId);

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Title required" };

  const sql = getSql();
  await sql`
    INSERT INTO tasks (company_id, created_by, assignee_id, title, description, task_type, status, priority, due_date)
    VALUES (
      ${companyId}, ${user.id},
      ${String(formData.get("assigneeId") ?? "") || null},
      ${title},
      ${String(formData.get("description") ?? "") || null},
      ${(String(formData.get("taskType") ?? "other") as TaskType)},
      ${(String(formData.get("status") ?? "todo") as TaskStatus)},
      ${(String(formData.get("priority") ?? "medium") as TaskPriority)},
      ${String(formData.get("dueDate") ?? "") || null}
    )
  `;

  revalidatePath(`/companies`);
  return { success: true };
}

export async function updateTaskStatusAction(
  taskId: string,
  companyId: string,
  status: TaskStatus
) {
  const user = await requireAuth();
  await requireCompanyAccess(user, companyId);
  const sql = getSql();
  const completedAt = status === "done" ? new Date().toISOString() : null;
  await sql`
    UPDATE tasks SET status = ${status}, completed_at = ${completedAt}, updated_at = now()
    WHERE id = ${taskId} AND company_id = ${companyId}
  `;
  revalidatePath(`/companies`);
  return { success: true };
}
