"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { requireCompanyAccess } from "@/lib/auth/access";
import { logAudit } from "@/lib/db/audit";
import { getSql } from "@/lib/db/client";
import type { TaskPriority, TaskStatus, TaskType } from "@/types";

const revalidate = () => revalidatePath("/companies");

// ---------- Boards ----------

export async function createBoardAction(companyId: string, title: string) {
  const user = await requireAuth();
  await requireCompanyAccess(user, companyId);
  const trimmed = title.trim();
  if (!trimmed) return { error: "Board title required" };

  const sql = getSql();
  const rows = await sql`
    INSERT INTO deck_boards (company_id, title, created_by)
    VALUES (${companyId}, ${trimmed}, ${user.id})
    RETURNING id
  `;
  const boardId = rows[0].id as string;
  const defaults: Array<[string, number, TaskStatus]> = [
    ["To Do", 0, "todo"],
    ["In Progress", 1, "in_progress"],
    ["Done", 2, "done"],
  ];
  for (const [t, position, statusMap] of defaults) {
    await sql`
      INSERT INTO deck_stacks (board_id, title, position, status_map)
      VALUES (${boardId}, ${t}, ${position}, ${statusMap})
    `;
  }

  await logAudit({
    userId: user.id,
    companyId,
    action: "board.created",
    resourceType: "deck_board",
    resourceId: boardId,
    newValues: { title: trimmed },
  });
  revalidate();
  return { success: true, boardId };
}

export async function renameBoardAction(
  companyId: string,
  boardId: string,
  title: string
) {
  const user = await requireAuth();
  await requireCompanyAccess(user, companyId);
  const trimmed = title.trim();
  if (!trimmed) return { error: "Board title required" };

  const sql = getSql();
  await sql`
    UPDATE deck_boards SET title = ${trimmed}, updated_at = now()
    WHERE id = ${boardId} AND company_id = ${companyId}
  `;
  revalidate();
  return { success: true };
}

export async function archiveBoardAction(companyId: string, boardId: string) {
  const user = await requireAuth();
  await requireCompanyAccess(user, companyId);
  const sql = getSql();
  await sql`
    UPDATE deck_boards SET archived = true, updated_at = now()
    WHERE id = ${boardId} AND company_id = ${companyId}
  `;
  await logAudit({
    userId: user.id,
    companyId,
    action: "board.archived",
    resourceType: "deck_board",
    resourceId: boardId,
  });
  revalidate();
  return { success: true };
}

// ---------- Stacks ----------

export async function createStackAction(
  companyId: string,
  boardId: string,
  title: string,
  statusMap: TaskStatus = "todo"
) {
  const user = await requireAuth();
  await requireCompanyAccess(user, companyId);
  const trimmed = title.trim();
  if (!trimmed) return { error: "List title required" };

  const sql = getSql();
  await sql`
    INSERT INTO deck_stacks (board_id, title, position, status_map)
    VALUES (
      ${boardId},
      ${trimmed},
      COALESCE((SELECT MAX(position) + 1 FROM deck_stacks WHERE board_id = ${boardId}), 0),
      ${statusMap}
    )
  `;
  revalidate();
  return { success: true };
}

export async function renameStackAction(
  companyId: string,
  stackId: string,
  title: string
) {
  const user = await requireAuth();
  await requireCompanyAccess(user, companyId);
  const trimmed = title.trim();
  if (!trimmed) return { error: "List title required" };

  const sql = getSql();
  await sql`
    UPDATE deck_stacks SET title = ${trimmed}, updated_at = now()
    WHERE id = ${stackId}
  `;
  revalidate();
  return { success: true };
}

export async function deleteStackAction(companyId: string, stackId: string) {
  const user = await requireAuth();
  await requireCompanyAccess(user, companyId);
  const sql = getSql();

  const count = await sql`
    SELECT COUNT(*)::int AS n FROM tasks WHERE stack_id = ${stackId}
  `;
  if (Number(count[0]?.n ?? 0) > 0) {
    return { error: "Move or delete the cards in this list first" };
  }
  await sql`DELETE FROM deck_stacks WHERE id = ${stackId}`;
  revalidate();
  return { success: true };
}

// ---------- Cards ----------

export async function createCardAction(companyId: string, formData: FormData) {
  const user = await requireAuth();
  await requireCompanyAccess(user, companyId);

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Title required" };
  const boardId = String(formData.get("boardId") ?? "");
  const stackId = String(formData.get("stackId") ?? "");
  if (!boardId || !stackId) return { error: "Missing board or list" };

  const sql = getSql();
  const stack = await sql`
    SELECT status_map FROM deck_stacks WHERE id = ${stackId} AND board_id = ${boardId}
  `;
  if (!stack[0]) return { error: "List not found" };
  const status = stack[0].status_map as TaskStatus;

  const rows = await sql`
    INSERT INTO tasks (
      company_id, created_by, assignee_id, title, description,
      task_type, status, priority, due_date, board_id, stack_id, position
    )
    VALUES (
      ${companyId}, ${user.id},
      ${String(formData.get("assigneeId") ?? "") || null},
      ${title},
      ${String(formData.get("description") ?? "") || null},
      ${(String(formData.get("taskType") ?? "other") as TaskType)},
      ${status},
      ${(String(formData.get("priority") ?? "medium") as TaskPriority)},
      ${String(formData.get("dueDate") ?? "") || null},
      ${boardId},
      ${stackId},
      COALESCE((SELECT MAX(position) + 1 FROM tasks WHERE stack_id = ${stackId}), 0)
    )
    RETURNING id
  `;

  await logAudit({
    userId: user.id,
    companyId,
    action: "task.created",
    resourceType: "task",
    resourceId: rows[0].id as string,
    newValues: { title },
  });
  revalidate();
  return { success: true };
}

