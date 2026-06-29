import { getSql } from "./client";

export interface DriveFileRow {
  id: string;
  company_id: string;
  drive_file_id: string;
  name: string;
  mime_type: string | null;
  folder_type: string;
  web_view_link: string | null;
  thumbnail_link: string | null;
  size_bytes: number;
  uploaded_by: string | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
}

export async function insertDriveFile(input: {
  companyId: string;
  driveFileId: string;
  name: string;
  mimeType: string;
  folderType: string;
  webViewLink: string;
  thumbnailLink?: string;
  sizeBytes: number;
  uploadedBy?: string;
  entityType?: string;
  entityId?: string;
}): Promise<DriveFileRow> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO drive_files (
      company_id, drive_file_id, name, mime_type, folder_type,
      web_view_link, thumbnail_link, size_bytes, uploaded_by, entity_type, entity_id
    ) VALUES (
      ${input.companyId},
      ${input.driveFileId},
      ${input.name},
      ${input.mimeType},
      ${input.folderType},
      ${input.webViewLink},
      ${input.thumbnailLink ?? null},
      ${input.sizeBytes},
      ${input.uploadedBy ?? null},
      ${input.entityType ?? null},
      ${input.entityId ?? null}
    )
    ON CONFLICT (company_id, drive_file_id) DO UPDATE SET
      name = EXCLUDED.name,
      web_view_link = EXCLUDED.web_view_link
    RETURNING *
  `;
  return rows[0] as DriveFileRow;
}

export async function fetchDriveFiles(
  companyId: string,
  folderType?: string
): Promise<DriveFileRow[]> {
  const sql = getSql();
  if (folderType) {
    const rows = await sql`
      SELECT * FROM drive_files
      WHERE company_id = ${companyId} AND folder_type = ${folderType}
      ORDER BY created_at DESC
      LIMIT 50
    `;
    return rows as DriveFileRow[];
  }
  const rows = await sql`
    SELECT * FROM drive_files
    WHERE company_id = ${companyId}
    ORDER BY created_at DESC
    LIMIT 50
  `;
  return rows as DriveFileRow[];
}
