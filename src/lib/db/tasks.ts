import { getSql } from "./client";
import type { Task, TaskStatus } from "@/types";

export interface TaskWithAssignee extends Task {
  assignee_name: string | null;
  created_by_name: string | null;
  company_name: string;
  company_slug: string;
  time_logged_minutes?: number;
}

export async function fetchTasksWithAssignees(
  companyId: string
): Promise<TaskWithAssignee[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT t.*,
      p.full_name AS assignee_name,
      creator.full_name AS created_by_name,
      c.name AS company_name,
      c.slug AS company_slug,
      COALESCE(
        (SELECT SUM(minutes)::int FROM task_time_logs WHERE task_id = t.id),
        0
      ) AS time_logged_minutes
    FROM tasks t
    JOIN companies c ON c.id = t.company_id
    LEFT JOIN profiles p ON p.id = t.assignee_id
    LEFT JOIN profiles creator ON creator.id = t.created_by
    WHERE t.company_id = ${companyId}
    ORDER BY
      CASE WHEN t.status IN ('done', 'cancelled') THEN 1 ELSE 0 END,
      t.due_date ASC NULLS LAST,
      t.priority DESC,
      t.created_at DESC
  `;
  return rows.map(mapTaskRow);
}

export async function fetchAgencyTasks(
  accessibleIds: string[] | "all"
): Promise<TaskWithAssignee[]> {
  const sql = getSql();
  const rows =
    accessibleIds === "all"
      ? await sql`
          SELECT t.*,
            p.full_name AS assignee_name,
            creator.full_name AS created_by_name,
            c.name AS company_name,
            c.slug AS company_slug
          FROM tasks t
          JOIN companies c ON c.id = t.company_id AND c.is_active = true
          LEFT JOIN profiles p ON p.id = t.assignee_id
          LEFT JOIN profiles creator ON creator.id = t.created_by
          WHERE t.status NOT IN ('done', 'cancelled')
          ORDER BY t.due_date ASC NULLS LAST, t.priority DESC
        `
      : accessibleIds.length === 0
        ? []
        : await sql`
            SELECT t.*,
              p.full_name AS assignee_name,
              creator.full_name AS created_by_name,
              c.name AS company_name,
              c.slug AS company_slug
            FROM tasks t
            JOIN companies c ON c.id = t.company_id AND c.is_active = true
            LEFT JOIN profiles p ON p.id = t.assignee_id
            LEFT JOIN profiles creator ON creator.id = t.created_by
            WHERE t.company_id = ANY(${accessibleIds}::uuid[])
              AND t.status NOT IN ('done', 'cancelled')
            ORDER BY t.due_date ASC NULLS LAST, t.priority DESC
          `;
  return rows.map(mapTaskRow);
}

export interface EmployeeWorkload {
  user_id: string;
  full_name: string;
  email: string;
  open_tasks: number;
  overdue_tasks: number;
  in_progress: number;
  companies: string[];
}

export async function fetchEmployeeWorkload(
  accessibleIds: string[] | "all"
): Promise<EmployeeWorkload[]> {
  const sql = getSql();

  const rows =
    accessibleIds === "all"
      ? await sql`
          SELECT
            p.id AS user_id,
            p.full_name,
            p.email,
            COUNT(t.id) FILTER (WHERE t.status NOT IN ('done', 'cancelled'))::int AS open_tasks,
            COUNT(t.id) FILTER (
              WHERE t.status NOT IN ('done', 'cancelled')
                AND t.due_date IS NOT NULL
                AND t.due_date < now()
            )::int AS overdue_tasks,
            COUNT(t.id) FILTER (WHERE t.status = 'in_progress')::int AS in_progress,
            COALESCE(
              array_agg(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL),
              ARRAY[]::text[]
            ) AS companies
          FROM profiles p
          JOIN tasks t ON t.assignee_id = p.id
          JOIN companies c ON c.id = t.company_id AND c.is_active = true
          GROUP BY p.id, p.full_name, p.email
          ORDER BY open_tasks DESC, overdue_tasks DESC, p.full_name
        `
      : accessibleIds.length === 0
        ? []
        : await sql`
            SELECT
              p.id AS user_id,
              p.full_name,
              p.email,
              COUNT(t.id) FILTER (WHERE t.status NOT IN ('done', 'cancelled'))::int AS open_tasks,
              COUNT(t.id) FILTER (
                WHERE t.status NOT IN ('done', 'cancelled')
                  AND t.due_date IS NOT NULL
                  AND t.due_date < now()
              )::int AS overdue_tasks,
              COUNT(t.id) FILTER (WHERE t.status = 'in_progress')::int AS in_progress,
              COALESCE(
                array_agg(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL),
                ARRAY[]::text[]
              ) AS companies
            FROM profiles p
            JOIN tasks t ON t.assignee_id = p.id
            JOIN companies c ON c.id = t.company_id AND c.is_active = true
            WHERE t.company_id = ANY(${accessibleIds}::uuid[])
            GROUP BY p.id, p.full_name, p.email
            ORDER BY open_tasks DESC, overdue_tasks DESC, p.full_name
          `;

  return rows.map((r) => ({
    user_id: r.user_id as string,
    full_name: r.full_name as string,
    email: r.email as string,
    open_tasks: Number(r.open_tasks ?? 0),
    overdue_tasks: Number(r.overdue_tasks ?? 0),
    in_progress: Number(r.in_progress ?? 0),
    companies: (r.companies as string[]) ?? [],
  }));
}

function mapTaskRow(row: Record<string, unknown>): TaskWithAssignee {
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
    assignee_name: (row.assignee_name as string) ?? null,
    created_by_name: (row.created_by_name as string) ?? null,
    company_name: row.company_name as string,
    company_slug: row.company_slug as string,
    time_logged_minutes: Number(row.time_logged_minutes ?? 0),
  };
}

export async function logTaskTime(input: {
  taskId: string;
  companyId: string;
  userId: string;
  minutes: number;
  note?: string;
}): Promise<boolean> {
  const sql = getSql();
  const owned = await sql`
    SELECT 1 FROM tasks
    WHERE id = ${input.taskId} AND company_id = ${input.companyId}
    LIMIT 1
  `;
  if (!owned[0]) {
    const card = await sql`
      SELECT 1 FROM deck_cards c
      JOIN deck_boards b ON b.id = c.board_id
      WHERE c.id = ${input.taskId} AND b.company_id = ${input.companyId}
      LIMIT 1
    `;
    if (!card[0]) return false;
  }
  await sql`
    INSERT INTO task_time_logs (task_id, user_id, minutes, note)
    VALUES (${input.taskId}, ${input.userId}, ${input.minutes}, ${input.note ?? null})
  `;
  return true;
}

export async function fetchCompletedTaskCount(
  accessibleIds: string[] | "all"
): Promise<number> {
  const sql = getSql();
  const rows =
    accessibleIds === "all"
      ? await sql`
          SELECT COUNT(*)::int AS n
          FROM tasks t
          JOIN companies c ON c.id = t.company_id AND c.is_active = true
          WHERE t.status = 'done'
        `
      : accessibleIds.length === 0
        ? [{ n: 0 }]
        : await sql`
            SELECT COUNT(*)::int AS n
            FROM tasks t
            JOIN companies c ON c.id = t.company_id AND c.is_active = true
            WHERE t.company_id = ANY(${accessibleIds}::uuid[])
              AND t.status = 'done'
          `;
  return Number(rows[0]?.n ?? 0);
}
