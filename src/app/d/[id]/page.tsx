import type { Metadata } from "next";
import { DropReceiver } from "@/components/drops/drop-receiver";

export const metadata: Metadata = {
  title: "Encrypted drop",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function DropPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DropReceiver id={id} />;
}
