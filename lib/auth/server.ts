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
import {
  normalizeSessionUserContract,
  type SessionUser,
} from "@/lib/auth/session-contract";

// `createNeonAuth` only accepts `baseUrl` + `cookies` in @neondatabase/auth; native
// redirect origins belong in Neon Auth / Better Auth server settings, not here.

const neonAuth = createNeonAuth({
  baseUrl: getRequiredEnv("NEON_AUTH_BASE_URL"),
  cookies: {
    secret: getRequiredEnv("NEON_AUTH_COOKIE_SECRET"),
  },
});

const originalGetSession =
  neonAuth.getSession.bind(neonAuth) as typeof neonAuth.getSession;

function isEdgeRuntime() {
  return typeof (globalThis as { EdgeRuntime?: string }).EdgeRuntime !== "undefined";
}

async function getEnrichedSessionUser(user: SessionUser) {
  if (isEdgeRuntime()) {
    return normalizeSessionUserContract(user);
  }

  const { enrichSessionUser } = await import("@/lib/auth/roles");
  return enrichSessionUser(user);
}

neonAuth.getSession = (async (
  ...args: Parameters<typeof neonAuth.getSession>
) => {
    if (isE2EAuthBypassEnabled()) {
      const cookieStore = await cookies();
      const bypassUser = parseE2EUserCookie(
        cookieStore.get("meda_e2e_user")?.value,
      );
      if (bypassUser) {
        return {
          data: {
            user: normalizeSessionUserContract(bypassUser),
          },
        };
      }
    }

    const session = await originalGetSession(...args);
    if (!session.data?.user) {
      return session;
    }

    const enrichedUser = await getEnrichedSessionUser(
      session.data.user as {
        id: string;
        role?: string | null;
        authRole?: string | null;
        email?: string | null;
        name?: string | null;
        image?: string | null;
        parentPitchOwnerUserId?: string | null;
      },
    );

    return {
      ...session,
      data: {
        ...session.data,
        user: enrichedUser,
      },
    };
  }) as typeof neonAuth.getSession;

export const auth = neonAuth;
