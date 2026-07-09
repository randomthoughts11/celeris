import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { canAccessCompany } from "@/lib/auth/access";
import { disconnectIntegration } from "@/lib/db/integrations";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId } = (await request.json()) as { companyId: string };
  if (!companyId) {
    return NextResponse.json({ error: "companyId required" }, { status: 400 });
  }

  const allowed = await canAccessCompany(user, companyId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await disconnectIntegration(companyId, "google_drive");
  return NextResponse.json({ success: true });
}
