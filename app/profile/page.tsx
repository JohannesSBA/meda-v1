/**
 * Profile page -- user dashboard with registered events, saved events, and admin tabs.
 *
 * Requires auth; redirects unauthenticated users.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import ProfileDashboard from "@/app/components/profile/ProfileDashboard";
import { buildSignInRedirect } from "@/lib/auth/protected-routes";
import { PageShell } from "@/app/components/ui/page-shell";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { data } = await auth.getSession();
  const user = (data?.user ?? null) as {
    id: string;
    name?: string | null;
    email?: string | null;
    role?: string | null;
    image?: string | null;
  } | null;
  if (!user) redirect(buildSignInRedirect("/profile"));

  return (
    <PageShell containerClassName="mx-auto max-w-7xl">
      <ProfileDashboard
        user={{
          id: user.id,
          name: user.name ?? "Unknown user",
          email: user.email ?? "",
          role: user.role ?? "user",
          image: user.image ?? null,
        }}
      />
    </PageShell>
  );
}
