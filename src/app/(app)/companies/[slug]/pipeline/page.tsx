import { notFound } from "next/navigation";
import { requireCompanyPageAccess } from "@/lib/auth/page-guards";
import { shouldScopeLeadsToOwner } from "@/lib/auth/access";
import { getCompanyBySlug } from "@/features/companies/queries";
import { getLeads } from "@/features/companies/company-data";
import { PipelineClient } from "@/components/vande/crm-clients";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PipelinePage({ params }: PageProps) {
  const user = await requireCompanyPageAccess("pipeline");
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  const ownerId = shouldScopeLeadsToOwner(user.roles) ? user.id : undefined;
  const leads = await getLeads(company.id, ownerId);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sales pipeline</h1>
        <p className="text-muted-foreground">
          Drag-free stage board with follow-ups linked to leads.
        </p>
      </div>
      <PipelineClient companyId={company.id} leads={leads} />
    </div>
  );
}
