"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CompanyCard } from "@/components/companies/company-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  archiveCompanyAction,
  createCompanyAction,
  fetchAdAccountsAction,
} from "@/features/companies/actions";
import type { AgencyAdAccount, CompanyWithMetrics, SessionUser, UserRole } from "@/types";
import { hasPermission } from "@/lib/rbac/permissions";

interface HomeClientProps {
  companies: CompanyWithMetrics[];
  user: SessionUser;
}

export function HomeClient({ companies, user }: HomeClientProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [googleAccounts, setGoogleAccounts] = useState<AgencyAdAccount[]>([]);
  const [metaAccounts, setMetaAccounts] = useState<AgencyAdAccount[]>([]);
  const [googleId, setGoogleId] = useState("");
  const [googleName, setGoogleName] = useState("");
  const [metaId, setMetaId] = useState("");
  const [metaName, setMetaName] = useState("");
  const canManage = hasPermission(user.roles, "MANAGE_ALL_COMPANIES");

  const loadAccounts = async () => {
    const data = await fetchAdAccountsAction();
    setGoogleAccounts(data.google);
    setMetaAccounts(data.meta);
  };

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (googleId) {
      formData.set("googleCustomerId", googleId);
      formData.set("googleCustomerName", googleName);
    }
    if (metaId) {
      formData.set("metaAdAccountId", metaId);
      formData.set("metaAdAccountName", metaName);
    }
    startTransition(async () => {
      const result = await createCompanyAction(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Company created");
      setOpen(false);
      if (result.slug) router.push(`/companies/${result.slug}`);
      else router.refresh();
    });
  };

  const handleArchive = (companyId: string, name: string) => {
    if (!confirm(`Archive "${name}"? This hides it from the dashboard.`)) return;
    startTransition(async () => {
      const result = await archiveCompanyAction(companyId);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Company archived");
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-center sm:text-left">
          <h1 className="text-3xl font-semibold tracking-tight">Your Brands</h1>
          <p className="mt-2 text-muted-foreground">
            {companies.length} active {companies.length === 1 ? "client" : "clients"}
          </p>
        </div>
        {canManage && (
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (v) loadAccounts();
            }}
          >
            <DialogTrigger
              className="inline-flex h-8 items-center justify-center gap-2 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
            >
              <Plus className="h-4 w-4" />
              Add company
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create company</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Company name *</Label>
                  <Input id="name" name="name" required placeholder="Acme Corp" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry</Label>
                    <Input id="industry" name="industry" placeholder="Retail" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input id="website" name="website" placeholder="https://" />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="monthlyBudget">Monthly budget</Label>
                    <Input id="monthlyBudget" name="monthlyBudget" type="number" min={0} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthlyRevenueGoal">Revenue goal</Label>
                    <Input id="monthlyRevenueGoal" name="monthlyRevenueGoal" type="number" min={0} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthlyLeadGoal">Lead goal</Label>
                    <Input id="monthlyLeadGoal" name="monthlyLeadGoal" type="number" min={0} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Google Ads account</Label>
                  <Select
                    value={googleId}
                    onValueChange={(v) => {
                      setGoogleId(v ?? "");
                      const acc = googleAccounts.find((a) => a.id === v);
                      setGoogleName(acc?.name ?? "");
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Google Ads account" />
                    </SelectTrigger>
                    <SelectContent>
                      {googleAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} ({a.id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {googleAccounts.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Connect Google in Settings to list ad accounts.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Meta ad account</Label>
                  <Select
                    value={metaId}
                    onValueChange={(v) => {
                      setMetaId(v ?? "");
                      const acc = metaAccounts.find((a) => a.id === v);
                      setMetaName(acc?.name ?? "");
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Meta ad account" />
                    </SelectTrigger>
                    <SelectContent>
                      {metaAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {metaAccounts.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Connect Meta in Settings to list ad accounts.
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={pending}>
                  {pending ? "Creating…" : "Create company"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {companies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 py-16 text-center">
          <p className="text-muted-foreground">No companies yet.</p>
          {canManage && (
            <p className="mt-2 text-sm text-muted-foreground">
              Click &quot;Add company&quot; to create your first brand.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {companies.map((company, index) => (
            <div key={company.id} className="relative group">
              <CompanyCard company={company} index={index} />
              {canManage && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => handleArchive(company.id, company.name)}
                  disabled={pending}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
