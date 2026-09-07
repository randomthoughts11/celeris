import { notFound } from "next/navigation";
import { requireCompanyPageAccess } from "@/lib/auth/page-guards";
import { shouldScopeLeadsToOwner } from "@/lib/auth/access";
import { getCompanyBySlug } from "@/features/companies/queries";
import { getLeads } from "@/features/companies/company-data";
import { listAiCalls } from "@/lib/db/ai-calls";
import { elevenLabsStatusMessage } from "@/lib/integrations/elevenlabs";
import { AiCallsClient } from "@/components/vande/crm-clients";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function AiCallsPage({ params }: PageProps) {
  const user = await requireCompanyPageAccess("ai-calls");
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  const ownerId = shouldScopeLeadsToOwner(user.roles) ? user.id : undefined;
  const [calls, leads] = await Promise.all([
    listAiCalls(company.id),
    getLeads(company.id, ownerId),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI calling</h1>
        <p className="text-muted-foreground">
          ElevenLabs outbound/inbound tracking, transcripts, scoring, and human transfer.
        </p>
      </div>
      <AiCallsClient
        companyId={company.id}
        calls={calls}
        leads={leads}
        elevenStatus={elevenLabsStatusMessage()}
      />
    </div>
  );
}
