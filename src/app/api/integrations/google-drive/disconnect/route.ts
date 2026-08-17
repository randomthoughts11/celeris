import { NextResponse } from "next/server";
import { requireApprovedApiUser } from "@/lib/auth/api";
import { canManageBrandSetup, requireCompanyAccess } from "@/lib/auth/access";
import { disconnectIntegration } from "@/lib/db/integrations";

export async function POST(request: Request) {
  const auth = await requireApprovedApiUser();
  if (auth.error) return auth.error;
  if (!canManageBrandSetup(auth.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { companyId } = (await request.json()) as { companyId: string };
  if (!companyId) {
    return NextResponse.json({ error: "companyId required" }, { status: 400 });
  }

  try {
    await requireCompanyAccess(auth.user, companyId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await disconnectIntegration(companyId, "google_drive");
  return NextResponse.json({ success: true });
}
