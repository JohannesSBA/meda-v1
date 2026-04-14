import {
  AUTH_PROTECTED_EXACT_PATHS,
  AUTH_PROTECTED_MATCHER,
  AUTH_PROTECTED_PREFIXES,
  buildSignInRedirect,
  isAuthProtectedPath,
} from "@/lib/auth/protected-routes";

describe("auth protected route matrix", () => {
  it("keeps exact and prefix coverage aligned with middleware matcher", () => {
    expect(AUTH_PROTECTED_EXACT_PATHS).toEqual([
      "/profile",
      "/create-events",
      "/admin",
      "/host",
    ]);
    expect(AUTH_PROTECTED_PREFIXES).toEqual([
      "/account/",
      "/profile/",
      "/create-events/",
      "/admin/",
      "/play/slots/",
    ]);
    expect(AUTH_PROTECTED_MATCHER).toEqual([
      "/account/:path*",
      "/profile",
      "/profile/:path*",
      "/create-events",
      "/create-events/:path*",
      "/admin",
      "/admin/:path*",
      "/host",
      "/play/slots/:path*",
    ]);
  });

  it("recognizes protected and unprotected paths", () => {
    expect(isAuthProtectedPath("/profile")).toBe(true);
    expect(isAuthProtectedPath("/create-events/setup")).toBe(true);
    expect(isAuthProtectedPath("/admin/events/123/edit")).toBe(true);
    expect(isAuthProtectedPath("/account/settings")).toBe(true);

    expect(isAuthProtectedPath("/host")).toBe(true);
    expect(isAuthProtectedPath("/play/slots/550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isAuthProtectedPath("/play")).toBe(false);
  });

  it("builds encoded sign-in redirects", () => {
    expect(buildSignInRedirect("/profile")).toBe("/auth/sign-in?redirect=%2Fprofile");
    expect(buildSignInRedirect("/admin/events/abc/edit?tab=details")).toBe(
      "/auth/sign-in?redirect=%2Fadmin%2Fevents%2Fabc%2Fedit%3Ftab%3Ddetails",
    );
  });
});
