"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { requireCompanyAccess } from "@/lib/auth/access";
import { logAudit } from "@/lib/db/audit";
import { logTaskTime } from "@/lib/db/tasks";

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
