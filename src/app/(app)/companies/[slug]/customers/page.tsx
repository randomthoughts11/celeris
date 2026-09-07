import { notFound } from "next/navigation";
import { requireCompanyPageAccess } from "@/lib/auth/page-guards";
import { shouldScopeLeadsToOwner } from "@/lib/auth/access";
import { getCompanyBySlug } from "@/features/companies/queries";
import { getLeads } from "@/features/companies/company-data";
import { listCustomers } from "@/lib/db/customers";
import { CustomersClient } from "@/components/vande/crm-clients";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CustomersPage({ params }: PageProps) {
  const user = await requireCompanyPageAccess("customers");
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  const ownerId = shouldScopeLeadsToOwner(user.roles) ? user.id : undefined;
  const [customers, leads] = await Promise.all([
    listCustomers(company.id, ownerId ? { ownerId } : undefined),
    getLeads(company.id, ownerId),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        <p className="text-muted-foreground">
          Converted leads and manually entered customers with attribution links.
        </p>
      </div>
      <CustomersClient companyId={company.id} customers={customers} leads={leads} />
    </div>
  );
}
