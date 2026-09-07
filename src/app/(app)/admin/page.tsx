import { AdminPanel } from "@/components/admin/admin-panel";
import { getAdminMembershipsAction, getAdminUsersAction } from "@/features/admin/actions";
import { getCompanies } from "@/features/companies/queries";
import { requireGlobalNavAccess } from "@/lib/auth/page-guards";
import { fetchRecentAuditLogs } from "@/lib/db/audit";
import { canViewAuditLogs } from "@/lib/auth/access";

export default async function AdminPage() {
  const user = await requireGlobalNavAccess("admin");

  const [users, companies, memberships, auditLogs] = await Promise.all([
    getAdminUsersAction(),
    getCompanies(),
    getAdminMembershipsAction(),
    canViewAuditLogs(user) ? fetchRecentAuditLogs(40, "all") : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-10">
      <AdminPanel
        users={users}
        companies={companies}
        memberships={memberships}
        currentUserRoles={user.roles}
      />
      {canViewAuditLogs(user) && (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Audit log</h2>
            <p className="text-sm text-muted-foreground">
              Recent security and data changes across brands.
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Resource</th>
                  <th className="px-3 py-2">Brand</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-6 text-center text-muted-foreground"
                    >
                      No audit events yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((a) => (
                    <tr key={a.id} className="border-b border-white/5">
                      <td className="px-3 py-2 text-muted-foreground">
                        {new Date(a.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">{a.user_name ?? "—"}</td>
                      <td className="px-3 py-2">{a.action}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {a.resource_type}
                      </td>
                      <td className="px-3 py-2">{a.company_name ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
