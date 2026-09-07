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
import {
  getIntegration,
  recomputeCompanyAdsMetrics,
  setLookerEmbedUrl,
} from "@/lib/db/integrations";
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

export async function setLookerEmbedAction(
  companyId: string,
  provider: "meta_ads" | "google_ads",
  url: string
) {
  const user = await requireAuth();
  if (!canManageBrandSetup(user)) return { error: "Forbidden" };
  await requireCompanyAccess(user, companyId);

  const trimmed = url.trim();
  if (!trimmed) {
    await setLookerEmbedUrl(companyId, provider, null);
    revalidateCompany();
    return { success: true };
  }

  const embedUrl = parseLookerEmbedUrl(trimmed);
  if (!embedUrl) {
    return {
      error:
        "Use a Looker Studio embed URL (File → Embed report → copy the URL).",
    };
  }

  await setLookerEmbedUrl(companyId, provider, embedUrl);
  revalidateCompany();
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
  const errors: string[] = [];
  let googleCount = 0;
  let metaCount = 0;

  if (google?.is_connected && google.config?.customerId) {
    try {
      googleCount = await syncGoogleAdsCampaigns(
        companyId,
        String(google.config.customerId)
      );
    } catch (e) {
      errors.push(`Google: ${e instanceof Error ? e.message : "sync failed"}`);
    }
  }
  if (meta?.is_connected && meta.config?.adAccountId) {
    try {
      const adAccountId = String(meta.config.adAccountId);
      metaCount = await syncMetaAdsCampaigns(companyId, adAccountId);
      await syncMetaSocialAccounts(companyId, adAccountId);
    } catch (e) {
      errors.push(`Meta: ${e instanceof Error ? e.message : "sync failed"}`);
    }
  }

  await recomputeCompanyAdsMetrics(companyId);

  const company = await fetchCompanyById(companyId);
  if (company) {
    try {
      await refreshCompanyInsights(company);
    } catch (e) {
      console.error("[insights] refresh failed:", e);
    }
  }

  revalidateCompany();

  if (errors.length && googleCount === 0 && metaCount === 0) {
    return { error: errors.join(" · ") };
  }
  if (errors.length) {
    return {
      success: true,
      warning: errors.join(" · "),
      googleCount,
      metaCount,
    };
  }
  if (
    !(google?.is_connected && google.config?.customerId) &&
    !(meta?.is_connected && meta.config?.adAccountId)
  ) {
    return {
      error: "Link a Google or Meta ad account on this brand first.",
    };
  }
  return { success: true, googleCount, metaCount };
}

export async function linkAdAccountAction(
  companyId: string,
  provider: "google_ads" | "meta_ads",
  accountId: string,
  accountName: string
) {
  const user = await requireAuth();
  if (!canManageBrandSetup(user)) {
    return { error: "Forbidden" };
  }
  await requireCompanyAccess(user, companyId);

  const id = accountId.trim();
  if (!id) return { error: "Pick an ad account" };

  if (provider === "google_ads") {
    await updateCompany(companyId, {
      googleCustomerId: id,
      googleCustomerName: accountName || id,
    });
  } else {
    await updateCompany(companyId, {
      metaAdAccountId: id,
      metaAdAccountName: accountName || id,
    });
  }

  const sync = await syncCompanyDataAction(companyId);
  revalidateApp();
  return sync;
}

export async function dismissInsightAction(insightId: string, companyId: string) {
  const user = await requireAuth();
  await requireCompanyAccess(user, companyId);
  const { dismissAiInsight } = await import("@/lib/db/ai-insights");
  await dismissAiInsight(insightId, companyId);
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
