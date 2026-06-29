-- Google Drive storage integration

ALTER TYPE integration_provider ADD VALUE IF NOT EXISTS 'google_drive';

CREATE TABLE IF NOT EXISTS drive_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  drive_file_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mime_type TEXT,
  folder_type TEXT NOT NULL DEFAULT 'assets',
  web_view_link TEXT,
  thumbnail_link TEXT,
  size_bytes BIGINT DEFAULT 0,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, drive_file_id)
);

CREATE INDEX IF NOT EXISTS idx_drive_files_company ON drive_files(company_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_entity ON drive_files(entity_type, entity_id);
