import { requireGlobalNavAccess } from "@/lib/auth/page-guards";
import { listConversations, listMessages } from "@/lib/db/messaging";
import { getAccessibleCompanyIds } from "@/lib/auth/access";
import { MessagesClient } from "@/components/vande/crm-clients";
import { getSql } from "@/lib/db/client";

export default async function GlobalInboxPage() {
  const user = await requireGlobalNavAccess("inbox");
  const access = await getAccessibleCompanyIds(user);
  const sql = getSql();
  let companyId: string | undefined;
  if (access === "all") {
    const rows = await sql`SELECT id FROM companies WHERE is_active = true ORDER BY name LIMIT 1`;
    companyId = rows[0]?.id as string | undefined;
  } else if (access.length > 0) {
    companyId = access[0];
  }
  const conversations = await listConversations(companyId);
  const firstId = conversations[0]?.id;
  const messages = firstId ? await listMessages(firstId) : [];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Messaging inbox</h1>
        <p className="text-muted-foreground">
          Centralized conversations across website chat, email, and Meta channels.
        </p>
      </div>
      {companyId ? (
        <MessagesClient
          companyId={companyId}
          conversations={conversations}
          initialMessages={messages}
          initialConversationId={firstId}
        />
      ) : (
        <p className="text-sm text-muted-foreground">No brand assigned.</p>
      )}
    </div>
  );
}
