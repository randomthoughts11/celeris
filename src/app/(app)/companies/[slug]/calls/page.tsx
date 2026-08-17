import { notFound } from "next/navigation";
import { CallLogClient } from "@/components/calls/call-log-client";
import { getLeads, getRingCentralCalls } from "@/features/companies/company-data";
import { getCompanyBySlug } from "@/features/companies/queries";
import { shouldScopeLeadsToOwner } from "@/lib/auth/access";
import { requireCompanyPageAccess } from "@/lib/auth/page-guards";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CallLogPage({ params }: PageProps) {
  const user = await requireCompanyPageAccess("calls");
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const ownerId = shouldScopeLeadsToOwner(user.roles) ? user.id : undefined;
  const [calls, leads] = await Promise.all([
    getRingCentralCalls(company.id),
    getLeads(company.id, ownerId),
  ]);

  return <CallLogClient companyId={company.id} calls={calls} leads={leads} />;
}
