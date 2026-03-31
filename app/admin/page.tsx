import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { normalizeAppUserRole } from "@/lib/auth/roles";
import { PageShell } from "@/app/components/ui/page-shell";
import AdminDashboard from "@/app/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { data } = await auth.getSession();
  const user = (data?.user ?? null) as
    | {
        id?: string;
        name?: string | null;
        email?: string | null;
        role?: string | null;
        image?: string | null;
      }
    | null;

  if (!user?.id) {
    redirect("/auth/sign-in?redirect=%2Fadmin");
  }

  if (normalizeAppUserRole(user.role) !== "admin") {
    redirect("/profile");
  }

  return (
    <PageShell containerClassName="mx-auto max-w-[1380px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <AdminDashboard
        user={{
          id: user.id,
          name: user.name ?? "Admin",
          email: user.email ?? "",
          role: user.role ?? "admin",
          image: user.image ?? null,
        }}
      />
    </PageShell>
  );
}
