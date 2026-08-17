import { redirect } from "next/navigation";

export default async function RingCentralRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/companies/${slug}/calls`);
}
