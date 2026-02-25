import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import ProfileDashboard from "@/app/components/profile/ProfileDashboard";
import { PageShell } from "@/app/components/ui/page-shell";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { data } = await auth.getSession();
  const user = (data?.user ?? null) as
    | {
        id: string;
        name?: string | null;
        email?: string | null;
        role?: string | null;
        image?: string | null;
      }
    | null;
  if (!user) redirect("/auth/sign-in");

  return (
    <PageShell containerClassName="relative mx-auto max-w-7xl px-6 py-10">
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
