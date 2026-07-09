import { NextResponse } from "next/server";
import { getGoogleAgencyAuthUrl } from "@/lib/integrations/google-agency";
import { requireAuth } from "@/lib/auth/session";
import { canManageCompanies } from "@/lib/auth/access";

export async function GET() {
  const user = await requireAuth();
  if (!canManageCompanies(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.redirect(getGoogleAgencyAuthUrl());
}
