import { getSql } from "./client";

export interface TaskAttachment {
  id: string;
  task_id: string;
  company_id: string;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  /** data: URL for display — only populated when fetching for detail view */
  data_url?: string;
  created_at: string;
}

export async function fetchTaskAttachments(
  taskId: string
): Promise<TaskAttachment[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT a.id, a.task_id, a.company_id, a.uploaded_by, a.file_name,
      a.mime_type, a.size_bytes, a.data_base64, a.created_at,
      p.full_name AS uploaded_by_name
    FROM task_attachments a
    LEFT JOIN profiles p ON p.id = a.uploaded_by
    WHERE a.task_id = ${taskId}
    ORDER BY a.created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id as string,
    task_id: r.task_id as string,
    company_id: r.company_id as string,
    uploaded_by: (r.uploaded_by as string) ?? null,
    uploaded_by_name: (r.uploaded_by_name as string) ?? null,
    file_name: r.file_name as string,
    mime_type: r.mime_type as string,
    size_bytes: Number(r.size_bytes ?? 0),
    data_url: `data:${r.mime_type};base64,${r.data_base64 as string}`,
    created_at: String(r.created_at),
  }));
}

export async function insertTaskAttachment(input: {
  taskId: string;
  companyId: string;
  uploadedBy: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataBase64: string;
}): Promise<string> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO task_attachments (
      task_id, company_id, uploaded_by, file_name, mime_type, size_bytes, data_base64
    ) VALUES (
      ${input.taskId}, ${input.companyId}, ${input.uploadedBy},
      ${input.fileName}, ${input.mimeType}, ${input.sizeBytes}, ${input.dataBase64}
    )
    RETURNING id
  `;
  return rows[0].id as string;
}

export async function deleteTaskAttachment(
  attachmentId: string,
  companyId: string
): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    DELETE FROM task_attachments
    WHERE id = ${attachmentId} AND company_id = ${companyId}
    RETURNING id
  `;
  return Boolean(rows[0]);
}

export async function countTaskAttachments(taskId: string): Promise<number> {
  const sql = getSql();
  const rows = await sql`
    SELECT COUNT(*)::int AS n FROM task_attachments WHERE task_id = ${taskId}
  `;
  return Number(rows[0]?.n ?? 0);
}
