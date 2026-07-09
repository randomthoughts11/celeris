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
  const companyStats = await Promise.all(
    companies.map(async (c) => {
      const leads = await getLeads(c.id, ownerId);
      const awaiting = leads.filter((l) => !l.last_contact_at).length;
      return { ...c, total: leads.length, awaiting };
    })
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Telecaller workspace</h1>
        <p className="text-muted-foreground">
          Your lead inbox and call log — {user.fullName}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {companyStats.map((c) => (
          <Card
            key={c.id}
            className="border-white/5 bg-white/[0.02] p-5 transition-colors hover:bg-white/[0.04]"
          >
            <h2 className="font-semibold">{c.name}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline">
                <Users className="mr-1 h-3 w-3" />
                {c.total} leads
              </Badge>
              {c.awaiting > 0 && (
                <Badge className="bg-amber-500/20 text-amber-300">
                  {c.awaiting} need contact
                </Badge>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <Link
                href={`/companies/${c.slug}/leads`}
                className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80"
              >
                Open inbox
              </Link>
              <Link
                href={`/companies/${c.slug}/ringcentral`}
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
        <Card className="border-dashed p-12 text-center text-muted-foreground">
          No companies assigned yet. Ask your admin to assign you to a client.
        </Card>
      )}
    </div>
  );
}
