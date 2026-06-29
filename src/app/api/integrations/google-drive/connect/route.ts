import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isDatabaseConfigured } from "@/lib/config";
import { getAuthUrl, isGoogleDriveConfigured } from "@/lib/google-drive/service";

export async function GET(request: Request) {
  if (!isDatabaseConfigured() || !isGoogleDriveConfigured()) {
    return NextResponse.json(
      { error: "Google Drive integration not configured" },
      { status: 503 }
    );
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId required" }, { status: 400 });
  }

  const url = getAuthUrl(companyId);
  return NextResponse.redirect(url);
}
