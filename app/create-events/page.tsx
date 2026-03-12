/**
 * Create events page -- form for creating new events with CreateEventForm.
 *
 * Fetches categories for the form.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import CreateEventForm from "../components/CreateEventForm";
import { PageShell } from "../components/ui/page-shell";
import { Category } from "../types/catagory";
import { getCategories } from "@/lib/data/categories";

export default async function CreateEventsPage() {
  const { data } = await auth.getSession();
  const user = (data?.user as { id?: string } | null) ?? null;
  if (!user?.id) {
    redirect("/auth/sign-in?redirect=%2Fcreate-events");
  }

  const categories = (await getCategories()) as Category[];

  return (
    <PageShell containerClassName="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-10 sm:px-6 lg:px-8">
      <header className="max-w-3xl">
        <p className="heading-kicker text-sm tracking-[0.28em]">
          Host a match on MEDA
        </p>
        <h1 className="mt-4 text-4xl font-bold sm:text-5xl text-white">
          Create a match and open player slots
        </h1>
        <p className="muted-copy mt-3 text-base">
          Drop the pitch details, time, and format. Share the link and let
          players pay their share—no more fronting the whole pitch fee.
        </p>
      </header>
      <CreateEventForm categories={categories} />
    </PageShell>
  );
}
