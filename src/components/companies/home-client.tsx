"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CompanyCard } from "@/components/companies/company-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import type { AgencyAdAccount, CompanyWithMetrics, SessionUser } from "@/types";
import type { TaskWithAssignee } from "@/lib/db/tasks";
import { canViewFinancials, hasPermission, ROLE_LABELS, getHighestRole } from "@/lib/rbac/permissions";
import { AgencyCommandCenter } from "@/components/dashboard/agency-command-center";

interface HomeClientProps {
  companies: CompanyWithMetrics[];
  user: SessionUser;
  agencyTasks: TaskWithAssignee[];
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function HomeClient({ companies, user, agencyTasks }: HomeClientProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const [googleAccounts, setGoogleAccounts] = useState<AgencyAdAccount[]>([]);
  const [metaAccounts, setMetaAccounts] = useState<AgencyAdAccount[]>([]);
  const [googleId, setGoogleId] = useState("");
  const [googleName, setGoogleName] = useState("");
  const [metaId, setMetaId] = useState("");
  const [metaName, setMetaName] = useState("");
  const canCreate = hasPermission(user.roles, "CREATE_COMPANY");
  const canArchive = hasPermission(user.roles, "MANAGE_ALL_COMPANIES");
  const firstName = user.fullName.split(" ")[0] || user.fullName;
  const roleLabel =
    user.roles.length > 0
      ? ROLE_LABELS[getHighestRole(user.roles)]
      : "Pending role";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.industry ?? "").toLowerCase().includes(q)
    );
  }, [companies, query]);

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

  const handleArchive = () => {
    if (!archiveTarget) return;
    startTransition(async () => {
      const result = await archiveCompanyAction(archiveTarget.id);
      if (result.error) toast.error(result.error);
      else {
        toast.success(`${archiveTarget.name} archived`);
        setArchiveTarget(null);
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-violet-400">{roleLabel}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {greeting()}, {firstName}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {companies.length === 0
              ? "No brands on your desk yet."
              : `${companies.length} brand${companies.length === 1 ? "" : "s"} · jump into Board, Inbox, or Publish from each card.`}
          </p>
        </div>
        {canCreate && (
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (v) loadAccounts();
            }}
          >
            <DialogTrigger
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80"
            >
              <Plus className="h-4 w-4" />
              Add brand
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create brand</DialogTitle>
                <DialogDescription>
                  Name the client. Ad accounts can be linked now or later in Settings.
                </DialogDescription>
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
                  {pending ? "Creating…" : "Create brand"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {agencyTasks.length > 0 && <AgencyCommandCenter tasks={agencyTasks} />}

      {companies.length > 0 && (
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a brand…"
            className="pl-9"
          />
        </div>
      )}

      {companies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-20 text-center">
          <p className="text-lg font-medium">Your brand desk is empty</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {canCreate
              ? "Add the first client. You’ll get a Board, lead inbox, and publish launchpad in one place."
              : "Ask an admin to assign you to a brand."}
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No brands match “{query}”.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((company, index) => (
            <div key={company.id} className="relative group">
              <CompanyCard
                company={company}
                index={index}
                showFinancials={canViewFinancials(user.roles)}
                roles={user.roles}
              />
              {canArchive && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() =>
                    setArchiveTarget({ id: company.id, name: company.name })
                  }
                  disabled={pending}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive {archiveTarget?.name}?</DialogTitle>
            <DialogDescription>
              It disappears from this desk. You can restore it later from the database if needed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleArchive} disabled={pending}>
              {pending ? "Archiving…" : "Archive brand"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
