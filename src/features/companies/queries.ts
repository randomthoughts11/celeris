import { demoStore } from "@/lib/demo/data";
import { isDatabaseConfigured } from "@/lib/config";
import {
  fetchCompanies,
  fetchCompanyBySlug,
} from "@/lib/db/queries";
import type { CompanyWithMetrics } from "@/types";

export async function getCompanies(): Promise<CompanyWithMetrics[]> {
  if (!isDatabaseConfigured()) {
    return demoStore.companies;
  }

  try {
    return await fetchCompanies();
  } catch {
    return demoStore.companies;
  }
}

export async function getCompanyBySlug(
  slug: string
): Promise<CompanyWithMetrics | null> {
  if (!isDatabaseConfigured()) {
    return demoStore.getCompanyBySlug(slug);
  }

  try {
    const company = await fetchCompanyBySlug(slug);
    return company ?? demoStore.getCompanyBySlug(slug);
  } catch {
    return demoStore.getCompanyBySlug(slug);
  }
}
