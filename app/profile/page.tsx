import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import ProfileDashboard from "@/app/components/profile/ProfileDashboard";

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
    <main className="relative min-h-screen bg-[#08111c] text-white mt-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(0,229,255,0.08),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(34,255,136,0.08),transparent_32%),linear-gradient(140deg,#0b1725_10%,#0c1b2f_40%,#0a1321_100%)]" />
      <div className="relative mx-auto max-w-7xl px-6 py-10">
        <ProfileDashboard
          user={{
            id: user.id,
            name: user.name ?? "Unknown user",
            email: user.email ?? "",
            role: user.role ?? "user",
            image: user.image ?? null,
          }}
        />
      </div>
    </main>
  );
}
