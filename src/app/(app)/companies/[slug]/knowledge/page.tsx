import { notFound } from "next/navigation";
import { requireCompanyPageAccess } from "@/lib/auth/page-guards";
import { getCompanyBySlug } from "@/features/companies/queries";
import { listKnowledgeDocs } from "@/lib/db/knowledge";
import { KnowledgeClient } from "@/components/vande/crm-clients";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CompanyKnowledgePage({ params }: PageProps) {
  await requireCompanyPageAccess("knowledge");
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  const docs = await listKnowledgeDocs({ companyId: company.id, includeGlobal: true });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Knowledge</h1>
        <p className="text-muted-foreground">
          Brand playbooks, objection library, and RAG-lite docs for AI assistants.
        </p>
      </div>
      <KnowledgeClient docs={docs} companyId={company.id} />
    </div>
  );
}
