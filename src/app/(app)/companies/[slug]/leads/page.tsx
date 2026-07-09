import { getCompanyBySlug } from "@/features/companies/queries";
import { getLeads } from "@/features/companies/company-data";
import { LeadsInbox } from "@/components/leads/leads-inbox";
import { shouldScopeLeadsToOwner } from "@/lib/auth/access";
import { requireCompanyPageAccess } from "@/lib/auth/page-guards";
import { hasPermission } from "@/lib/rbac/permissions";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function LeadsPage({ params }: PageProps) {
  const user = await requireCompanyPageAccess("leads");

  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const ownerId = shouldScopeLeadsToOwner(user.roles) ? user.id : undefined;
  const leads = await getLeads(company.id, ownerId);
  const newLeads = leads.filter((l) => !l.last_contact_at).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Lead Inbox</h1>
        <p className="text-muted-foreground">
          Privyr-style workflow — call, WhatsApp, and log activity in one place.{" "}
          {leads.length} leads · {newLeads} awaiting first contact
        </p>
      </div>
      <LeadsInbox
        leads={leads}
        companyId={company.id}
        companySlug={slug}
        canAdd={hasPermission(user.roles, "ACCESS_LEADS")}
      />
    </div>
  );
}
