import { notFound } from "next/navigation";
import { requireCompanyPageAccess } from "@/lib/auth/page-guards";
import { getCompanyBySlug } from "@/features/companies/queries";
import {
  listAutomationRules,
  listSequences,
  listWebhookEndpoints,
} from "@/lib/db/automations";
import { AutomationsClient } from "@/components/vande/crm-clients";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function AutomationsPage({ params }: PageProps) {
  await requireCompanyPageAccess("automations");
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  const [rules, sequences, webhooks] = await Promise.all([
    listAutomationRules(company.id),
    listSequences(company.id),
    listWebhookEndpoints(company.id),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Automations</h1>
        <p className="text-muted-foreground">
          Lead routing, AI call triggers, sequences, reminders, and webhooks.
        </p>
      </div>
      <AutomationsClient
        companyId={company.id}
        rules={rules}
        sequences={sequences}
        webhooks={webhooks}
      />
    </div>
  );
}
