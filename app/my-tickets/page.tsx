/**
 * My tickets page -- lists events where the user currently holds tickets.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { PageShell } from "@/app/components/ui/page-shell";
import MyEventsPanel from "@/app/components/profile/MyEventsPanel";

export const dynamic = "force-dynamic";

export default async function MyTicketsPage() {
  const { data } = await auth.getSession();
  const user = data?.user ?? null;
  if (!user) redirect("/auth/sign-in");

  return (
    <PageShell containerClassName="relative mx-auto max-w-5xl px-6 py-10">
      <MyEventsPanel />
    </PageShell>
  );
}
