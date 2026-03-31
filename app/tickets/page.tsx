import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { PageShell } from "@/app/components/ui/page-shell";
import { TicketsHubWorkspace } from "@/app/components/tickets/TicketsHubWorkspace";

export const dynamic = "force-dynamic";

export default async function TicketsPage() {
  const { data } = await auth.getSession();
  const rawUser = (data?.user ?? null) as { id?: string } | null;

  if (!rawUser?.id) {
    redirect("/auth/sign-in?redirect=%2Ftickets");
  }

  return (
    <PageShell containerClassName="mx-auto max-w-[1380px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <TicketsHubWorkspace />
    </PageShell>
  );
}
