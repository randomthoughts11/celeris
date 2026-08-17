"use server";

import { revalidateApp, revalidateCompany } from "@/lib/cache/revalidate";
import { requireAuth } from "@/lib/auth/session";
import {
  canCreateCompanies,
  canManageBrandSetup,
  canManageCompanies,
  requireCompanyAccess,
} from "@/lib/auth/access";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  archiveCompany,
  createCompany,
  updateCompany,
} from "@/lib/db/companies";
import { refreshCompanyInsights } from "@/lib/db/ai-insights";
import { getIntegration, setLookerEmbedUrl } from "@/lib/db/integrations";
import { parseLookerEmbedUrl } from "@/lib/integrations/looker-studio";
import { fetchCompanyById } from "@/lib/db/queries";
import {
  listGoogleAdsCustomers,
  provisionDriveFoldersForCompany,
  syncGoogleAdsCampaigns,
} from "@/lib/integrations/google-agency";
import {
  listMetaAdAccounts,
  syncMetaAdsCampaigns,
  syncMetaSocialAccounts,
} from "@/lib/integrations/meta-agency";

export async function createCompanyAction(formData: FormData) {
  const user = await requireAuth();
  if (!canCreateCompanies(user)) {
    return { error: "You do not have permission to create companies" };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Company name is required" };

  try {
    const company = await createCompany({
      name,
      industry: String(formData.get("industry") ?? "") || undefined,
      website: String(formData.get("website") ?? "") || undefined,
      monthlyBudget: Number(formData.get("monthlyBudget") ?? 0) || 0,
      monthlyRevenueGoal: Number(formData.get("monthlyRevenueGoal") ?? 0) || 0,
      monthlyLeadGoal: Number(formData.get("monthlyLeadGoal") ?? 0) || 0,
      googleCustomerId: String(formData.get("googleCustomerId") ?? "") || undefined,
      googleCustomerName: String(formData.get("googleCustomerName") ?? "") || undefined,
      metaAdAccountId: String(formData.get("metaAdAccountId") ?? "") || undefined,
      metaAdAccountName: String(formData.get("metaAdAccountName") ?? "") || undefined,
      createdByUserId: user.id,
    });

    try {
      await provisionDriveFoldersForCompany(company.id, company.name);
    } catch (e) {
      console.error("[drive] folder provision failed:", e);
    }

    await syncCompanyDataAction(company.id);

    revalidateApp();
    return { success: true, slug: company.slug };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create company" };
  }
}

export async function archiveCompanyAction(companyId: string) {
  const user = await requireAuth();
  if (!canManageCompanies(user)) {
    return { error: "Forbidden" };
  }
  await requireCompanyAccess(user, companyId);
  await archiveCompany(companyId);
  revalidateApp();
  return { success: true };
}

export async function updateCompanyAction(companyId: string, formData: FormData) {
  const user = await requireAuth();
  if (!canManageBrandSetup(user)) {
    return { error: "Forbidden" };
  }
  await requireCompanyAccess(user, companyId);

  await updateCompany(companyId, {
    name: String(formData.get("name") ?? "") || undefined,
    industry: String(formData.get("industry") ?? "") || undefined,
    website: String(formData.get("website") ?? "") || undefined,
    monthlyBudget: formData.has("monthlyBudget")
      ? Number(formData.get("monthlyBudget"))
      : undefined,
    googleCustomerId: String(formData.get("googleCustomerId") ?? "") || undefined,
    googleCustomerName: String(formData.get("googleCustomerName") ?? "") || undefined,
    metaAdAccountId: String(formData.get("metaAdAccountId") ?? "") || undefined,
    metaAdAccountName: String(formData.get("metaAdAccountName") ?? "") || undefined,
  });

  revalidateApp();
  return { success: true };
}

export async function syncCompanyDataAction(companyId: string) {
  const user = await requireAuth();
  if (!hasPermission(user.roles, "MANAGE_CAMPAIGNS")) {
    return { error: "Forbidden" };
  }
  await requireCompanyAccess(user, companyId);

  const google = await getIntegration(companyId, "google_ads");
  const meta = await getIntegration(companyId, "meta_ads");

  if (google?.is_connected && google.config?.customerId) {
    await syncGoogleAdsCampaigns(companyId, String(google.config.customerId));
  }
  if (meta?.is_connected && meta.config?.adAccountId) {
    const adAccountId = String(meta.config.adAccountId);
    await syncMetaAdsCampaigns(companyId, adAccountId);
    await syncMetaSocialAccounts(companyId, adAccountId);
  }

  const company = await fetchCompanyById(companyId);
  if (company) {
    try {
      await refreshCompanyInsights(company);
    } catch (e) {
      console.error("[insights] refresh failed:", e);
    }
  }

  revalidateCompany();
  return { success: true };
}

export async function dismissInsightAction(insightId: string, companyId: string) {
  const user = await requireAuth();
  await requireCompanyAccess(user, companyId);
  const { dismissAiInsight } = await import("@/lib/db/ai-insights");
  await dismissAiInsight(insightId, companyId);
  revalidateCompany();
  return { success: true };
}

export async function setLookerEmbedAction(
  companyId: string,
  provider: "meta_ads" | "google_ads",
  rawUrl: string
) {
  const user = await requireAuth();
  if (!canManageBrandSetup(user)) {
    return { error: "Forbidden" };
  }
  await requireCompanyAccess(user, companyId);

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    await setLookerEmbedUrl(companyId, provider, null);
    revalidateCompany();
    return { success: true };
  }

  const embedUrl = parseLookerEmbedUrl(trimmed);
  if (!embedUrl) {
    return {
      error:
        "Invalid Looker Studio embed URL. Use the link from File → Embed report.",
    };
  }

  await setLookerEmbedUrl(companyId, provider, embedUrl);
  revalidateCompany();
  return { success: true };
}

export async function fetchCompanyMembersAction(companyId: string) {
  const user = await requireAuth();
  await requireCompanyAccess(user, companyId);
  const { getCompanyMembers } = await import("@/lib/db/companies");
  const rows = await getCompanyMembers(companyId);
  return rows.map((r) => ({
    id: r.user_id as string,
    name: (r.user_name as string) ?? (r.user_email as string),
    email: r.user_email as string,
    role: r.role as string,
  }));
}

export async function fetchAdAccountsAction() {
  const user = await requireAuth();
  if (!canManageBrandSetup(user)) {
    return { google: [], meta: [] };
  }

  const [google, meta] = await Promise.all([
    listGoogleAdsCustomers().catch(() => []),
    listMetaAdAccounts().catch(() => []),
  ]);

  return { google, meta };
}

export async function resolveCompanyNameAction(
  slug: string
): Promise<string | null> {
  const user = await requireAuth().catch(() => null);
  if (!user) return null;
  const { getCompanyBySlug } = await import("@/features/companies/queries");
  const company = await getCompanyBySlug(slug);
  return company?.name ?? null;
}
