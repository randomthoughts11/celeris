-- Privyr + external sync tracking

CREATE TABLE IF NOT EXISTS sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'success',
  records_processed INTEGER NOT NULL DEFAULT 0,
  records_created INTEGER NOT NULL DEFAULT 0,
  records_updated INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
  
);

CREATE TABLE IF NOT EXISTS privyr_client_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  privyr_client_key TEXT NOT NULL,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, privyr_client_key)
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_provider ON sync_runs(provider, started_at DESC);
