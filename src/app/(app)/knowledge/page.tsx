import { requireGlobalNavAccess } from "@/lib/auth/page-guards";
import { listKnowledgeDocs } from "@/lib/db/knowledge";
import { KnowledgeClient } from "@/components/vande/crm-clients";

export default async function GlobalKnowledgePage() {
  await requireGlobalNavAccess("knowledge");
  const docs = await listKnowledgeDocs({ includeGlobal: true });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vande Knowledge Base</h1>
        <p className="text-muted-foreground">
          Central playbooks, objection library, and AI response context.
        </p>
      </div>
      <KnowledgeClient docs={docs} />
    </div>
  );
}
