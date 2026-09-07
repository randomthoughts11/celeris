import { notFound } from "next/navigation";
import { requireCompanyPageAccess } from "@/lib/auth/page-guards";
import { getCompanyBySlug } from "@/features/companies/queries";
import { listConversations, listMessages } from "@/lib/db/messaging";
import { MessagesClient } from "@/components/vande/crm-clients";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CompanyMessagesPage({ params }: PageProps) {
  await requireCompanyPageAccess("messages");
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  const conversations = await listConversations(company.id);
  const firstId = conversations[0]?.id;
  const messages = firstId ? await listMessages(firstId) : [];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="text-muted-foreground">
          Unified inbox for website chat, email, and Meta DMs.
        </p>
      </div>
      <MessagesClient
        companyId={company.id}
        conversations={conversations}
        initialMessages={messages}
        initialConversationId={firstId}
      />
    </div>
  );
}
