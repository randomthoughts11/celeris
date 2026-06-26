import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { demoStore } from "@/lib/demo/data";
import type {
  AiInsight,
  GoogleAdsCampaign,
  Lead,
  LeadActivity,
  MetaAdsCampaign,
  PerformanceSnapshot,
  RingCentralCall,
  SocialMetrics,
  SocialPost,
  Task,
} from "@/types";

export async function getPerformanceSnapshots(
  companyId: string
): Promise<PerformanceSnapshot[]> {
  if (!isSupabaseConfigured()) return demoStore.getSnapshots(companyId);

  const supabase = await createClient();
  const { data } = await supabase
    .from("performance_snapshots")
    .select("*")
    .eq("company_id", companyId)
    .order("snapshot_date", { ascending: true })
    .limit(30);

  return (data as PerformanceSnapshot[]) ?? demoStore.getSnapshots(companyId);
}

export async function getAiInsights(companyId: string): Promise<AiInsight[]> {
  if (!isSupabaseConfigured()) return demoStore.getInsights(companyId);

  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_insights")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_dismissed", false)
    .order("created_at", { ascending: false });

  return (data as AiInsight[]) ?? demoStore.getInsights(companyId);
}

export async function getGoogleAdsCampaigns(
  companyId: string
): Promise<GoogleAdsCampaign[]> {
  if (!isSupabaseConfigured()) return demoStore.getGoogleCampaigns(companyId);

  const supabase = await createClient();
  const { data } = await supabase
    .from("google_ads_campaigns")
    .select("*")
    .eq("company_id", companyId)
    .order("name");

  return (data as GoogleAdsCampaign[]) ?? demoStore.getGoogleCampaigns(companyId);
}

export async function getMetaAdsCampaigns(
  companyId: string
): Promise<MetaAdsCampaign[]> {
  if (!isSupabaseConfigured()) return demoStore.getMetaCampaigns(companyId);

  const supabase = await createClient();
  const { data } = await supabase
    .from("meta_ads_campaigns")
    .select("*")
    .eq("company_id", companyId)
    .order("name");

  return (data as MetaAdsCampaign[]) ?? demoStore.getMetaCampaigns(companyId);
}

export async function getLeads(companyId: string): Promise<Lead[]> {
  if (!isSupabaseConfigured()) return demoStore.getLeads(companyId);

  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  return (data as Lead[]) ?? demoStore.getLeads(companyId);
}

export async function getLeadActivities(leadId: string): Promise<LeadActivity[]> {
  if (!isSupabaseConfigured()) return demoStore.getLeadActivities(leadId);

  const supabase = await createClient();
  const { data } = await supabase
    .from("lead_activities")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  return (data as LeadActivity[]) ?? demoStore.getLeadActivities(leadId);
}

export async function getTasks(companyId: string): Promise<Task[]> {
  if (!isSupabaseConfigured()) return demoStore.getTasks(companyId);

  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("company_id", companyId)
    .order("due_date", { ascending: true });

  return (data as Task[]) ?? demoStore.getTasks(companyId);
}

export async function getSocialPosts(companyId: string): Promise<SocialPost[]> {
  if (!isSupabaseConfigured()) return demoStore.getSocialPosts(companyId);

  const supabase = await createClient();
  const { data } = await supabase
    .from("social_posts")
    .select("*")
    .eq("company_id", companyId)
    .order("scheduled_at", { ascending: true });

  return (data as SocialPost[]) ?? demoStore.getSocialPosts(companyId);
}

export async function getSocialMetrics(
  companyId: string
): Promise<SocialMetrics[]> {
  if (!isSupabaseConfigured()) return demoStore.getSocialMetrics(companyId);

  const supabase = await createClient();
  const { data } = await supabase
    .from("social_metrics")
    .select("*")
    .eq("company_id", companyId);

  return (data as SocialMetrics[]) ?? demoStore.getSocialMetrics(companyId);
}

export async function getRingCentralCalls(
  companyId: string
): Promise<RingCentralCall[]> {
  if (!isSupabaseConfigured()) return demoStore.getCalls(companyId);

  const supabase = await createClient();
  const { data } = await supabase
    .from("ringcentral_calls")
    .select("*")
    .eq("company_id", companyId)
    .order("started_at", { ascending: false });

  return (data as RingCentralCall[]) ?? demoStore.getCalls(companyId);
}
