import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LeadTimeline } from "@/components/leads/lead-timeline";
import { LeadQuickActions } from "@/components/leads/lead-quick-actions";
import {
  getLeadActivities,
  getLeads,
} from "@/features/companies/company-data";
import { getCompanyBySlug } from "@/features/companies/queries";
import { shouldScopeLeadsToOwner } from "@/lib/auth/access";
import { requireCompanyPageAccess } from "@/lib/auth/page-guards";

interface PageProps {
  params: Promise<{ slug: string; leadId: string }>;
}

export default async function LeadDetailPage({ params }: PageProps) {
  const user = await requireCompanyPageAccess("leads");
  const { slug, leadId } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const ownerId = shouldScopeLeadsToOwner(user.roles) ? user.id : undefined;
  const leads = await getLeads(company.id, ownerId);
  const lead = leads.find((l) => l.id === leadId);
  if (!lead) notFound();

  const activities = await getLeadActivities(leadId);

  return (
    <div className="space-y-6">
      <Link
        href={`/companies/${slug}/leads`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to leads
      </Link>
      <LeadQuickActions lead={lead} companyId={company.id} companySlug={slug} />
      <LeadTimeline lead={lead} activities={activities} />
    </div>
  );
}
