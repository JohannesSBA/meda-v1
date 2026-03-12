/**
 * Create events page -- form for creating new events with CreateEventForm.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import CreateEventForm from "../components/CreateEventForm";
import { PageShell } from "../components/ui/page-shell";
import { PageIntro, Section, Stack } from "../components/ui/primitives";
import { Category } from "../types/catagory";
import { getCategories } from "@/lib/data/categories";

export const dynamic = "force-dynamic";

export default async function CreateEventsPage() {
  const { data } = await auth.getSession();
  const user = (data?.user as { id?: string } | null) ?? null;
  if (!user?.id) {
    redirect("/auth/sign-in?redirect=%2Fcreate-events");
  }

  const categories = (await getCategories()) as Category[];

  return (
    <PageShell containerClassName="mx-auto max-w-7xl">
      <Stack gap="xl">
        <Section size="md" className="pb-0">
          <PageIntro
            kicker="Host on Meda"
            title={<>Create a match with calmer structure and clearer commitment.</>}
            description="Set the pitch details, time, location, pricing, and capacity once. The interface now gives the form better hierarchy, better preview separation, and cleaner mobile spacing."
          />
        </Section>

        <Section size="sm" className="pt-0">
          <CreateEventForm categories={categories} />
        </Section>
      </Stack>
    </PageShell>
  );
}
