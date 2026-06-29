import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { disconnectIntegration } from "@/lib/db/integrations";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId } = (await request.json()) as { companyId: string };
  if (!companyId) {
    return NextResponse.json({ error: "companyId required" }, { status: 400 });
  }

  await disconnectIntegration(companyId, "google_drive");
  return NextResponse.json({ success: true });
}
