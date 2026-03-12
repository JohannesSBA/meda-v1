/**
 * Auth server -- Neon Auth server instance for session and protected routes.
 */

import { cookies } from "next/headers";
import { createNeonAuth } from "@neondatabase/auth/next/server";
import {
  getRequiredEnv,
  isE2EAuthBypassEnabled,
  parseE2EUserCookie,
} from "@/lib/env";

const neonAuth = createNeonAuth({
  baseUrl: getRequiredEnv("NEON_AUTH_BASE_URL"),
  cookies: {
    secret: getRequiredEnv("NEON_AUTH_COOKIE_SECRET"),
  },
});

export const auth = {
  ...neonAuth,
  async getSession() {
    if (isE2EAuthBypassEnabled()) {
      const cookieStore = await cookies();
      const bypassUser = parseE2EUserCookie(
        cookieStore.get("meda_e2e_user")?.value,
      );
      if (bypassUser) {
        return {
          data: {
            user: bypassUser,
          },
        };
      }
    }

    return neonAuth.getSession();
  },
} as typeof neonAuth;
