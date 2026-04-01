import {
  AUTH_PROTECTED_EXACT_PATHS,
  AUTH_PROTECTED_MATCHER,
  AUTH_PROTECTED_PREFIXES,
  buildSignInRedirect,
  isAuthProtectedPath,
} from "@/lib/auth/protected-routes";

describe("auth protected route matrix", () => {
  it("keeps exact and prefix coverage aligned with middleware matcher", () => {
    expect(AUTH_PROTECTED_EXACT_PATHS).toEqual(["/profile", "/create-events", "/admin"]);
    expect(AUTH_PROTECTED_PREFIXES).toEqual([
      "/account/",
      "/profile/",
      "/create-events/",
      "/admin/",
    ]);
    expect(AUTH_PROTECTED_MATCHER).toEqual([
      "/account/:path*",
      "/profile",
      "/profile/:path*",
      "/create-events",
      "/create-events/:path*",
      "/admin",
      "/admin/:path*",
    ]);
  });

  it("recognizes protected and unprotected paths", () => {
    expect(isAuthProtectedPath("/profile")).toBe(true);
    expect(isAuthProtectedPath("/create-events/setup")).toBe(true);
    expect(isAuthProtectedPath("/admin/events/123/edit")).toBe(true);
    expect(isAuthProtectedPath("/account/settings")).toBe(true);

    expect(isAuthProtectedPath("/host")).toBe(false);
    expect(isAuthProtectedPath("/play")).toBe(false);
  });

  it("builds encoded sign-in redirects", () => {
    expect(buildSignInRedirect("/profile")).toBe("/auth/sign-in?redirect=%2Fprofile");
    expect(buildSignInRedirect("/admin/events/abc/edit?tab=details")).toBe(
      "/auth/sign-in?redirect=%2Fadmin%2Fevents%2Fabc%2Fedit%3Ftab%3Ddetails",
    );
  });
});
