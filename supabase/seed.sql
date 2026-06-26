-- Seed data for development and demo
-- Run after migrations in a fresh Supabase project

INSERT INTO companies (id, name, slug, logo_url, industry, monthly_budget, monthly_revenue_goal, monthly_lead_goal, health_score) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Apex Digital Solutions', 'apex-digital', NULL, 'Technology', 45000, 120000, 200, 92),
  ('a0000000-0000-4000-8000-000000000002', 'Bloom Wellness Co', 'bloom-wellness', NULL, 'Health & Wellness', 28000, 85000, 150, 78),
  ('a0000000-0000-4000-8000-000000000003', 'Urban Realty Group', 'urban-realty', NULL, 'Real Estate', 62000, 200000, 80, 85),
  ('a0000000-0000-4000-8000-000000000004', 'Craft Kitchen', 'craft-kitchen', NULL, 'Food & Beverage', 15000, 45000, 300, 67),
  ('a0000000-0000-4000-8000-000000000005', 'Nova Finance', 'nova-finance', NULL, 'Financial Services', 55000, 175000, 120, 88);

INSERT INTO company_metrics (company_id, revenue, leads_count, conversions, ad_spend, roas, cost_per_lead, cost_per_acquisition, conversion_rate, budget_used_percent, monthly_ad_spend, active_campaigns, social_posting_status) VALUES
  ('a0000000-0000-4000-8000-000000000001', 98400, 187, 42, 38200, 4.2, 204.28, 909.52, 0.2246, 84.9, 38200, 8, 'on_track'),
  ('a0000000-0000-4000-8000-000000000002', 52100, 134, 28, 21400, 3.1, 159.70, 764.29, 0.2090, 76.4, 21400, 5, 'behind'),
  ('a0000000-0000-4000-8000-000000000003', 156000, 72, 19, 48900, 5.8, 679.17, 2576.32, 0.2639, 78.9, 48900, 12, 'on_track'),
  ('a0000000-0000-4000-8000-000000000004', 28900, 312, 89, 11200, 2.4, 35.90, 125.84, 0.2853, 74.7, 11200, 3, 'ahead'),
  ('a0000000-0000-4000-8000-000000000005', 142500, 98, 31, 44100, 4.9, 450.00, 1422.58, 0.3163, 80.2, 44100, 7, 'on_track');

INSERT INTO performance_snapshots (company_id, snapshot_date, revenue, leads, conversions, ad_spend, roas)
SELECT c.id, d::date, 
  cm.revenue * (0.7 + random() * 0.3),
  (cm.leads_count * (0.7 + random() * 0.3))::int,
  (cm.conversions * (0.7 + random() * 0.3))::int,
  cm.ad_spend * (0.7 + random() * 0.3),
  cm.roas * (0.85 + random() * 0.3)
FROM companies c
JOIN company_metrics cm ON cm.company_id = c.id
CROSS JOIN generate_series(CURRENT_DATE - 29, CURRENT_DATE, '1 day'::interval) d;

INSERT INTO ai_insights (company_id, module, severity, title, recommendation, explanation, action_label, action_link) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'google_ads', 'warning', 'CTR dropped 18% on Brand Search', 'Review ad copy and sitelink extensions', 'Brand Search CTR fell from 8.2% to 6.7% over 7 days. Competitor ads may be capturing more impression share. Refreshing headlines typically recovers 10-15% CTR within 2 weeks.', 'View Campaign', '/companies/apex-digital/google-ads'),
  ('a0000000-0000-4000-8000-000000000002', 'social', 'critical', 'Instagram posting 3 days behind schedule', 'Schedule 4 posts this week', 'Posting frequency dropped to 2x/week vs target of 5x/week. Accounts with consistent posting see 23% higher engagement. Queue content from approved drafts.', 'Open Scheduler', '/companies/bloom-wellness/scheduler'),
  ('a0000000-0000-4000-8000-000000000003', 'meta_ads', 'success', 'Lookalike audience outperforming by 2.4x', 'Shift 20% budget to top ad set', 'Lookalike 1% purchasers ad set has CPA of $42 vs account average of $98. Increasing budget while CPA remains stable could add 12-15 conversions/month.', 'View Ad Sets', '/companies/urban-realty/meta-ads'),
  ('a0000000-0000-4000-8000-000000000004', 'leads', 'warning', '14 leads not contacted within SLA', 'Prioritize new leads from Google Ads', 'Average first response time is 4.2 hours vs 1-hour SLA. 14 leads from the last 48 hours have no contact activity. Fast response increases conversion by up to 35%.', 'View Leads', '/companies/craft-kitchen/leads'),
  ('a0000000-0000-4000-8000-000000000005', 'budget', 'critical', 'Budget 92% exhausted with 8 days remaining', 'Pause underperforming campaigns', 'Monthly budget is nearly depleted. Two campaigns have ROAS below 1.5x. Pausing them would extend runway by ~5 days while protecting profitable campaigns.', 'View Analytics', '/companies/nova-finance/analytics');

INSERT INTO google_ads_campaigns (company_id, external_id, name, status, budget, daily_spend, remaining_budget, clicks, impressions, ctr, cpc, conversions, cost_per_conversion, roas) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'g-1001', 'Brand Search', 'active', 8000, 245, 1200, 4520, 68400, 0.0661, 1.82, 89, 12.45, 5.2),
  ('a0000000-0000-4000-8000-000000000001', 'g-1002', 'Performance Max', 'active', 15000, 512, 2800, 8920, 245000, 0.0364, 2.14, 156, 12.82, 4.8),
  ('a0000000-0000-4000-8000-000000000002', 'g-2001', 'Wellness Leads', 'active', 12000, 398, 1900, 3240, 98000, 0.0331, 2.89, 67, 18.92, 3.1);

INSERT INTO meta_ads_campaigns (company_id, external_id, name, status, reach, impressions, frequency, spend, conversions, roas, budget_remaining, ctr, health_score) VALUES
  ('a0000000-0000-4000-8000-000000000003', 'm-3001', 'Buyer Retargeting', 'active', 45000, 128000, 2.84, 8900, 24, 6.2, 2100, 0.0245, 94),
  ('a0000000-0000-4000-8000-000000000003', 'm-3002', 'Lookalike Purchasers', 'active', 82000, 210000, 2.56, 12400, 31, 5.8, 3400, 0.0198, 91),
  ('a0000000-0000-4000-8000-000000000005', 'm-5001', 'Lead Gen Forms', 'paused', 12000, 34000, 2.83, 4200, 8, 2.1, 0, 0.0156, 45);

INSERT INTO social_accounts (company_id, platform, account_name, followers, is_connected) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'instagram', '@apexdigital', 24500, true),
  ('a0000000-0000-4000-8000-000000000001', 'linkedin', 'Apex Digital Solutions', 8900, true),
  ('a0000000-0000-4000-8000-000000000002', 'instagram', '@bloomwellness', 45200, true),
  ('a0000000-0000-4000-8000-000000000002', 'facebook', 'Bloom Wellness Co', 12800, true);

INSERT INTO social_metrics (company_id, platform, followers, reach, engagement, likes, comments, shares, views, saves, growth_percent, posting_frequency) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'instagram', 24500, 89000, 4200, 3800, 245, 89, 125000, 520, 3.2, '5x/week'),
  ('a0000000-0000-4000-8000-000000000001', 'linkedin', 8900, 34000, 1800, 1200, 420, 180, 0, 0, 1.8, '3x/week'),
  ('a0000000-0000-4000-8000-000000000002', 'instagram', 45200, 156000, 8900, 7200, 890, 420, 280000, 1200, 4.1, '2x/week');
