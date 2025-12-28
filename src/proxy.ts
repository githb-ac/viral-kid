import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(req: NextRequest) {
  // Check for session token cookie (set by NextAuth)
  const sessionToken =
    req.cookies.get("authjs.session-token")?.value ||
    req.cookies.get("__Secure-authjs.session-token")?.value;
  const isLoggedIn = !!sessionToken;
  const isLoginPage = req.nextUrl.pathname === "/login";
  const isSignupPage = req.nextUrl.pathname === "/signup";
  const isApiRoute = req.nextUrl.pathname.startsWith("/api");

  // Allow all API routes (they handle auth themselves)
  if (isApiRoute) {
    return NextResponse.next();
  }

  // Redirect to login if not authenticated (except login and signup pages)
  if (!isLoggedIn && !isLoginPage && !isSignupPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Redirect to home if already logged in and trying to access login
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
