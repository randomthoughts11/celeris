import { notFound } from "next/navigation";
import { SchedulerClient } from "@/components/scheduler/scheduler-client";
import { getSocialPosts } from "@/features/companies/company-data";
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

  const posts = await getSocialPosts(company.id);

  return <SchedulerClient posts={posts} companyId={company.id} />;
}