export async function updateCardAction(
  companyId: string,
  cardId: string,
  formData: FormData
) {
  const user = await requireAuth();
  await requireCompanyAccess(user, companyId);

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Title required" };

  const sql = getSql();
  await sql`
    UPDATE tasks SET
      title = ${title},
      description = ${String(formData.get("description") ?? "") || null},
      task_type = ${(String(formData.get("taskType") ?? "other") as TaskType)},
      priority = ${(String(formData.get("priority") ?? "medium") as TaskPriority)},
      due_date = ${String(formData.get("dueDate") ?? "") || null},
      assignee_id = ${String(formData.get("assigneeId") ?? "") || null},
      updated_at = now()
    WHERE id = ${cardId} AND company_id = ${companyId}
  `;
  revalidate();
  return { success: true };
}

/** Moves a card to a stack at the given index and re-sequences positions. */
export async function moveCardAction(
  companyId: string,
  cardId: string,
  toStackId: string,
  toIndex: number
) {
  const user = await requireAuth();
  await requireCompanyAccess(user, companyId);
  const sql = getSql();

  const stack = await sql`
    SELECT status_map FROM deck_stacks WHERE id = ${toStackId}
  `;
  if (!stack[0]) return { error: "List not found" };
  const status = stack[0].status_map as TaskStatus;
  const completedAt = status === "done" ? new Date().toISOString() : null;

  const existing = await sql`
    SELECT id FROM tasks
    WHERE stack_id = ${toStackId} AND id != ${cardId}
    ORDER BY position ASC, created_at ASC
  `;
  const ordered = existing.map((r) => r.id as string);
  const index = Math.max(0, Math.min(toIndex, ordered.length));
  ordered.splice(index, 0, cardId);

  await sql`
    UPDATE tasks SET
      stack_id = ${toStackId},
      status = ${status},
      completed_at = ${completedAt},
      updated_at = now()
    WHERE id = ${cardId} AND company_id = ${companyId}
  `;
  for (let i = 0; i < ordered.length; i++) {
    await sql`UPDATE tasks SET position = ${i} WHERE id = ${ordered[i]}`;
  }

  await logAudit({
    userId: user.id,
    companyId,
    action: "task.status_changed",
    resourceType: "task",
    resourceId: cardId,
    newValues: { status, stackId: toStackId },
  });
  revalidate();
  return { success: true };
}

export async function deleteCardAction(companyId: string, cardId: string) {
  const user = await requireAuth();
  await requireCompanyAccess(user, companyId);
  const sql = getSql();
  await sql`
    DELETE FROM tasks WHERE id = ${cardId} AND company_id = ${companyId}
  `;
  await logAudit({
    userId: user.id,
    companyId,
    action: "task.deleted",
    resourceType: "task",
    resourceId: cardId,
  });
  revalidate();
  return { success: true };
}

// ---------- Labels ----------

export async function createLabelAction(
  companyId: string,
  boardId: string,
  title: string,
  color: string
) {
  const user = await requireAuth();
  await requireCompanyAccess(user, companyId);
  const trimmed = title.trim();
  if (!trimmed) return { error: "Label title required" };

  const sql = getSql();
  await sql`
    INSERT INTO deck_labels (board_id, title, color)
    VALUES (${boardId}, ${trimmed}, ${color})
  `;
  revalidate();
  return { success: true };
}

export async function deleteLabelAction(companyId: string, labelId: string) {
  const user = await requireAuth();
  await requireCompanyAccess(user, companyId);
  const sql = getSql();
  await sql`DELETE FROM deck_labels WHERE id = ${labelId}`;
  revalidate();
  return { success: true };
}

export async function toggleCardLabelAction(
  companyId: string,
  cardId: string,
  labelId: string
) {
  const user = await requireAuth();
  await requireCompanyAccess(user, companyId);
  const sql = getSql();

  const existing = await sql`
    SELECT 1 FROM deck_card_labels WHERE task_id = ${cardId} AND label_id = ${labelId}
  `;
  if (existing[0]) {
    await sql`
      DELETE FROM deck_card_labels WHERE task_id = ${cardId} AND label_id = ${labelId}
    `;
  } else {
    await sql`
      INSERT INTO deck_card_labels (task_id, label_id)
      VALUES (${cardId}, ${labelId})
      ON CONFLICT DO NOTHING
    `;
  }
  revalidate();
  return { success: true };
}

// ---------- Comments ----------

export async function addCommentAction(
  companyId: string,
  cardId: string,
  content: string
) {
  const user = await requireAuth();
  await requireCompanyAccess(user, companyId);
  const trimmed = content.trim();
  if (!trimmed) return { error: "Comment cannot be empty" };

  const sql = getSql();
  await sql`
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES (${cardId}, ${user.id}, ${trimmed})
  `;
  revalidate();
  return { success: true };
}

export async function fetchCommentsAction(companyId: string, cardId: string) {
  const user = await requireAuth();
  await requireCompanyAccess(user, companyId);
  const { fetchCardComments } = await import("@/lib/db/deck");
  return fetchCardComments(cardId);
}
