import { redirect } from "next/navigation";

export default async function SchedulerRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/companies/${slug}/publish`);
}
