-- 009: Password vault — encrypted credentials with per-user sharing.

CREATE TABLE IF NOT EXISTS vault_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  username TEXT,
  password_encrypted TEXT NOT NULL,
  url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vault_credential_access (
  credential_id UUID NOT NULL REFERENCES vault_credentials(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (credential_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_vault_credentials_company ON vault_credentials(company_id);
CREATE INDEX IF NOT EXISTS idx_vault_credentials_creator ON vault_credentials(created_by);
CREATE INDEX IF NOT EXISTS idx_vault_access_user ON vault_credential_access(user_id);
