import { notFound } from "next/navigation";
import { requireCompanyPageAccess } from "@/lib/auth/page-guards";
import { shouldScopeLeadsToOwner } from "@/lib/auth/access";
import { getCompanyBySlug } from "@/features/companies/queries";
import { getLeads } from "@/features/companies/company-data";
import { listAppointments } from "@/lib/db/appointments";
import { wixStatusMessage } from "@/lib/integrations/wix";
import { AppointmentsClient } from "@/components/vande/crm-clients";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function AppointmentsPage({ params }: PageProps) {
  const user = await requireCompanyPageAccess("appointments");
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  const ownerId = shouldScopeLeadsToOwner(user.roles) ? user.id : undefined;
  const [appointments, leads] = await Promise.all([
    listAppointments(company.id),
    getLeads(company.id, ownerId),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
        <p className="text-muted-foreground">
          Appointments, Wix booking/payment links, and SMS notifications.
        </p>
      </div>
      <AppointmentsClient
        companyId={company.id}
        appointments={appointments}
        leads={leads}
        wixStatus={wixStatusMessage()}
      />
    </div>
  );
}
