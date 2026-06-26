import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { demoStore } from "@/lib/demo/data";
import type { CompanyWithMetrics } from "@/types";

export async function getCompanies(): Promise<CompanyWithMetrics[]> {
  if (!isSupabaseConfigured()) {
    return demoStore.companies;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*, metrics:company_metrics(*)")
    .eq("is_active", true)
    .order("name");

  if (error || !data) {
    return demoStore.companies;
  }

  return data.map((row) => ({
    ...row,
    metrics: Array.isArray(row.metrics) ? row.metrics[0] ?? null : row.metrics,
  })) as CompanyWithMetrics[];
}

export async function getCompanyBySlug(
  slug: string
): Promise<CompanyWithMetrics | null> {
  if (!isSupabaseConfigured()) {
    return demoStore.getCompanyBySlug(slug);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*, metrics:company_metrics(*)")
    .eq("slug", slug)
    .single();

  if (error || !data) {
    return demoStore.getCompanyBySlug(slug);
  }

  return {
    ...data,
    metrics: Array.isArray(data.metrics) ? data.metrics[0] ?? null : data.metrics,
  } as CompanyWithMetrics;
}
