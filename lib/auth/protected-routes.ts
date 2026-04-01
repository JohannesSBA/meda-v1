export const AUTH_PROTECTED_EXACT_PATHS = ["/profile", "/create-events", "/admin"] as const;

export const AUTH_PROTECTED_PREFIXES = [
  "/account/",
  "/profile/",
  "/create-events/",
  "/admin/",
] as const;

export const AUTH_PROTECTED_MATCHER = [
  "/account/:path*",
  "/profile",
  "/profile/:path*",
  "/create-events",
  "/create-events/:path*",
  "/admin",
  "/admin/:path*",
] as const;

export function isAuthProtectedPath(pathname: string) {
  return (
    AUTH_PROTECTED_EXACT_PATHS.includes(pathname as (typeof AUTH_PROTECTED_EXACT_PATHS)[number]) ||
    AUTH_PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

export function buildSignInRedirect(path: string) {
  return `/auth/sign-in?redirect=${encodeURIComponent(path)}`;
}
