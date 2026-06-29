import { auth } from "@/auth";
import { isAuthConfigured } from "@/lib/config";
import { NextResponse } from "next/server";

export default auth((req) => {
  if (!isAuthConfigured()) {
    return NextResponse.next();
  }

  const isLoggedIn = Boolean(req.auth?.user?.id);
  const { pathname } = req.nextUrl;
  const isAuthRoute =
    pathname.startsWith("/login") || pathname.startsWith("/signup");
  const isPublicRoute =
    isAuthRoute ||
    pathname.startsWith("/api/auth");

  if (!isLoggedIn && !isPublicRoute) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && isAuthRoute) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
