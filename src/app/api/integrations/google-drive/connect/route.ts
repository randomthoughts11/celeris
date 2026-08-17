import { NextResponse } from "next/server";
import { canManageBrandSetup, requireCompanyAccess } from "@/lib/auth/access";
import { requireAuth } from "@/lib/auth/session";
import { isDatabaseConfigured } from "@/lib/config";
import { getAuthUrl, isGoogleDriveConfigured } from "@/lib/google-drive/service";

export async function GET(request: Request) {
  if (!isDatabaseConfigured() || !isGoogleDriveConfigured()) {
    return NextResponse.json(
      { error: "Google Drive integration not configured" },
      { status: 503 }
    );
  }

  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageBrandSetup(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId required" }, { status: 400 });
  }

  try {
    await requireCompanyAccess(user, companyId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = getAuthUrl(companyId, user.id);
  return NextResponse.redirect(url);
}
