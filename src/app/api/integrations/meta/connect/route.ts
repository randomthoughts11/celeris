import { NextResponse } from "next/server";
import { getMetaAgencyAuthUrl } from "@/lib/integrations/meta-agency";
import { requireApprovedApiUser } from "@/lib/auth/api";
import { canManageCompanies } from "@/lib/auth/access";

export async function GET() {
  const auth = await requireApprovedApiUser();
  if (auth.error) return auth.error;
  if (!canManageCompanies(auth.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.redirect(getMetaAgencyAuthUrl(auth.user.id));
}
