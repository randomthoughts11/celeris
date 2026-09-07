export type ApprovalStatus = "pending" | "approved" | "rejected";

export type UserRole =
  | "god_mode"
  | "manager"
  | "designer"
  | "telecaller"
  | "salesperson"
  | "admin";

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
  approval_status: ApprovalStatus;
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
  /** Live overlay — open tasks for this brand */
  open_tasks?: number;
}

export interface CompanyWithMetrics extends Company {
  metrics: CompanyMetrics | null;
}

export interface Lead {
  id: string;
  company_id: string;
  branch_id?: string | null;
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
  lead_id?: string | null;
  follow_up_at?: string | null;
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
  board_id?: string | null;
  stack_id?: string | null;
  position?: number;
}

export interface DeckBoard {
  id: string;
  company_id: string;
  title: string;
  color: string;
  archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeckStack {
  id: string;
  board_id: string;
  title: string;
  position: number;
  status_map: TaskStatus;
  created_at: string;
  updated_at: string;
}

export interface DeckLabel {
  id: string;
  board_id: string;
  title: string;
  color: string;
}

export interface DeckCard extends Task {
  assignee_name: string | null;
  created_by_name: string | null;
  time_logged_minutes: number;
  comment_count: number;
  attachment_count: number;
  labels: DeckLabel[];
}

export interface DeckComment {
  id: string;
  task_id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
}

export type VaultCategory =
  | "social"
  | "ads"
  | "email"
  | "hosting"
  | "domain"
  | "tools"
  | "banking"
  | "other";

/** Vault entry as sent to the client — never includes the password. */
export interface VaultEntry {
  id: string;
  company_id: string | null;
  company_name: string | null;
  created_by: string | null;
  created_by_name: string | null;
  title: string;
  category: VaultCategory;
  username: string | null;
  url: string | null;
  notes: string | null;
  shared_with: Array<{ id: string; name: string }>;
  can_manage: boolean;
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
  approvalStatus: ApprovalStatus;
}

export interface AgencyAdAccount {
  id: string;
  name: string;
  currency?: string;
}

export interface ChatRoom {
  id: string;
  company_id: string | null;
  company_name?: string | null;
  company_slug?: string | null;
  name: string;
  is_dm: boolean;
  created_by: string | null;
  created_at: string;
  unread_count?: number;
  last_message?: string | null;
  last_message_at?: string | null;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name?: string;
  sender_avatar?: string | null;
  sender_companies?: string[];
  content: string;
  created_at: string;
}

export interface CompanyMember {
  id: string;
  company_id: string;
  user_id: string;
  role: UserRole;
  user_email?: string;
  user_name?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  approval_status: ApprovalStatus;
  roles: UserRole[];
  created_at: string;
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

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export type AiCallStatus =
  | "queued"
  | "ringing"
  | "in_progress"
  | "completed"
  | "failed"
  | "transferred"
  | "no_answer";

export type ConversationChannel =
  | "instagram"
  | "facebook"
  | "email"
  | "website_chat"
  | "sms"
  | "whatsapp"
  | "internal";

export type KnowledgeDocType =
  | "general"
  | "playbook"
  | "objection"
  | "faq"
  | "product";

export type AutomationTrigger =
  | "lead_created"
  | "lead_status_changed"
  | "missed_call"
  | "appointment_upcoming"
  | "manual"
  | "webhook";

export interface Branch {
  id: string;
  company_id: string;
  name: string;
  code: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  phone: string | null;
  timezone: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  company_id: string;
  branch_id: string | null;
  lead_id: string | null;
  owner_id: string | null;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  lifetime_value: number;
  tags: string[];
  notes: string | null;
  metadata: Record<string, unknown>;
  converted_at: string;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  company_id: string;
  branch_id: string | null;
  lead_id: string | null;
  customer_id: string | null;
  owner_id: string | null;
  title: string;
  description: string | null;
  status: AppointmentStatus;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  booking_url: string | null;
  payment_url: string | null;
  amount: number;
  currency: string;
  external_id: string | null;
  source: string | null;
  reminder_sent_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AiCall {
  id: string;
  company_id: string;
  branch_id: string | null;
  lead_id: string | null;
  customer_id: string | null;
  direction: "inbound" | "outbound";
  status: AiCallStatus;
  phone_number: string | null;
  agent_id: string | null;
  conversation_id: string | null;
  duration_seconds: number;
  recording_url: string | null;
  transcript: string | null;
  summary: string | null;
  score: number | null;
  sentiment: string | null;
  objections: unknown[];
  transferred_to: string | null;
  transferred_at: string | null;
  analysis: Record<string, unknown>;
  metadata: Record<string, unknown>;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  company_id: string;
  branch_id: string | null;
  lead_id: string | null;
  customer_id: string | null;
  channel: ConversationChannel;
  external_thread_id: string | null;
  subject: string | null;
  participant_name: string | null;
  participant_handle: string | null;
  assignee_id: string | null;
  status: string;
  last_message_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CrmMessage {
  id: string;
  conversation_id: string;
  direction: string;
  sender_type: string;
  sender_id: string | null;
  body: string;
  ai_generated: boolean;
  external_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface KnowledgeDoc {
  id: string;
  company_id: string | null;
  title: string;
  content: string;
  doc_type: KnowledgeDocType;
  tags: string[];
  is_global: boolean;
  created_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  config?: Record<string, unknown>;
}

export interface DashboardLayout {
  id: string;
  user_id: string | null;
  company_id: string | null;
  branch_id: string | null;
  scope: string;
  name: string;
  widgets: DashboardWidget[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface AutomationRule {
  id: string;
  company_id: string;
  branch_id: string | null;
  name: string;
  trigger_type: AutomationTrigger;
  is_active: boolean;
  conditions: Record<string, unknown>;
  actions: unknown[];
  created_by: string | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Sequence {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SequenceStep {
  id: string;
  sequence_id: string;
  position: number;
  step_type: string;
  delay_hours: number;
  config: Record<string, unknown>;
  created_at: string;
}

export interface WebhookEndpoint {
  id: string;
  company_id: string | null;
  name: string;
  direction: string;
  url: string | null;
  secret: string | null;
  events: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CustomFieldDefinition {
  id: string;
  company_id: string;
  object_type: string;
  field_key: string;
  label: string;
  field_type: string;
  options: unknown[];
  is_required: boolean;
  position: number;
  created_at: string;
}

export interface AttributionLink {
  id: string;
  company_id: string;
  branch_id: string | null;
  lead_id: string | null;
  customer_id: string | null;
  appointment_id: string | null;
  source: string | null;
  medium: string | null;
  campaign_external_id: string | null;
  ad_set_external_id: string | null;
  ad_external_id: string | null;
  platform: string | null;
  spend_attributed: number;
  revenue_attributed: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface MetaAdSet {
  id: string;
  company_id: string;
  campaign_id: string | null;
  external_id: string;
  name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  leads_count: number;
  cpl: number;
  metadata: Record<string, unknown>;
  synced_at: string;
}

export interface MetaAd {
  id: string;
  company_id: string;
  ad_set_id: string | null;
  campaign_id: string | null;
  external_id: string;
  name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  leads_count: number;
  cpl: number;
  metadata: Record<string, unknown>;
  synced_at: string;
}
