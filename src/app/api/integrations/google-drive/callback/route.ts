import { NextResponse } from "next/server";
import { exchangeCodeAndStore } from "@/lib/google-drive/service";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${origin}/settings?drive_error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/settings?drive_error=missing_params`);
  }

  try {
    const { companyId } = JSON.parse(
      Buffer.from(state, "base64url").toString("utf8")
    ) as { companyId: string };

    await exchangeCodeAndStore(code, companyId);

    const { getSql } = await import("@/lib/db/client");
    const sql = getSql();
    const rows = await sql`
      SELECT slug FROM companies WHERE id = ${companyId} LIMIT 1
    `;
    const slug = rows[0]?.slug as string | undefined;

    const redirect = slug
      ? `${origin}/companies/${slug}/drive?connected=1`
      : `${origin}/settings?connected=1`;

    return NextResponse.redirect(redirect);
  } catch (err) {
    const message = err instanceof Error ? err.message : "connection_failed";
    return NextResponse.redirect(
      `${origin}/settings?drive_error=${encodeURIComponent(message)}`
    );
  }
}
