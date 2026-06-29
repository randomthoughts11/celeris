-- Google Drive storage integration
-- Run AFTER 001_initial_schema.sql (companies, profiles, integrations tables required)

-- Create enum if 001 was never run; otherwise add google_drive to existing enum
DO $$
BEGIN
  CREATE TYPE integration_provider AS ENUM (
    'google_ads', 'meta_ads', 'ringcentral', 'facebook',
    'instagram', 'linkedin', 'x', 'youtube', 'google_drive'
  );
EXCEPTION
  WHEN duplicate_object THEN
    ALTER TYPE integration_provider ADD VALUE IF NOT EXISTS 'google_drive';
END $$;

CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider integration_provider NOT NULL,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  credentials_encrypted TEXT,
  config JSONB DEFAULT '{}',
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, provider)
);

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
