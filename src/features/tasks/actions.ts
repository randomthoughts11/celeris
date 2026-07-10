"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { requireCompanyAccess } from "@/lib/auth/access";
import { logAudit } from "@/lib/db/audit";
import { getSql } from "@/lib/db/client";
import { logTaskTime } from "@/lib/db/tasks";
import type { TaskPriority, TaskStatus, TaskType } from "@/types";

export async function createTaskAction(companyId: string, formData: FormData) {
  const user = await requireAuth();
  await requireCompanyAccess(user, companyId);

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Title required" };

  const assigneeId = String(formData.get("assigneeId") ?? "") || null;
  const sql = getSql();
  const rows = await sql`
    INSERT INTO tasks (company_id, created_by, assignee_id, title, description, task_type, status, priority, due_date)
    VALUES (
      ${companyId}, ${user.id},
      ${assigneeId},
      ${title},
      ${String(formData.get("description") ?? "") || null},
      ${(String(formData.get("taskType") ?? "other") as TaskType)},
      ${(String(formData.get("status") ?? "todo") as TaskStatus)},
      ${(String(formData.get("priority") ?? "medium") as TaskPriority)},
      ${String(formData.get("dueDate") ?? "") || null}
    )
    RETURNING id
  `;

  await logAudit({
    userId: user.id,
    companyId,
    action: "task.created",
    resourceType: "task",
    resourceId: rows[0].id as string,
    newValues: { title, assigneeId },
  });

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

  const existing = await sql`
    SELECT status FROM tasks WHERE id = ${taskId} AND company_id = ${companyId}
  `;
  const oldStatus = existing[0]?.status as string | undefined;

  const completedAt = status === "done" ? new Date().toISOString() : null;
  await sql`
    UPDATE tasks SET status = ${status}, completed_at = ${completedAt}, updated_at = now()
    WHERE id = ${taskId} AND company_id = ${companyId}
  `;

  await logAudit({
    userId: user.id,
    companyId,
    action: "task.status_changed",
    resourceType: "task",
    resourceId: taskId,
    oldValues: { status: oldStatus },
    newValues: { status },
  });

  revalidatePath(`/companies`);
  return { success: true };
}

export async function logTaskTimeAction(
  taskId: string,
  companyId: string,
  minutes: number,
  note?: string
) {
  const user = await requireAuth();
  await requireCompanyAccess(user, companyId);
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 24 * 60) {
    return { error: "Enter a valid duration in minutes (1–1440)" };
  }

  await logTaskTime({
    taskId,
    userId: user.id,
    minutes: Math.round(minutes),
    note: note?.trim() || undefined,
  });

  await logAudit({
    userId: user.id,
    companyId,
    action: "task.time_logged",
    resourceType: "task",
    resourceId: taskId,
    newValues: { minutes: Math.round(minutes), note },
  });

  revalidatePath(`/companies`);
  return { success: true };
}
