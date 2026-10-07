import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  isClerkConfigured,
  isDatabaseConfigured,
  isDemoMode,
} from "@/lib/config";
import { canViewCallAudit, clientMayOpen, isClient } from "@/lib/call-audit/access";

const isPublicRoute = createRouteMatcher([
  "/login(.*)",
  "/signup(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/pending-approval(.*)",
  "/setup(.*)",
  "/api/webhooks/(.*)",
  "/api/integrations/privyr/import(.*)",
  "/d/(.*)",
  "/api/drops/(.*)",
  "/api/cron/(.*)",
]);

const isApprovalExempt = createRouteMatcher([
  "/pending-approval(.*)",
  "/setup(.*)",
  "/api/webhooks/(.*)",
  "/api/integrations/privyr/import(.*)",
  "/d/(.*)",
  "/api/cron/(.*)",
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
      SELECT p.approval_status, p.email,
        COALESCE(array_agg(DISTINCT r.role::text) FILTER (WHERE r.role IS NOT NULL), '{}'::text[]) AS roles,
        COALESCE(array_agg(DISTINCT c.slug) FILTER (WHERE c.slug IS NOT NULL), '{}'::text[]) AS brands
      FROM profiles p
      LEFT JOIN user_roles r ON r.user_id = p.id
      LEFT JOIN company_members cm ON cm.user_id = p.id
      LEFT JOIN companies c ON c.id = cm.company_id
      WHERE p.clerk_user_id = ${userId} AND p.is_active = true
      GROUP BY p.id
      LIMIT 1
    `;
    const status = rows[0]?.approval_status as string | undefined;
    const path = request.nextUrl.pathname;
    const brands = (rows[0]?.brands ?? []) as string[];

    if (status === "approved" && isClient({ roles: rows[0].roles as string[] }) && !clientMayOpen(path, brands)) {
      const home = canViewCallAudit({ email: rows[0].email as string }) || !brands[0] ? "/call-audit" : `/companies/${brands[0]}/meta-ads`;
      return NextResponse.redirect(new URL(home, request.url));
    }

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
