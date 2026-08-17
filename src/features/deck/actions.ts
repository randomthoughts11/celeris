"use server";

import { requireAuth } from "@/lib/auth/session";
import { requireCompanyAccess, requireCompanyFeature } from "@/lib/auth/access";
import { revalidateApp } from "@/lib/cache/revalidate";
import { logAudit } from "@/lib/db/audit";
import { getSql } from "@/lib/db/client";
import { createNotification } from "@/lib/db/notifications";
import type { TaskPriority, TaskStatus, TaskType } from "@/types";

const revalidate = () => {
  revalidateApp();
};

async function requireBoardMutation(companyId: string) {
  const user = await requireAuth();
  requireCompanyFeature(user, "board");
  await requireCompanyAccess(user, companyId);
  return user;
}

async function assertBoardInCompany(boardId: string, companyId: string) {
  const sql = getSql();
  const rows = await sql`
    SELECT 1 FROM deck_boards
    WHERE id = ${boardId} AND company_id = ${companyId}
    LIMIT 1
  `;
  return Boolean(rows[0]);
}

async function notifyAssignee(opts: {
  assigneeId: string | null;
  actorId: string;
  actorName: string;
  companyId: string;
  title: string;
  cardId: string;
}) {
  if (!opts.assigneeId || opts.assigneeId === opts.actorId) return;
  const sql = getSql();
  const company = await sql`
    SELECT slug FROM companies WHERE id = ${opts.companyId} LIMIT 1
  `;
  const slug = (company[0]?.slug as string) ?? "";
  await createNotification({
    userId: opts.assigneeId,
    companyId: opts.companyId,
    type: "system",
    title: "Task assigned to you",
    message: `${opts.actorName} assigned “${opts.title}” to you`,
    link: slug ? `/companies/${slug}/board` : undefined,
  });
}

// ---------- Boards ----------

export async function createBoardAction(companyId: string, title: string) {
  const user = await requireBoardMutation(companyId);
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
  const user = await requireBoardMutation(companyId);
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
  const user = await requireBoardMutation(companyId);
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
  const user = await requireBoardMutation(companyId);
  const trimmed = title.trim();
  if (!trimmed) return { error: "List title required" };
  if (!(await assertBoardInCompany(boardId, companyId))) {
    return { error: "Board not found" };
  }

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
  const user = await requireBoardMutation(companyId);
  const trimmed = title.trim();
  if (!trimmed) return { error: "List title required" };

  const sql = getSql();
  const result = await sql`
    UPDATE deck_stacks AS s SET title = ${trimmed}, updated_at = now()
    FROM deck_boards b
    WHERE s.id = ${stackId}
      AND s.board_id = b.id
      AND b.company_id = ${companyId}
    RETURNING s.id
  `;
  if (!result[0]) return { error: "List not found" };
  revalidate();
  return { success: true };
}

export async function deleteStackAction(companyId: string, stackId: string) {
  const user = await requireBoardMutation(companyId);
  const sql = getSql();

  const owned = await sql`
    SELECT s.id FROM deck_stacks s
    JOIN deck_boards b ON b.id = s.board_id
    WHERE s.id = ${stackId} AND b.company_id = ${companyId}
  `;
  if (!owned[0]) return { error: "List not found" };

  const count = await sql`
    SELECT COUNT(*)::int AS n FROM tasks WHERE stack_id = ${stackId}
  `;
  if (Number(count[0]?.n ?? 0) > 0) {
    return { error: "Move or delete the cards in this list first" };
  }
  await sql`
    DELETE FROM deck_stacks s
    USING deck_boards b
    WHERE s.id = ${stackId}
      AND s.board_id = b.id
      AND b.company_id = ${companyId}
  `;
  revalidate();
  return { success: true };
}

// ---------- Cards ----------

