import { notFound } from "next/navigation";
import { requireCompanyPageAccess } from "@/lib/auth/page-guards";
import { getCompanyBySlug } from "@/features/companies/queries";
import { listBranches } from "@/lib/db/branches";
import { BranchesClient } from "@/components/vande/crm-clients";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function BranchesPage({ params }: PageProps) {
  await requireCompanyPageAccess("branches");
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  const branches = await listBranches(company.id);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Branches</h1>
        <p className="text-muted-foreground">
          Locations under this brand for routing, attribution, and performance.
        </p>
      </div>
      <BranchesClient companyId={company.id} branches={branches} />
    </div>
  );
}
