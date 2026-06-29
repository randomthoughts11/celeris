import { demoStore } from "@/lib/demo/data";
import { isDatabaseConfigured } from "@/lib/config";
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
  if (!isDatabaseConfigured()) return demoStore.getSnapshots(companyId);
  try {
    const data = await fetchPerformanceSnapshots(companyId);
    return data.length > 0 ? data : demoStore.getSnapshots(companyId);
  } catch {
    return demoStore.getSnapshots(companyId);
  }
}

export async function getAiInsights(companyId: string): Promise<AiInsight[]> {
  if (!isDatabaseConfigured()) return demoStore.getInsights(companyId);
  try {
    const data = await fetchAiInsights(companyId);
    return data.length > 0 ? data : demoStore.getInsights(companyId);
  } catch {
    return demoStore.getInsights(companyId);
  }
}

export async function getGoogleAdsCampaigns(
  companyId: string
): Promise<GoogleAdsCampaign[]> {
  if (!isDatabaseConfigured()) return demoStore.getGoogleCampaigns(companyId);
  try {
    const data = await fetchGoogleAdsCampaigns(companyId);
    return data.length > 0 ? data : demoStore.getGoogleCampaigns(companyId);
  } catch {
    return demoStore.getGoogleCampaigns(companyId);
  }
}

export async function getMetaAdsCampaigns(
  companyId: string
): Promise<MetaAdsCampaign[]> {
  if (!isDatabaseConfigured()) return demoStore.getMetaCampaigns(companyId);
  try {
    const data = await fetchMetaAdsCampaigns(companyId);
    return data.length > 0 ? data : demoStore.getMetaCampaigns(companyId);
  } catch {
    return demoStore.getMetaCampaigns(companyId);
  }
}

export async function getLeads(companyId: string): Promise<Lead[]> {
  if (!isDatabaseConfigured()) return demoStore.getLeads(companyId);
  try {
    const data = await fetchLeads(companyId);
    return data.length > 0 ? data : demoStore.getLeads(companyId);
  } catch {
    return demoStore.getLeads(companyId);
  }
}

export async function getLeadActivities(leadId: string): Promise<LeadActivity[]> {
  if (!isDatabaseConfigured()) return demoStore.getLeadActivities(leadId);
  try {
    return await fetchLeadActivities(leadId);
  } catch {
    return demoStore.getLeadActivities(leadId);
  }
}

export async function getTasks(companyId: string): Promise<Task[]> {
  if (!isDatabaseConfigured()) return demoStore.getTasks(companyId);
  try {
    const data = await fetchTasks(companyId);
    return data.length > 0 ? data : demoStore.getTasks(companyId);
  } catch {
    return demoStore.getTasks(companyId);
  }
}

export async function getSocialPosts(companyId: string): Promise<SocialPost[]> {
  if (!isDatabaseConfigured()) return demoStore.getSocialPosts(companyId);
  try {
    const data = await fetchSocialPosts(companyId);
    return data.length > 0 ? data : demoStore.getSocialPosts(companyId);
  } catch {
    return demoStore.getSocialPosts(companyId);
  }
}

export async function getSocialMetrics(
  companyId: string
): Promise<SocialMetrics[]> {
  if (!isDatabaseConfigured()) return demoStore.getSocialMetrics(companyId);
  try {
    const data = await fetchSocialMetrics(companyId);
    return data.length > 0 ? data : demoStore.getSocialMetrics(companyId);
  } catch {
    return demoStore.getSocialMetrics(companyId);
  }
}

export async function getRingCentralCalls(
  companyId: string
): Promise<RingCentralCall[]> {
  if (!isDatabaseConfigured()) return demoStore.getCalls(companyId);
  try {
    const data = await fetchRingCentralCalls(companyId);
    return data.length > 0 ? data : demoStore.getCalls(companyId);
  } catch {
    return demoStore.getCalls(companyId);
  }
}
