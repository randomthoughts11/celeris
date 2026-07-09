import {
  fetchAiInsights,
  fetchGoogleAdsCampaigns,
  fetchLeadActivities,
  fetchLeads,
  fetchMetaAdsCampaigns,
  fetchPerformanceSnapshots,
  fetchRingCentralCalls,
  fetchSocialMetrics,
  fetchSocialPosts,
  fetchTasks,
} from "@/lib/db/queries";
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
  return fetchPerformanceSnapshots(companyId);
}

export async function getAiInsights(companyId: string): Promise<AiInsight[]> {
  return fetchAiInsights(companyId);
}

export async function getGoogleAdsCampaigns(
  companyId: string
): Promise<GoogleAdsCampaign[]> {
  return fetchGoogleAdsCampaigns(companyId);
}

export async function getMetaAdsCampaigns(
  companyId: string
): Promise<MetaAdsCampaign[]> {
  return fetchMetaAdsCampaigns(companyId);
}

export async function getLeads(
  companyId: string,
  ownerId?: string
): Promise<Lead[]> {
  return fetchLeads(companyId, ownerId);
}

export async function getLeadActivities(leadId: string): Promise<LeadActivity[]> {
  return fetchLeadActivities(leadId);
}

export async function getTasks(companyId: string): Promise<Task[]> {
  return fetchTasks(companyId);
}

export async function getSocialPosts(companyId: string): Promise<SocialPost[]> {
  return fetchSocialPosts(companyId);
}

export async function getSocialMetrics(
  companyId: string
): Promise<SocialMetrics[]> {
  return fetchSocialMetrics(companyId);
}

export async function getRingCentralCalls(
  companyId: string
): Promise<RingCentralCall[]> {
  return fetchRingCentralCalls(companyId);
}
