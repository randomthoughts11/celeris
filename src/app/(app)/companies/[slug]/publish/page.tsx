import { notFound } from "next/navigation";
import { PublishingHub } from "@/components/scheduler/publishing-hub";
import { getCompanyBySlug } from "@/features/companies/queries";
import { requireCompanyPageAccess } from "@/lib/auth/page-guards";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PublishPage({ params }: PageProps) {
  await requireCompanyPageAccess("publish");
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  return (
    <PublishingHub
      companyName={company.name}
      companySlug={company.slug}
      companyWebsite={company.website}
    />
  );
}
