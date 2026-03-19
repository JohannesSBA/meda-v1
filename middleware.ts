/**
 * Middleware -- protects authenticated page routes; redirects unauthenticated users to sign-in.
 */

import { createNeonAuth } from "@neondatabase/auth/next/server";
import { getRequiredEnv } from "@/lib/env";

const auth = createNeonAuth({
  baseUrl: getRequiredEnv("NEON_AUTH_BASE_URL"),
  cookies: {
    secret: getRequiredEnv("NEON_AUTH_COOKIE_SECRET"),
  },
});

export default auth.middleware({
  // Redirect unauthenticated users to sign-in page
  loginUrl: "/auth/sign-in",
});

export const config = {
  matcher: [
    "/account/:path*",
    "/profile",
    "/profile/:path*",
    "/create-events",
    "/create-events/:path*",
    "/admin",
    "/admin/:path*",
  ],
};
