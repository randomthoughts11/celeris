-- Row Level Security Policies

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_ads_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ringcentral_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_snapshots ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION get_user_roles(uid UUID)
RETURNS SETOF user_role AS $$
  SELECT role FROM user_roles WHERE user_id = uid;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION has_role(uid UUID, required user_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = uid AND role = required
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_god_mode(uid UUID)
RETURNS BOOLEAN AS $$
  SELECT has_role(uid, 'god_mode');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION can_access_company(uid UUID, cid UUID)
RETURNS BOOLEAN AS $$
  SELECT
    is_god_mode(uid)
    OR EXISTS (SELECT 1 FROM company_members WHERE user_id = uid AND company_id = cid)
    OR has_role(uid, 'admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION can_view_financials(uid UUID)
RETURNS BOOLEAN AS $$
  SELECT NOT has_role(uid, 'designer') AND NOT has_role(uid, 'telecaller');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles
CREATE POLICY profiles_select ON profiles FOR SELECT USING (
  auth.uid() = id OR is_god_mode(auth.uid()) OR has_role(auth.uid(), 'admin')
);
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (auth.uid() = id OR is_god_mode(auth.uid()));

-- User roles
CREATE POLICY user_roles_select ON user_roles FOR SELECT USING (
  user_id = auth.uid() OR is_god_mode(auth.uid()) OR has_role(auth.uid(), 'admin')
);
CREATE POLICY user_roles_manage ON user_roles FOR ALL USING (is_god_mode(auth.uid()) OR has_role(auth.uid(), 'admin'));

-- Companies
CREATE POLICY companies_select ON companies FOR SELECT USING (
  is_god_mode(auth.uid()) OR can_access_company(auth.uid(), id)
);
CREATE POLICY companies_manage ON companies FOR ALL USING (
  is_god_mode(auth.uid()) OR has_role(auth.uid(), 'admin')
);

-- Company members
CREATE POLICY company_members_select ON company_members FOR SELECT USING (
  is_god_mode(auth.uid()) OR user_id = auth.uid() OR can_access_company(auth.uid(), company_id)
);
CREATE POLICY company_members_manage ON company_members FOR ALL USING (
  is_god_mode(auth.uid()) OR has_role(auth.uid(), 'admin')
);

-- Company metrics
CREATE POLICY company_metrics_select ON company_metrics FOR SELECT USING (
  can_access_company(auth.uid(), company_id) AND can_view_financials(auth.uid())
);
CREATE POLICY company_metrics_god ON company_metrics FOR SELECT USING (is_god_mode(auth.uid()));

-- Leads
CREATE POLICY leads_select ON leads FOR SELECT USING (
  is_god_mode(auth.uid())
  OR (can_access_company(auth.uid(), company_id) AND (
    NOT has_role(auth.uid(), 'telecaller') OR owner_id = auth.uid()
  ))
);
CREATE POLICY leads_insert ON leads FOR INSERT WITH CHECK (can_access_company(auth.uid(), company_id));
CREATE POLICY leads_update ON leads FOR UPDATE USING (
  is_god_mode(auth.uid())
  OR (can_access_company(auth.uid(), company_id) AND (
    NOT has_role(auth.uid(), 'telecaller') OR owner_id = auth.uid()
  ))
);
CREATE POLICY leads_delete ON leads FOR DELETE USING (
  is_god_mode(auth.uid()) OR (can_access_company(auth.uid(), company_id) AND NOT has_role(auth.uid(), 'telecaller'))
);

-- Lead activities
CREATE POLICY lead_activities_all ON lead_activities FOR ALL USING (
  EXISTS (
    SELECT 1 FROM leads l WHERE l.id = lead_id AND (
      is_god_mode(auth.uid()) OR can_access_company(auth.uid(), l.company_id)
    )
  )
);

-- Tasks
CREATE POLICY tasks_select ON tasks FOR SELECT USING (can_access_company(auth.uid(), company_id));
CREATE POLICY tasks_manage ON tasks FOR ALL USING (
  is_god_mode(auth.uid()) OR can_access_company(auth.uid(), company_id)
);

-- Task comments
CREATE POLICY task_comments_all ON task_comments FOR ALL USING (
  EXISTS (
    SELECT 1 FROM tasks t WHERE t.id = task_id AND can_access_company(auth.uid(), t.company_id)
  )
);

-- Notifications
CREATE POLICY notifications_own ON notifications FOR ALL USING (user_id = auth.uid());

-- Integrations
CREATE POLICY integrations_select ON integrations FOR SELECT USING (
  can_access_company(auth.uid(), company_id) AND can_view_financials(auth.uid())
);
CREATE POLICY integrations_god ON integrations FOR SELECT USING (is_god_mode(auth.uid()));

-- Google Ads
CREATE POLICY google_ads_select ON google_ads_campaigns FOR SELECT USING (
  can_access_company(auth.uid(), company_id) AND can_view_financials(auth.uid())
);
CREATE POLICY google_ads_god ON google_ads_campaigns FOR SELECT USING (is_god_mode(auth.uid()));

-- Meta Ads
CREATE POLICY meta_ads_select ON meta_ads_campaigns FOR SELECT USING (
  can_access_company(auth.uid(), company_id) AND can_view_financials(auth.uid())
);
CREATE POLICY meta_ads_god ON meta_ads_campaigns FOR SELECT USING (is_god_mode(auth.uid()));

-- Social
CREATE POLICY social_accounts_select ON social_accounts FOR SELECT USING (can_access_company(auth.uid(), company_id));
CREATE POLICY social_metrics_select ON social_metrics FOR SELECT USING (can_access_company(auth.uid(), company_id));
CREATE POLICY social_posts_all ON social_posts FOR ALL USING (can_access_company(auth.uid(), company_id));

-- RingCentral
CREATE POLICY ringcentral_select ON ringcentral_calls FOR SELECT USING (can_access_company(auth.uid(), company_id));

-- AI Insights
CREATE POLICY ai_insights_select ON ai_insights FOR SELECT USING (can_access_company(auth.uid(), company_id));
CREATE POLICY ai_insights_update ON ai_insights FOR UPDATE USING (can_access_company(auth.uid(), company_id));

-- Audit logs
CREATE POLICY audit_logs_select ON audit_logs FOR SELECT USING (
  is_god_mode(auth.uid()) OR has_role(auth.uid(), 'admin')
);

-- Performance snapshots
CREATE POLICY performance_snapshots_select ON performance_snapshots FOR SELECT USING (
  can_access_company(auth.uid(), company_id) AND can_view_financials(auth.uid())
);
CREATE POLICY performance_snapshots_god ON performance_snapshots FOR SELECT USING (is_god_mode(auth.uid()));
