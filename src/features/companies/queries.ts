import { fetchCompanies, fetchCompanyBySlug } from "@/lib/db/queries";
import { getAccessibleCompanyIds } from "@/lib/auth/access";
import { getSessionUser } from "@/lib/auth/session";
import type { CompanyWithMetrics } from "@/types";

export async function getCompanies(): Promise<CompanyWithMetrics[]> {
  const user = await getSessionUser();
  if (!user || user.approvalStatus !== "approved") return [];
  const accessible = await getAccessibleCompanyIds(user);
  return fetchCompanies(accessible);
}

export async function getCompanyBySlug(
  slug: string
): Promise<CompanyWithMetrics | null> {
  const company = await fetchCompanyBySlug(slug);
  if (!company) return null;

  const user = await getSessionUser();
  if (!user || user.approvalStatus !== "approved") return null;

  const accessible = await getAccessibleCompanyIds(user);
  if (accessible !== "all" && !accessible.includes(company.id)) {
    return null;
  }
  return company;
}
