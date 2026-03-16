/**
 * Middleware -- protects /account/* routes; redirects unauthenticated users to sign-in.
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
  // Redirects unauthenticated users to sign-in page
  loginUrl: "/auth/sign-in",
});

export const config = {
  matcher: [
    // Protected routes requiring authentication
    "/account/:path*",
  ],
};
