import { notFound } from "next/navigation";
import { PublishingHub } from "@/components/scheduler/publishing-hub";
import { getCompanyBySlug } from "@/features/companies/queries";
import { requireCompanyPageAccess } from "@/lib/auth/page-guards";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function SchedulerPage({ params }: PageProps) {
  await requireCompanyPageAccess("scheduler");
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  return (
    <PublishingHub companyName={company.name} companyWebsite={company.website} />
  );
}
