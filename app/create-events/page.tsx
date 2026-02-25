import CreateEventForm from "../components/CreateEventForm";
import { PageShell } from "../components/ui/page-shell";
import { Category } from "../types/catagory";

export default async function CreateEventsPage() {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/categories/get`,
    {
      // Ensure fresh data when rendered on the server.
      cache: "no-store",
    },
  );

  if (!res.ok) {
    throw new Error("Failed to fetch categories");
  }

  const { categories } = (await res.json()) as { categories: Category[] };

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
