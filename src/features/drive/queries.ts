import { getIntegration } from "@/lib/db/integrations";
import { fetchDriveFiles } from "@/lib/db/drive-files";
import { isDatabaseConfigured } from "@/lib/config";
import type { DriveFile } from "@/types";

export interface DriveStatus {
  connected: boolean;
  connectedEmail?: string;
  lastSyncedAt?: string | null;
}

export async function getDriveStatus(companyId: string): Promise<DriveStatus> {
  if (!isDatabaseConfigured()) {
    return { connected: false };
  }

  try {
    const integration = await getIntegration(companyId, "google_drive");
    if (!integration?.is_connected) {
      return { connected: false };
    }
    const config = integration.config as { connectedEmail?: string };
    return {
      connected: true,
      connectedEmail: config.connectedEmail,
      lastSyncedAt: integration.last_synced_at,
    };
  } catch {
    return { connected: false };
  }
}

export async function getDriveFiles(
  companyId: string,
  folderType?: string
): Promise<DriveFile[]> {
  if (!isDatabaseConfigured()) return [];

  try {
    const rows = await fetchDriveFiles(companyId, folderType);
    return rows.map((r) => ({
      id: r.id,
      company_id: r.company_id,
      drive_file_id: r.drive_file_id,
      name: r.name,
      mime_type: r.mime_type,
      folder_type: r.folder_type,
      web_view_link: r.web_view_link,
      thumbnail_link: r.thumbnail_link,
      size_bytes: Number(r.size_bytes),
      uploaded_by: r.uploaded_by,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      created_at: String(r.created_at),
    }));
  } catch {
    return [];
  }
}
