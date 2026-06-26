import { notFound } from "next/navigation";
import { SocialDashboard } from "@/components/social/social-dashboard";
import { getSocialMetrics } from "@/features/companies/company-data";
import { getCompanyBySlug } from "@/features/companies/queries";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function SocialPage({ params }: PageProps) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const metrics = await getSocialMetrics(company.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Social Media</h1>
        <p className="text-muted-foreground">
          Cross-platform performance across all connected accounts
        </p>
      </div>
      <SocialDashboard metrics={metrics} />
    </div>
  );
}
