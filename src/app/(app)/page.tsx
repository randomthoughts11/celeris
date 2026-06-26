import { CompanyCard } from "@/components/companies/company-card";
import { getCompanies } from "@/features/companies/queries";
import { getSessionUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const companies = await getCompanies();

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Your Brands
        </h1>
        <p className="mt-2 text-muted-foreground">
          {companies.length} active {companies.length === 1 ? "client" : "clients"}
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {companies.map((company, index) => (
          <CompanyCard key={company.id} company={company} index={index} />
        ))}
      </div>
    </div>
  );
}
