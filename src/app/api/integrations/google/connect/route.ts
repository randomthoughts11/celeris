import { NextResponse } from "next/server";
import { getGoogleAgencyAuthUrl } from "@/lib/integrations/google-agency";
import { requireApprovedApiUser } from "@/lib/auth/api";
import { canManageCompanies } from "@/lib/auth/access";

export async function GET() {
  const auth = await requireApprovedApiUser();
  if (auth.error) return auth.error;
  if (!canManageCompanies(auth.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.redirect(getGoogleAgencyAuthUrl(auth.user.id));
}
