import { NextResponse } from "next/server";
import { exchangeGoogleAgencyCode } from "@/lib/integrations/google-agency";
import { requireAuth } from "@/lib/auth/session";
import { canManageCompanies } from "@/lib/auth/access";

export async function GET(request: Request) {
  const user = await requireAuth().catch(() => null);
  if (!user || !canManageCompanies(user)) {
    return NextResponse.redirect(new URL("/settings?error=forbidden", request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const origin = new URL(request.url).origin;

  if (error) {
    return NextResponse.redirect(
      `${origin}/settings?google_error=${encodeURIComponent(error)}`
    );
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/settings?google_error=missing_code`);
  }

  try {
    await exchangeGoogleAgencyCode(code);
    return NextResponse.redirect(`${origin}/settings?google_connected=1`);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Connection failed";
    return NextResponse.redirect(
      `${origin}/settings?google_error=${encodeURIComponent(message)}`
    );
  }
}