export async function createCardAction(companyId: string, formData: FormData) {
  const user = await requireBoardMutation(companyId);

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Title required" };
  const boardId = String(formData.get("boardId") ?? "");
  const stackId = String(formData.get("stackId") ?? "");
  if (!boardId || !stackId) return { error: "Missing board or list" };
  if (!(await assertBoardInCompany(boardId, companyId))) {
    return { error: "Board not found" };
  }

  const sql = getSql();
  const stack = await sql`
    SELECT s.status_map FROM deck_stacks s
    JOIN deck_boards b ON b.id = s.board_id
    WHERE s.id = ${stackId}
      AND s.board_id = ${boardId}
      AND b.company_id = ${companyId}
  `;
  if (!stack[0]) return { error: "List not found" };
  const status = stack[0].status_map as TaskStatus;
  const assigneeId = String(formData.get("assigneeId") ?? "") || null;

  const rows = await sql`
    INSERT INTO tasks (
      company_id, created_by, assignee_id, title, description,
      task_type, status, priority, due_date, board_id, stack_id, position
    )
    VALUES (
      ${companyId}, ${user.id},
      ${assigneeId},
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

  const cardId = rows[0].id as string;
  await notifyAssignee({
    assigneeId,
    actorId: user.id,
    actorName: user.fullName,
    companyId,
    title,
    cardId,
  });

  await logAudit({
    userId: user.id,
    companyId,
    action: "task.created",
    resourceType: "task",
    resourceId: cardId,
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
  const user = await requireBoardMutation(companyId);

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Title required" };

  const sql = getSql();
  const prev = await sql`
    SELECT assignee_id FROM tasks
    WHERE id = ${cardId} AND company_id = ${companyId}
  `;
  if (!prev[0]) return { error: "Card not found" };

  const assigneeId = String(formData.get("assigneeId") ?? "") || null;
  await sql`
    UPDATE tasks SET
      title = ${title},
      description = ${String(formData.get("description") ?? "") || null},
      task_type = ${(String(formData.get("taskType") ?? "other") as TaskType)},
      priority = ${(String(formData.get("priority") ?? "medium") as TaskPriority)},
      due_date = ${String(formData.get("dueDate") ?? "") || null},
      assignee_id = ${assigneeId},
      updated_at = now()
    WHERE id = ${cardId} AND company_id = ${companyId}
  `;

  const prevAssignee = (prev[0].assignee_id as string | null) ?? null;
  if (assigneeId && assigneeId !== prevAssignee) {
    await notifyAssignee({
      assigneeId,
      actorId: user.id,
      actorName: user.fullName,
      companyId,
      title,
      cardId,
    });
  }

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
  const user = await requireBoardMutation(companyId);
  const sql = getSql();

  const stack = await sql`
    SELECT s.board_id, s.status_map FROM deck_stacks s
    JOIN deck_boards b ON b.id = s.board_id
    WHERE s.id = ${toStackId} AND b.company_id = ${companyId}
  `;
  if (!stack[0]) return { error: "List not found" };
  const status = stack[0].status_map as TaskStatus;
  const boardId = stack[0].board_id as string;
  const completedAt = status === "done" ? new Date().toISOString() : null;

  const owned = await sql`
    SELECT id FROM tasks WHERE id = ${cardId} AND company_id = ${companyId}
  `;
  if (!owned[0]) return { error: "Card not found" };

  const existing = await sql`
    SELECT id FROM tasks
    WHERE stack_id = ${toStackId} AND id != ${cardId} AND company_id = ${companyId}
    ORDER BY position ASC, created_at ASC
  `;
  const ordered = existing.map((r) => r.id as string);
  const index = Math.max(0, Math.min(toIndex, ordered.length));
  ordered.splice(index, 0, cardId);

  await sql`
    UPDATE tasks SET
      board_id = ${boardId},
      stack_id = ${toStackId},
      status = ${status},
      completed_at = ${completedAt},
      updated_at = now()
    WHERE id = ${cardId} AND company_id = ${companyId}
  `;
  for (let i = 0; i < ordered.length; i++) {
    await sql`
      UPDATE tasks SET position = ${i}
      WHERE id = ${ordered[i]} AND company_id = ${companyId}
    `;
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
  return { success: true, status };
}

export async function deleteCardAction(companyId: string, cardId: string) {
  const user = await requireBoardMutation(companyId);
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
  const user = await requireBoardMutation(companyId);
  const trimmed = title.trim();
  if (!trimmed) return { error: "Label title required" };
  if (!(await assertBoardInCompany(boardId, companyId))) {
    return { error: "Board not found" };
  }

  const sql = getSql();
  await sql`
    INSERT INTO deck_labels (board_id, title, color)
    VALUES (${boardId}, ${trimmed}, ${color})
  `;
  revalidate();
  return { success: true };
}

export async function deleteLabelAction(companyId: string, labelId: string) {
  const user = await requireBoardMutation(companyId);
  const sql = getSql();
  const result = await sql`
    DELETE FROM deck_labels l
    USING deck_boards b
    WHERE l.id = ${labelId}
      AND l.board_id = b.id
      AND b.company_id = ${companyId}
    RETURNING l.id
  `;
  if (!result[0]) return { error: "Label not found" };
  revalidate();
  return { success: true };
}

export async function toggleCardLabelAction(
  companyId: string,
  cardId: string,
  labelId: string
) {
  const user = await requireBoardMutation(companyId);
  const sql = getSql();

  const owned = await sql`
    SELECT t.id FROM tasks t
    JOIN deck_labels l ON l.id = ${labelId}
    JOIN deck_boards b ON b.id = l.board_id AND b.id = t.board_id
    WHERE t.id = ${cardId}
      AND t.company_id = ${companyId}
      AND b.company_id = ${companyId}
  `;
  if (!owned[0]) return { error: "Card or label not found" };

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
  const user = await requireBoardMutation(companyId);
  const trimmed = content.trim();
  if (!trimmed) return { error: "Comment cannot be empty" };

  const sql = getSql();
  const card = await sql`
    SELECT id, assignee_id, created_by, title FROM tasks
    WHERE id = ${cardId} AND company_id = ${companyId}
  `;
  if (!card[0]) return { error: "Card not found" };

  await sql`
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES (${cardId}, ${user.id}, ${trimmed})
  `;

  const recipients = new Set<string>();
  if (card[0].assignee_id) recipients.add(card[0].assignee_id as string);
  if (card[0].created_by) recipients.add(card[0].created_by as string);
  recipients.delete(user.id);

  const company = await sql`
    SELECT slug FROM companies WHERE id = ${companyId} LIMIT 1
  `;
  const slug = (company[0]?.slug as string) ?? "";
  for (const uid of recipients) {
    await createNotification({
      userId: uid,
      companyId,
      type: "team_mention",
      title: "New comment on task",
      message: `${user.fullName} commented on “${card[0].title as string}”`,
      link: slug ? `/companies/${slug}/board` : undefined,
    });
  }

  revalidate();
  return { success: true };
}

export async function fetchCommentsAction(companyId: string, cardId: string) {
  const user = await requireBoardMutation(companyId);
  const sql = getSql();
  const owned = await sql`
    SELECT 1 FROM tasks WHERE id = ${cardId} AND company_id = ${companyId}
  `;
  if (!owned[0]) return [];
  const { fetchCardComments } = await import("@/lib/db/deck");
  return fetchCardComments(cardId);
}

// ---------- Attachments (screenshots / proof of work) ----------

const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024; // 4 MB
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

export async function uploadCardAttachmentAction(
  companyId: string,
  cardId: string,
  formData: FormData
) {
  const user = await requireBoardMutation(companyId);

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No file selected" };
  if (!ALLOWED_MIME.has(file.type)) {
    return { error: "Only PNG, JPG, WEBP, or GIF screenshots are allowed" };
  }
  if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) {
    return { error: "Screenshot must be under 4 MB" };
  }

  const sql = getSql();
  const owned = await sql`
    SELECT id FROM tasks WHERE id = ${cardId} AND company_id = ${companyId}
  `;
  if (!owned[0]) return { error: "Card not found" };

  const buffer = Buffer.from(await file.arrayBuffer());
  const { insertTaskAttachment } = await import("@/lib/db/attachments");
  const id = await insertTaskAttachment({
    taskId: cardId,
    companyId,
    uploadedBy: user.id,
    fileName: file.name || "screenshot.png",
    mimeType: file.type,
    sizeBytes: file.size,
    dataBase64: buffer.toString("base64"),
  });

  await logAudit({
    userId: user.id,
    companyId,
    action: "task.attachment_added",
    resourceType: "task",
    resourceId: cardId,
    newValues: { attachmentId: id, fileName: file.name },
  });
  revalidate();
  return { success: true, attachmentId: id };
}

export async function fetchAttachmentsAction(companyId: string, cardId: string) {
  const user = await requireBoardMutation(companyId);
  const sql = getSql();
  const owned = await sql`
    SELECT 1 FROM tasks WHERE id = ${cardId} AND company_id = ${companyId}
  `;
  if (!owned[0]) return [];
  const { fetchTaskAttachments } = await import("@/lib/db/attachments");
  return fetchTaskAttachments(cardId);
}

export async function deleteCardAttachmentAction(
  companyId: string,
  attachmentId: string
) {
  const user = await requireBoardMutation(companyId);
  const { deleteTaskAttachment } = await import("@/lib/db/attachments");
  const ok = await deleteTaskAttachment(attachmentId, companyId);
  if (!ok) return { error: "Attachment not found" };

  await logAudit({
    userId: user.id,
    companyId,
    action: "task.attachment_deleted",
    resourceType: "task_attachment",
    resourceId: attachmentId,
  });
  revalidate();
  return { success: true };
}
