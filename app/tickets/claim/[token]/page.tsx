import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { PageShell } from "@/app/components/ui/page-shell";
import TicketClaimPanel from "@/app/components/tickets/TicketClaimPanel";

export const dynamic = "force-dynamic";

export default async function TicketClaimPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { data } = await auth.getSession();
  const user = data?.user ?? null;

  if (!user) {
    redirect(`/auth/sign-in?redirect=${encodeURIComponent(`/tickets/claim/${token}`)}`);
  }

  return (
    <PageShell containerClassName="relative mx-auto max-w-3xl px-6 py-10">
      <TicketClaimPanel token={token} />
    </PageShell>
  );
}
