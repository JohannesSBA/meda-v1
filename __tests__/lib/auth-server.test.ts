import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  cookiesMock,
  createNeonAuthMock,
  facilitatorFindUniqueMock,
  getRequiredEnvMock,
  isE2EAuthBypassEnabledMock,
  parseE2EUserCookieMock,
  pitchOwnerProfileFindUniqueMock,
} = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  createNeonAuthMock: vi.fn(),
  facilitatorFindUniqueMock: vi.fn(),
  getRequiredEnvMock: vi.fn(),
  isE2EAuthBypassEnabledMock: vi.fn(),
  parseE2EUserCookieMock: vi.fn(),
  pitchOwnerProfileFindUniqueMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@neondatabase/auth/next/server", () => ({
  createNeonAuth: createNeonAuthMock,
}));

vi.mock("@/lib/env", () => ({
  getRequiredEnv: getRequiredEnvMock,
  isE2EAuthBypassEnabled: isE2EAuthBypassEnabledMock,
  parseE2EUserCookie: parseE2EUserCookieMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pitchOwnerProfile: {
      findUnique: pitchOwnerProfileFindUniqueMock,
    },
    facilitator: {
      findUnique: facilitatorFindUniqueMock,
    },
  },
}));

function createProxyAuth() {
  const adminApi = {
    listUsers: vi.fn(),
  };
  const originalGetSession = vi.fn().mockResolvedValue({
    data: {
      user: { id: "session-user" },
    },
  });
  const target = {
    getSession: originalGetSession,
  };
  const auth = new Proxy(target, {
    get(currentTarget, prop, receiver) {
      if (prop === "admin") return adminApi;
      return Reflect.get(currentTarget, prop, receiver);
    },
    set(currentTarget, prop, value, receiver) {
      return Reflect.set(currentTarget, prop, value, receiver);
    },
  });

  return { adminApi, auth, originalGetSession };
}

describe("auth server wrapper", () => {
  beforeEach(() => {
    vi.resetModules();
    cookiesMock.mockReset();
    createNeonAuthMock.mockReset();
    facilitatorFindUniqueMock.mockReset();
    getRequiredEnvMock.mockReset();
    isE2EAuthBypassEnabledMock.mockReset();
    parseE2EUserCookieMock.mockReset();
    pitchOwnerProfileFindUniqueMock.mockReset();

    getRequiredEnvMock.mockImplementation((name: string) => {
      if (name === "NEON_AUTH_BASE_URL") return "https://auth.example.com";
      if (name === "NEON_AUTH_COOKIE_SECRET") return "x".repeat(32);
      throw new Error(`Unexpected env lookup: ${name}`);
    });
    isE2EAuthBypassEnabledMock.mockReturnValue(false);
    cookiesMock.mockResolvedValue({ get: vi.fn() });
    pitchOwnerProfileFindUniqueMock.mockResolvedValue(null);
    facilitatorFindUniqueMock.mockResolvedValue(null);
  });

  it("preserves proxy-backed admin methods when overriding getSession", async () => {
    const proxyAuth = createProxyAuth();
    createNeonAuthMock.mockReturnValue(proxyAuth.auth);

    const { auth } = await import("@/lib/auth/server");

    expect(auth.admin).toBe(proxyAuth.adminApi);

    const result = await auth.getSession({
      query: { disableCookieCache: "true" },
    });

    expect(proxyAuth.originalGetSession).toHaveBeenCalledWith({
      query: { disableCookieCache: "true" },
    });
    expect(result).toEqual({
      data: {
        user: {
          id: "session-user",
          role: "user",
          authRole: null,
          parentPitchOwnerUserId: null,
        },
      },
    });
  });
});
