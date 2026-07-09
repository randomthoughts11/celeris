import { NextResponse } from "next/server";
import { getMetaAgencyAuthUrl } from "@/lib/integrations/meta-agency";
import { requireAuth } from "@/lib/auth/session";
import { canManageCompanies } from "@/lib/auth/access";

export async function GET() {
  const user = await requireAuth();
  if (!canManageCompanies(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.redirect(getMetaAgencyAuthUrl());
}
