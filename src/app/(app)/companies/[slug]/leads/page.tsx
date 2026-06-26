import { notFound } from "next/navigation";
import { LeadsList } from "@/components/leads/leads-list";
import { getLeads } from "@/features/companies/company-data";
import { getCompanyBySlug } from "@/features/companies/queries";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function LeadsPage({ params }: PageProps) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const leads = await getLeads(company.id);
  const newLeads = leads.filter((l) => !l.last_contact_at).length;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Lead Management
          </h1>
          <p className="text-muted-foreground">
            {leads.length} leads · {newLeads} awaiting first contact
          </p>
        </div>
      </div>
      <LeadsList leads={leads} companySlug={slug} />
    </div>
  );
}
