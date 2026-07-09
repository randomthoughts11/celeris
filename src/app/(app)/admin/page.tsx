import { AdminPanel } from "@/components/admin/admin-panel";
import { getAdminMembershipsAction, getAdminUsersAction } from "@/features/admin/actions";
import { getCompanies } from "@/features/companies/queries";
import { getSessionUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.roles, "MANAGE_USERS")) redirect("/");

  const [users, companies, memberships] = await Promise.all([
    getAdminUsersAction(),
    getCompanies(),
    getAdminMembershipsAction(),
  ]);

  return <AdminPanel users={users} companies={companies} memberships={memberships} />;
}
