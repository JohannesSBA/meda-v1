import CreateEventForm from "../components/CreateEventForm";
import { Category } from "../types/catagory";

export default async function CreateEventsPage() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/categories/get`, {
    // Ensure fresh data when rendered on the server.
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch categories");
  }

  const { categories } = (await res.json()) as { categories: Category[] };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#061224] px-4 py-20 sm:px-6 lg:px-16 text-white">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(90%_70%_at_50%_-10%,#00E5FF18,transparent_70%),radial-gradient(80%_80%_at_85%_40%,#22FF8825,transparent_60%)] blur-3xl" />
      <div className="mx-auto flex max-w-6xl flex-col gap-12">
        <header className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#89e7ff]">
            Host a match on MEDA
          </p>
          <h1 className="mt-4 text-4xl font-bold sm:text-5xl">
            Create a match and open player slots
          </h1>
          <p className="mt-3 text-base text-[#b9cde4]">
            Drop the pitch details, time, and format. Share the link and let
            players pay their share—no more fronting the whole pitch fee.
          </p>
        </header>
        <CreateEventForm categories={categories} />
      </div>
    </main>
  );
}
