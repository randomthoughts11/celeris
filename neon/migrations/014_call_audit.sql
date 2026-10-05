-- Telecaller call audit: Meta lead-form leads, Privyr activities, and 12-hour audit runs.
-- RingCentral calls and voicemails reuse ringcentral_calls (voicemails use outcome 'voicemail').

CREATE TABLE IF NOT EXISTS meta_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  ad_external_id TEXT,
  ad_name TEXT,
  campaign_external_id TEXT,
  campaign_name TEXT,
  form_id TEXT,
  full_name TEXT,
  phone TEXT,
  phone_key TEXT,
  email TEXT,
  lead_created_at TIMESTAMPTZ NOT NULL,
  raw JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, external_id)
);
CREATE INDEX IF NOT EXISTS meta_leads_company_created ON meta_leads (company_id, lead_created_at DESC);

CREATE TABLE IF NOT EXISTS privyr_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  client_name TEXT,
  phone_key TEXT,
  activity_type TEXT NOT NULL,
  title TEXT,
  notes TEXT,
  activity_at TIMESTAMPTZ NOT NULL,
  raw JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, external_id)
);
CREATE INDEX IF NOT EXISTS privyr_activities_company_at ON privyr_activities (company_id, activity_at DESC);

CREATE TABLE IF NOT EXISTS call_audit_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  report JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, window_end)
);
