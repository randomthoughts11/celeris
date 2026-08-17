import { redirect } from "next/navigation";

export default async function TasksRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/companies/${slug}/board`);
}
