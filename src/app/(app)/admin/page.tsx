import { AdminPanel } from "@/components/admin/admin-panel";
import { getAdminMembershipsAction, getAdminUsersAction } from "@/features/admin/actions";
import { getCompanies } from "@/features/companies/queries";
import { requireGlobalNavAccess } from "@/lib/auth/page-guards";

export default async function AdminPage() {
  const user = await requireGlobalNavAccess("admin");

  const [users, companies, memberships] = await Promise.all([
    getAdminUsersAction(),
    getCompanies(),
    getAdminMembershipsAction(),
  ]);

  return (
    <AdminPanel
      users={users}
      companies={companies}
      memberships={memberships}
      currentUserRoles={user.roles}
    />
  );
}
