import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/features/companies/queries";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function CompanyLayout({ children, params }: LayoutProps) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  return children;
}
