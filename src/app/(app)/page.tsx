import { HomeClient } from "@/components/companies/home-client";
import { getCompanies } from "@/features/companies/queries";
import { getAccessibleCompanyIds } from "@/lib/auth/access";
import { getSessionUser } from "@/lib/auth/session";
import { fetchAgencyTasks } from "@/lib/db/tasks";
import { getHomePathForRole } from "@/lib/rbac/nav";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.approvalStatus !== "approved") redirect("/pending-approval");

  const home = getHomePathForRole(user.roles);
  if (home !== "/") redirect(home);

  const companies = await getCompanies();
  const accessible = await getAccessibleCompanyIds(user);
  const agencyTasks = await fetchAgencyTasks(accessible);

  return <HomeClient companies={companies} user={user} agencyTasks={agencyTasks} />;
}
