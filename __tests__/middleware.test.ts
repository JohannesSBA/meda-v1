import { beforeEach, describe, expect, it, vi } from "vitest";

const getRequiredEnvMock = vi.fn((name: string) => `value-for-${name}`);
const isE2EAuthBypassEnabledMock = vi.fn(() => false);
const authMiddlewareMock = vi.fn();
const createNeonAuthMock = vi.fn(() => ({
  middleware: vi.fn(() => authMiddlewareMock),
}));

vi.mock("@/lib/env", () => ({
  getRequiredEnv: getRequiredEnvMock,
  isE2EAuthBypassEnabled: isE2EAuthBypassEnabledMock,
}));

vi.mock("@neondatabase/auth/next/server", () => ({
  createNeonAuth: createNeonAuthMock,
}));

function makeRequest(path: string, options?: { search?: string; hasE2ECookie?: boolean }) {
  const search = options?.search ?? "";
  const url = `https://meda.test${path}${search}`;

  return {
    url,
    nextUrl: {
      pathname: path,
      search,
    },
    cookies: {
      has: vi.fn((name: string) => options?.hasE2ECookie === true && name === "meda_e2e_user"),
    },
  };
}

describe("middleware auth protection", () => {
  beforeEach(() => {
    vi.resetModules();
    authMiddlewareMock.mockReset();
    isE2EAuthBypassEnabledMock.mockReset();
    isE2EAuthBypassEnabledMock.mockReturnValue(false);
  });

  it("adds redirect query when auth middleware returns sign-in without redirect", async () => {
    const { NextResponse } = await import("next/server");
    authMiddlewareMock.mockResolvedValue(
      NextResponse.redirect("https://meda.test/auth/sign-in", 307),
    );

    const { default: middleware } = await import("@/middleware");
    const response = await middleware(makeRequest("/create-events") as never);

    const location = response.headers.get("location");
    expect(location).toContain("/auth/sign-in?redirect=%2Fcreate-events");
  });

  it("preserves existing redirect param from auth middleware", async () => {
    const { NextResponse } = await import("next/server");
    authMiddlewareMock.mockResolvedValue(
      NextResponse.redirect("https://meda.test/auth/sign-in?redirect=%2Fadmin", 307),
    );

    const { default: middleware } = await import("@/middleware");
    const response = await middleware(makeRequest("/admin") as never);

    expect(response.headers.get("location")).toBe(
      "https://meda.test/auth/sign-in?redirect=%2Fadmin",
    );
  });

  it("allows protected routes through during non-production E2E bypass with cookie", async () => {
    const { NextResponse } = await import("next/server");
    authMiddlewareMock.mockResolvedValue(
      NextResponse.redirect("https://meda.test/auth/sign-in", 307),
    );
    isE2EAuthBypassEnabledMock.mockReturnValue(true);

    const { default: middleware } = await import("@/middleware");
    const response = await middleware(makeRequest("/profile", { hasE2ECookie: true }) as never);

    expect(response.headers.get("location")).toBeNull();
    expect(authMiddlewareMock).not.toHaveBeenCalled();
  });

  it("applies E2E bypass to the host workbench route when protected", async () => {
    const { NextResponse } = await import("next/server");
    authMiddlewareMock.mockResolvedValue(
      NextResponse.redirect("https://meda.test/auth/sign-in", 307),
    );
    isE2EAuthBypassEnabledMock.mockReturnValue(true);

    const { default: middleware } = await import("@/middleware");
    const response = await middleware(makeRequest("/host", { hasE2ECookie: true }) as never);

    expect(response.headers.get("location")).toBeNull();
    expect(authMiddlewareMock).not.toHaveBeenCalled();
  });

  it("does not bypass unprotected routes even if cookie exists", async () => {
    const { NextResponse } = await import("next/server");
    const passthrough = NextResponse.next();
    authMiddlewareMock.mockResolvedValue(passthrough);
    isE2EAuthBypassEnabledMock.mockReturnValue(true);

    const { default: middleware } = await import("@/middleware");
    const response = await middleware(makeRequest("/play", { hasE2ECookie: true }) as never);

    expect(response).toBe(passthrough);
    expect(authMiddlewareMock).toHaveBeenCalledTimes(1);
  });
});
