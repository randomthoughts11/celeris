"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, Shield, UserX, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  approveUserAction,
  assignUserToCompanyAction,
  rejectUserAction,
  removeUserFromCompanyAction,
  setUserRoleAction,
} from "@/features/admin/actions";
import type { AdminUser, CompanyWithMetrics, UserRole } from "@/types";
import { ROLE_LABELS } from "@/lib/rbac/permissions";

const ASSIGNABLE_ROLES: UserRole[] = [
  "admin",
  "manager",
  "designer",
  "telecaller",
];

export interface CompanyMembershipRow {
  id: string;
  company_id: string;
  user_id: string;
  role: UserRole;
  company_name: string;
}

interface AdminPanelProps {
  users: AdminUser[];
  companies: CompanyWithMetrics[];
  memberships: CompanyMembershipRow[];
}

export function AdminPanel({ users, companies, memberships }: AdminPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [assignCompany, setAssignCompany] = useState<Record<string, string>>({});
  const [assignRole, setAssignRole] = useState<Record<string, UserRole>>({});

  const membershipsByUser = useMemo(() => {
    const map = new Map<string, CompanyMembershipRow[]>();
    for (const m of memberships) {
      const list = map.get(m.user_id) ?? [];
      list.push(m);
      map.set(m.user_id, list);
    }
    return map;
  }, [memberships]);

  const pendingUsers = users.filter((u) => u.approval_status === "pending");
  const approvedUsers = users.filter((u) => u.approval_status === "approved");

  const act = (fn: () => Promise<{ error?: string; success?: boolean }>) => {
    startTransition(async () => {
      const result = await fn();
      if (result.error) toast.error(result.error);
      else {
        toast.success("Updated");
        router.refresh();
      }
    });
  };

  const assign = (userId: string) => {
    const companyId = assignCompany[userId];
    const role = assignRole[userId] ?? "manager";
    if (!companyId) {
      toast.error("Select a company");
      return;
    }
    act(() => assignUserToCompanyAction(userId, companyId, role));
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-muted-foreground">
          Approve users, assign roles, and map team members to companies.
        </p>
      </div>

      {pendingUsers.length > 0 && (
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Users className="h-5 w-5 text-amber-400" />
            Pending approval ({pendingUsers.length})
          </h2>
          <div className="space-y-3">
            {pendingUsers.map((u) => (
              <Card
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-4 border-amber-500/20 bg-amber-500/5 p-4"
              >
                <div>
                  <p className="font-medium">{u.full_name}</p>
                  <p className="text-sm text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select
                    defaultValue={u.roles[0] ?? "manager"}
                    onValueChange={(role) =>
                      act(() => setUserRoleAction(u.id, role as UserRole))
                    }
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSIGNABLE_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={() => act(() => approveUserAction(u.id))}
                    disabled={pending}
                  >
                    <Check className="mr-1 h-3 w-3" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => act(() => rejectUserAction(u.id))}
                    disabled={pending}
                  >
                    <UserX className="mr-1 h-3 w-3" />
                    Reject
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Shield className="h-5 w-5 text-violet-400" />
          Team members
        </h2>
        <div className="space-y-3">
          {approvedUsers.map((u) => {
            const userMemberships = membershipsByUser.get(u.id) ?? [];
            return (
              <Card
                key={u.id}
                className="space-y-4 border-white/5 bg-white/[0.02] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{u.full_name}</p>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {u.roles.map((r) => (
                      <Badge key={r} variant="outline">
                        {ROLE_LABELS[r]}
                      </Badge>
                    ))}
                    {!u.roles.includes("god_mode") && (
                      <Select
                        value={u.roles[0] ?? "manager"}
                        onValueChange={(role) =>
                          act(() => setUserRoleAction(u.id, role as UserRole))
                        }
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ASSIGNABLE_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                {!u.roles.includes("god_mode") && !u.roles.includes("admin") && (
                  <div className="space-y-3 border-t border-white/5 pt-4">
                    <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                      Company access
                    </p>
                    {userMemberships.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {userMemberships.map((m) => (
                          <Badge
                            key={m.id}
                            variant="secondary"
                            className="gap-1 pr-1"
                          >
                            {m.company_name} · {ROLE_LABELS[m.role]}
                            <button
                              type="button"
                              className="ml-1 rounded p-0.5 hover:bg-white/10"
                              onClick={() =>
                                act(() =>
                                  removeUserFromCompanyAction(u.id, m.company_id)
                                )
                              }
                              disabled={pending}
                              aria-label={`Remove from ${m.company_name}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-amber-400/90">
                        Not assigned to any company — they will not see client data.
                      </p>
                    )}
                    <div className="flex flex-wrap items-end gap-2">
                      <Select
                        value={assignCompany[u.id] ?? ""}
                        onValueChange={(v) =>
                          setAssignCompany((prev) => ({
                            ...prev,
                            [u.id]: v ?? "",
                          }))
                        }
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Add to company" />
                        </SelectTrigger>
                        <SelectContent>
                          {companies.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={assignRole[u.id] ?? "manager"}
                        onValueChange={(v) =>
                          setAssignRole((prev) => ({
                            ...prev,
                            [u.id]: v as UserRole,
                          }))
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ASSIGNABLE_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => assign(u.id)}
                        disabled={pending}
                      >
                        Assign
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
