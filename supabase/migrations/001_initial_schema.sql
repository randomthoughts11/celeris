-- Agency CRM — Enterprise PostgreSQL Schema
-- Version: 1.0.0

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE user_role AS ENUM ('god_mode', 'manager', 'designer', 'telecaller', 'admin');
CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost', 'nurture');
CREATE TYPE lead_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE task_status AS ENUM ('backlog', 'todo', 'in_progress', 'review', 'blocked', 'done', 'cancelled');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE task_type AS ENUM ('design', 'copywriting', 'approval', 'publishing', 'meeting', 'campaign_launch', 'seo', 'development', 'support', 'other');
CREATE TYPE activity_type AS ENUM ('call', 'message', 'whatsapp', 'email', 'note', 'task', 'meeting', 'follow_up', 'status_change', 'assignment');
CREATE TYPE campaign_status AS ENUM ('active', 'paused', 'ended', 'draft', 'learning');
CREATE TYPE social_platform AS ENUM ('facebook', 'instagram', 'linkedin', 'x', 'youtube');
CREATE TYPE post_status AS ENUM ('draft', 'pending_approval', 'approved', 'scheduled', 'published', 'failed', 'archived');
CREATE TYPE notification_type AS ENUM ('budget_limit', 'missed_call', 'new_lead', 'overdue_task', 'campaign_issue', 'publishing_reminder', 'team_mention', 'approval', 'ai_insight', 'system');
CREATE TYPE integration_provider AS ENUM ('google_ads', 'meta_ads', 'ringcentral', 'facebook', 'instagram', 'linkedin', 'x', 'youtube');
CREATE TYPE call_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE call_outcome AS ENUM ('answered', 'missed', 'voicemail', 'busy', 'failed', 'unknown');
CREATE TYPE insight_severity AS ENUM ('info', 'warning', 'critical', 'success');

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Companies / Brands
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  website TEXT,
  industry TEXT,
  monthly_budget DECIMAL(12, 2) DEFAULT 0,
  monthly_revenue_goal DECIMAL(12, 2) DEFAULT 0,
  monthly_lead_goal INTEGER DEFAULT 0,
  health_score INTEGER DEFAULT 100 CHECK (health_score >= 0 AND health_score <= 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE company_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'manager',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);

-- Cached company metrics (updated by background jobs)
CREATE TABLE company_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  revenue DECIMAL(12, 2) DEFAULT 0,
  leads_count INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  ad_spend DECIMAL(12, 2) DEFAULT 0,
  roas DECIMAL(8, 4) DEFAULT 0,
  cost_per_lead DECIMAL(10, 2) DEFAULT 0,
  cost_per_acquisition DECIMAL(10, 2) DEFAULT 0,
  conversion_rate DECIMAL(5, 4) DEFAULT 0,
  budget_used_percent DECIMAL(5, 2) DEFAULT 0,
  monthly_ad_spend DECIMAL(12, 2) DEFAULT 0,
  active_campaigns INTEGER DEFAULT 0,
  social_posting_status TEXT DEFAULT 'on_track',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leads
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  company_name TEXT,
  source TEXT,
  status lead_status NOT NULL DEFAULT 'new',
  priority lead_priority NOT NULL DEFAULT 'medium',
  score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  tags TEXT[] DEFAULT '{}',
  last_contact_at TIMESTAMPTZ,
  first_response_at TIMESTAMPTZ,
  response_time_seconds INTEGER,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE lead_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  activity_type activity_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  task_type task_type NOT NULL DEFAULT 'other',
  status task_status NOT NULL DEFAULT 'todo',
  priority task_priority NOT NULL DEFAULT 'medium',
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE task_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Integrations
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Google Ads
CREATE TABLE google_ads_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status campaign_status NOT NULL DEFAULT 'active',
  budget DECIMAL(12, 2) DEFAULT 0,
  daily_spend DECIMAL(12, 2) DEFAULT 0,
  remaining_budget DECIMAL(12, 2) DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  ctr DECIMAL(8, 4) DEFAULT 0,
  cpc DECIMAL(10, 2) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  cost_per_conversion DECIMAL(10, 2) DEFAULT 0,
  roas DECIMAL(8, 4) DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, external_id)
);

-- Meta Ads
CREATE TABLE meta_ads_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status campaign_status NOT NULL DEFAULT 'active',
  reach INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  frequency DECIMAL(6, 2) DEFAULT 0,
  spend DECIMAL(12, 2) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  roas DECIMAL(8, 4) DEFAULT 0,
  budget_remaining DECIMAL(12, 2) DEFAULT 0,
  ctr DECIMAL(8, 4) DEFAULT 0,
  health_score INTEGER DEFAULT 100,
  metadata JSONB DEFAULT '{}',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, external_id)
);

-- Social accounts
CREATE TABLE social_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  platform social_platform NOT NULL,
  account_name TEXT NOT NULL,
  followers INTEGER DEFAULT 0,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  synced_at TIMESTAMPTZ,
  UNIQUE(company_id, platform)
);

CREATE TABLE social_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  platform social_platform NOT NULL,
  followers INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  engagement INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  growth_percent DECIMAL(6, 2) DEFAULT 0,
  posting_frequency TEXT,
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(company_id, platform, recorded_at)
);

-- Social posts / Scheduler
CREATE TABLE social_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  caption TEXT,
  media_urls TEXT[] DEFAULT '{}',
  platforms social_platform[] NOT NULL DEFAULT '{}',
  status post_status NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  ai_generated BOOLEAN DEFAULT false,
  performance JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RingCentral calls
CREATE TABLE ringcentral_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  external_id TEXT NOT NULL,
  direction call_direction NOT NULL,
  outcome call_outcome NOT NULL DEFAULT 'unknown',
  caller TEXT,
  receiver TEXT,
  duration_seconds INTEGER DEFAULT 0,
  recording_url TEXT,
  notes TEXT,
  agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, external_id)
);

-- AI Insights
CREATE TABLE ai_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  severity insight_severity NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  explanation TEXT NOT NULL,
  action_label TEXT,
  action_link TEXT,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- Audit logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance snapshots for trends
CREATE TABLE performance_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  revenue DECIMAL(12, 2) DEFAULT 0,
  leads INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  ad_spend DECIMAL(12, 2) DEFAULT 0,
  roas DECIMAL(8, 4) DEFAULT 0,
  UNIQUE(company_id, snapshot_date)
);

-- Indexes
CREATE INDEX idx_leads_company ON leads(company_id);
CREATE INDEX idx_leads_owner ON leads(owner_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_created ON leads(created_at DESC);
CREATE INDEX idx_tasks_company ON tasks(company_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due ON tasks(due_date);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_lead_activities_lead ON lead_activities(lead_id);
CREATE INDEX idx_social_posts_company ON social_posts(company_id, status);
CREATE INDEX idx_social_posts_scheduled ON social_posts(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_ai_insights_company ON ai_insights(company_id, is_dismissed);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_company ON audit_logs(company_id);
CREATE INDEX idx_ringcentral_calls_company ON ringcentral_calls(company_id);
CREATE INDEX idx_google_ads_company ON google_ads_campaigns(company_id);
CREATE INDEX idx_meta_ads_company ON meta_ads_campaigns(company_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER integrations_updated_at BEFORE UPDATE ON integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER social_posts_updated_at BEFORE UPDATE ON social_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  INSERT INTO user_roles (user_id, role) VALUES (NEW.id, 'manager');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
