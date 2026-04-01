/**
 * Middleware -- protects authenticated page routes; redirects unauthenticated users to sign-in.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createNeonAuth } from "@neondatabase/auth/next/server";
import { getRequiredEnv, isE2EAuthBypassEnabled } from "@/lib/env";
import { AUTH_PROTECTED_MATCHER, isAuthProtectedPath } from "@/lib/auth/protected-routes";

const auth = createNeonAuth({
  baseUrl: getRequiredEnv("NEON_AUTH_BASE_URL"),
  cookies: {
    secret: getRequiredEnv("NEON_AUTH_COOKIE_SECRET"),
  },
});

const authMiddleware = auth.middleware({
  // Redirect unauthenticated users to sign-in page
  loginUrl: "/auth/sign-in",
});

export default async function middleware(request: NextRequest) {
  if (
    isE2EAuthBypassEnabled() &&
    isAuthProtectedPath(request.nextUrl.pathname) &&
    request.cookies.has("meda_e2e_user")
  ) {
    return NextResponse.next();
  }

  const response = await authMiddleware(request);
  const location = response.headers.get("location");
  if (!location) {
    return response;
  }

  const redirectUrl = new URL(location, request.url);
  if (redirectUrl.pathname !== "/auth/sign-in" || redirectUrl.searchParams.has("redirect")) {
    return response;
  }

  redirectUrl.searchParams.set("redirect", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  response.headers.set("location", redirectUrl.toString());

  return response;
}

export const config = {
  matcher: AUTH_PROTECTED_MATCHER,
};
