export type UserRole = "god_mode" | "manager" | "designer" | "telecaller" | "admin";

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost"
  | "nurture";

export type LeadPriority = "low" | "medium" | "high" | "urgent";

export type TaskStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "review"
  | "blocked"
  | "done"
  | "cancelled";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type TaskType =
  | "design"
  | "copywriting"
  | "approval"
  | "publishing"
  | "meeting"
  | "campaign_launch"
  | "seo"
  | "development"
  | "support"
  | "other";

export type SocialPlatform = "facebook" | "instagram" | "linkedin" | "x" | "youtube";

export type PostStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "scheduled"
  | "published"
  | "failed"
  | "archived";

export type CampaignStatus = "active" | "paused" | "ended" | "draft" | "learning";

export type NotificationType =
  | "budget_limit"
  | "missed_call"
  | "new_lead"
  | "overdue_task"
  | "campaign_issue"
  | "publishing_reminder"
  | "team_mention"
  | "approval"
  | "ai_insight"
  | "system";

export type InsightSeverity = "info" | "warning" | "critical" | "success";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  website: string | null;
  industry: string | null;
  monthly_budget: number;
  monthly_revenue_goal: number;
  monthly_lead_goal: number;
  health_score: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyMetrics {
  id: string;
  company_id: string;
  revenue: number;
  leads_count: number;
  conversions: number;
  ad_spend: number;
  roas: number;
  cost_per_lead: number;
  cost_per_acquisition: number;
  conversion_rate: number;
  budget_used_percent: number;
  monthly_ad_spend: number;
  active_campaigns: number;
  social_posting_status: string;
  updated_at: string;
}

export interface CompanyWithMetrics extends Company {
  metrics: CompanyMetrics | null;
}

export interface Lead {
  id: string;
  company_id: string;
  owner_id: string | null;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  source: string | null;
  status: LeadStatus;
  priority: LeadPriority;
  score: number;
  tags: string[];
  last_contact_at: string | null;
  first_response_at: string | null;
  response_time_seconds: number | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  user_id: string | null;
  activity_type: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Task {
  id: string;
  company_id: string;
  assignee_id: string | null;
  created_by: string | null;
  title: string;
  description: string | null;
  task_type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  company_id: string | null;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AiInsight {
  id: string;
  company_id: string;
  module: string;
  severity: InsightSeverity;
  title: string;
  recommendation: string;
  explanation: string;
  action_label: string | null;
  action_link: string | null;
  is_dismissed: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  expires_at: string | null;
}

export interface GoogleAdsCampaign {
  id: string;
  company_id: string;
  external_id: string;
  name: string;
  status: CampaignStatus;
  budget: number;
  daily_spend: number;
  remaining_budget: number;
  clicks: number;
  impressions: number;
  ctr: number;
  cpc: number;
  conversions: number;
  cost_per_conversion: number;
  roas: number;
  metadata: Record<string, unknown>;
  synced_at: string;
}

export interface MetaAdsCampaign {
  id: string;
  company_id: string;
  external_id: string;
  name: string;
  status: CampaignStatus;
  reach: number;
  impressions: number;
  frequency: number;
  spend: number;
  conversions: number;
  roas: number;
  budget_remaining: number;
  ctr: number;
  health_score: number;
  metadata: Record<string, unknown>;
  synced_at: string;
}

export interface SocialPost {
  id: string;
  company_id: string;
  created_by: string | null;
  approved_by: string | null;
  caption: string | null;
  media_urls: string[];
  platforms: SocialPlatform[];
  status: PostStatus;
  scheduled_at: string | null;
  published_at: string | null;
  ai_generated: boolean;
  performance: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RingCentralCall {
  id: string;
  company_id: string;
  lead_id: string | null;
  external_id: string;
  direction: "inbound" | "outbound";
  outcome: string;
  caller: string | null;
  receiver: string | null;
  duration_seconds: number;
  recording_url: string | null;
  notes: string | null;
  agent_id: string | null;
  started_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PerformanceSnapshot {
  id: string;
  company_id: string;
  snapshot_date: string;
  revenue: number;
  leads: number;
  conversions: number;
  ad_spend: number;
  roas: number;
}

export interface SocialMetrics {
  id: string;
  company_id: string;
  platform: SocialPlatform;
  followers: number;
  reach: number;
  engagement: number;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  saves: number;
  growth_percent: number;
  posting_frequency: string | null;
  recorded_at: string;
}

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  roles: UserRole[];
  avatarUrl: string | null;
}

export interface DriveFile {
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
