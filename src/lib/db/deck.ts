import { getSql } from "./client";
import type {
  DeckBoard,
  DeckCard,
  DeckComment,
  DeckLabel,
  DeckStack,
  Task,
  TaskStatus,
} from "@/types";

function mapBoard(row: Record<string, unknown>): DeckBoard {
  return {
    id: row.id as string,
    company_id: row.company_id as string,
    title: row.title as string,
    color: row.color as string,
    archived: Boolean(row.archived),
    created_by: (row.created_by as string) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapStack(row: Record<string, unknown>): DeckStack {
  return {
    id: row.id as string,
    board_id: row.board_id as string,
    title: row.title as string,
    position: Number(row.position ?? 0),
    status_map: row.status_map as TaskStatus,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapCard(row: Record<string, unknown>): DeckCard {
  return {
    id: row.id as string,
    company_id: row.company_id as string,
    assignee_id: (row.assignee_id as string) ?? null,
    created_by: (row.created_by as string) ?? null,
    title: row.title as string,
    description: (row.description as string) ?? null,
    task_type: row.task_type as Task["task_type"],
    status: row.status as TaskStatus,
    priority: row.priority as Task["priority"],
    due_date: row.due_date ? String(row.due_date) : null,
    completed_at: row.completed_at ? String(row.completed_at) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    board_id: (row.board_id as string) ?? null,
    stack_id: (row.stack_id as string) ?? null,
    position: Number(row.position ?? 0),
    assignee_name: (row.assignee_name as string) ?? null,
    created_by_name: (row.created_by_name as string) ?? null,
    time_logged_minutes: Number(row.time_logged_minutes ?? 0),
    comment_count: Number(row.comment_count ?? 0),
    attachment_count: Number(row.attachment_count ?? 0),
    labels: Array.isArray(row.labels) ? (row.labels as DeckLabel[]) : [],
  };
}

export async function fetchBoards(companyId: string): Promise<DeckBoard[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM deck_boards
    WHERE company_id = ${companyId} AND archived = false
    ORDER BY created_at ASC
  `;
  return rows.map(mapBoard);
}

export async function fetchBoard(
  boardId: string,
  companyId: string
): Promise<DeckBoard | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM deck_boards
    WHERE id = ${boardId} AND company_id = ${companyId}
  `;
  return rows[0] ? mapBoard(rows[0]) : null;
}

export async function fetchStacks(boardId: string): Promise<DeckStack[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM deck_stacks
    WHERE board_id = ${boardId}
    ORDER BY position ASC, created_at ASC
  `;
  return rows.map(mapStack);
}

export async function fetchBoardLabels(boardId: string): Promise<DeckLabel[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, board_id, title, color FROM deck_labels
    WHERE board_id = ${boardId}
    ORDER BY created_at ASC
  `;
  return rows.map((r) => ({
    id: r.id as string,
    board_id: r.board_id as string,
    title: r.title as string,
    color: r.color as string,
  }));
}

export async function fetchBoardCards(boardId: string): Promise<DeckCard[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT t.*,
      p.full_name AS assignee_name,
      creator.full_name AS created_by_name,
      COALESCE(
        (SELECT SUM(minutes)::int FROM task_time_logs WHERE task_id = t.id), 0
      ) AS time_logged_minutes,
      COALESCE(
        (SELECT COUNT(*)::int FROM task_comments WHERE task_id = t.id), 0
      ) AS comment_count,
      COALESCE(
        (SELECT COUNT(*)::int FROM task_attachments WHERE task_id = t.id), 0
      ) AS attachment_count,
      COALESCE(
        (
          SELECT json_agg(json_build_object(
            'id', l.id, 'board_id', l.board_id, 'title', l.title, 'color', l.color
          ))
          FROM deck_card_labels cl
          JOIN deck_labels l ON l.id = cl.label_id
          WHERE cl.task_id = t.id
        ),
        '[]'::json
      ) AS labels
    FROM tasks t
    LEFT JOIN profiles p ON p.id = t.assignee_id
    LEFT JOIN profiles creator ON creator.id = t.created_by
    WHERE t.board_id = ${boardId}
    ORDER BY t.position ASC, t.created_at ASC
  `;
  return rows.map(mapCard);
}

export async function fetchCardComments(
  taskId: string
): Promise<DeckComment[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT tc.*, p.full_name AS user_name
    FROM task_comments tc
    JOIN profiles p ON p.id = tc.user_id
    WHERE tc.task_id = ${taskId}
    ORDER BY tc.created_at ASC
  `;
  return rows.map((r) => ({
    id: r.id as string,
    task_id: r.task_id as string,
    user_id: r.user_id as string,
    user_name: r.user_name as string,
    content: r.content as string,
    created_at: String(r.created_at),
  }));
}

/** Ensures the company has at least one board with default stacks; returns its id. */
export async function ensureDefaultBoard(companyId: string): Promise<string> {
  const sql = getSql();
  const existing = await sql`
    SELECT id FROM deck_boards
    WHERE company_id = ${companyId} AND archived = false
    ORDER BY created_at ASC LIMIT 1
  `;
  if (existing[0]) return existing[0].id as string;

  const board = await sql`
    INSERT INTO deck_boards (company_id, title)
    VALUES (${companyId}, 'Main Board')
    RETURNING id
  `;
  const boardId = board[0].id as string;
  const defaults: Array<[string, number, TaskStatus]> = [
    ["Backlog", 0, "backlog"],
    ["To Do", 1, "todo"],
    ["In Progress", 2, "in_progress"],
    ["Review", 3, "review"],
    ["Done", 4, "done"],
  ];
  for (const [title, position, statusMap] of defaults) {
    await sql`
      INSERT INTO deck_stacks (board_id, title, position, status_map)
      VALUES (${boardId}, ${title}, ${position}, ${statusMap})
    `;
  }
  return boardId;
}
