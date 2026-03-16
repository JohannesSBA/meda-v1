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

const originalGetSession =
  neonAuth.getSession.bind(neonAuth) as typeof neonAuth.getSession;

type BaseSessionUser = {
  id: string;
  role?: string | null;
  authRole?: string | null;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  parentPitchOwnerUserId?: string | null;
};

function normalizeSessionUser(user: BaseSessionUser) {
  const authRole = user.authRole ?? user.role ?? null;

  return {
    ...user,
    role: user.role ?? "user",
    authRole,
    parentPitchOwnerUserId: user.parentPitchOwnerUserId ?? null,
  };
}

function isEdgeRuntime() {
  return typeof (globalThis as { EdgeRuntime?: string }).EdgeRuntime !== "undefined";
}

async function getEnrichedSessionUser(user: BaseSessionUser) {
  if (isEdgeRuntime()) {
    return normalizeSessionUser(user);
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
            user: normalizeSessionUser(bypassUser),
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
        email?: string | null;
        name?: string | null;
        image?: string | null;
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
