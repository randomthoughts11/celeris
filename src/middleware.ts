import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  isClerkConfigured,
  isDatabaseConfigured,
  isDemoMode,
} from "@/lib/config";

const isPublicRoute = createRouteMatcher([
  "/login(.*)",
  "/signup(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/pending-approval(.*)",
  "/setup(.*)",
  "/api/webhooks/(.*)",
  "/api/integrations/privyr/import(.*)",
]);

const isApprovalExempt = createRouteMatcher([
  "/pending-approval(.*)",
  "/setup(.*)",
  "/api/webhooks/(.*)",
  "/api/integrations/privyr/import(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  const demo = isDemoMode() && isDatabaseConfigured() && !isClerkConfigured();

  if (!isDatabaseConfigured() && !isPublicRoute(request)) {
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  if (!isClerkConfigured()) {
    if (demo || isPublicRoute(request)) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  if (!isPublicRoute(request)) {
    await auth.protect();
  }

  const { userId } = await auth();
  if (!userId || isApprovalExempt(request)) {
    return NextResponse.next();
  }

  try {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql`
      SELECT approval_status FROM profiles
      WHERE clerk_user_id = ${userId} AND is_active = true
      LIMIT 1
    `;
    const status = rows[0]?.approval_status as string | undefined;

    if (status === "pending" && !request.nextUrl.pathname.startsWith("/pending-approval")) {
      return NextResponse.redirect(new URL("/pending-approval", request.url));
    }
    if (status === "rejected" && !request.nextUrl.pathname.startsWith("/pending-approval")) {
      return NextResponse.redirect(new URL("/pending-approval?rejected=1", request.url));
    }
  } catch {
    return NextResponse.redirect(
      new URL("/login?error=session_check", request.url)
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
