import Link from "next/link";
import { Phone, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCompanies } from "@/features/companies/queries";
import { getLeads } from "@/features/companies/company-data";
import { getSessionUser } from "@/lib/auth/session";
import { shouldScopeLeadsToOwner } from "@/lib/auth/access";
import { isTelecallerFocused } from "@/lib/rbac/nav";
import { redirect } from "next/navigation";

export default async function TelecallerWorkspacePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!isTelecallerFocused(user.roles)) redirect("/");

  const ownerId = shouldScopeLeadsToOwner(user.roles) ? user.id : undefined;
  const companies = await getCompanies();
  const companyStats = (
    await Promise.all(
      companies.map(async (c) => {
        const leads = await getLeads(c.id, ownerId);
        const awaiting = leads.filter((l) => !l.last_contact_at).length;
        return { ...c, total: leads.length, awaiting };
      })
    )
  ).sort((a, b) => b.awaiting - a.awaiting || b.total - a.total);

  const totalLeads = companyStats.reduce((sum, c) => sum + c.total, 0);
  const totalAwaiting = companyStats.reduce((sum, c) => sum + c.awaiting, 0);
  const firstName = user.fullName.split(" ")[0] || user.fullName;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-violet-400">Telecaller desk</p>
        <h1 className="mt-1 text-2xl font-semibold">Hi {firstName}</h1>
        <p className="text-muted-foreground">
          Start with brands that still need a first contact.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-white/8 bg-white/[0.03] p-4">
          <p className="text-xs text-muted-foreground">Brands</p>
          <p className="mt-1 text-2xl font-semibold">{companyStats.length}</p>
        </Card>
        <Card className="border-white/8 bg-white/[0.03] p-4">
          <p className="text-xs text-muted-foreground">Leads assigned</p>
          <p className="mt-1 text-2xl font-semibold">{totalLeads}</p>
        </Card>
        <Card className="border-white/8 bg-amber-500/10 p-4">
          <p className="text-xs text-amber-300">Need first contact</p>
          <p className="mt-1 text-2xl font-semibold text-amber-200">
            {totalAwaiting}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {companyStats.map((c) => (
          <Card
            key={c.id}
            className="border-white/5 bg-white/[0.02] p-5 transition-colors hover:bg-white/[0.04]"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold">{c.name}</h2>
              {c.awaiting > 0 && (
                <Badge className="bg-amber-500/20 text-amber-300">
                  {c.awaiting} need contact
                </Badge>
              )}
            </div>
            <div className="mt-3">
              <Badge variant="outline">
                <Users className="mr-1 h-3 w-3" />
                {c.total} leads
              </Badge>
            </div>
            <div className="mt-4 flex gap-2">
              <Link
                href={`/companies/${c.slug}/leads`}
                className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80"
              >
                {c.awaiting > 0 ? "Contact now" : "Open inbox"}
              </Link>
              <Link
                href={`/companies/${c.slug}/calls`}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-sm hover:bg-muted"
              >
                <Phone className="h-3.5 w-3.5" />
                Call log
              </Link>
            </div>
          </Card>
        ))}
      </div>

      {companies.length === 0 && (
        <Card className="border-dashed p-12 text-center">
          <p className="font-medium">No brands on your desk</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask your admin to assign you to a client. Until then there is no inbox to work.
          </p>
        </Card>
      )}
    </div>
  );
}
