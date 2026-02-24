import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import CreateEventForm from "@/app/components/CreateEventForm";
import { decodeEventLocation } from "@/app/helpers/locationCodec";

export const dynamic = "force-dynamic";

export default async function AdminEditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { data } = await auth.getSession();
  const user = (data?.user ?? null) as { role?: string | null } | null;
  if (!user) redirect("/auth/sign-in");
  if (user.role !== "admin") redirect("/profile");

  const { id } = await params;
  const [event, categories] = await Promise.all([
    prisma.event.findUnique({ where: { eventId: id } }),
    prisma.category.findMany(),
  ]);
  if (!event) return notFound();
  const seriesCount =
    event.seriesId != null
      ? await prisma.event.count({ where: { seriesId: event.seriesId } })
      : 1;

  const decoded = decodeEventLocation(event.eventLocation);

  return (
    <main className="relative min-h-screen overflow-hidden mt-16 bg-[#061224] px-4 py-20 sm:px-6 lg:px-16 text-white">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(90%_70%_at_50%_-10%,#00E5FF18,transparent_70%),radial-gradient(80%_80%_at_85%_40%,#22FF8825,transparent_60%)] blur-3xl" />
      <div className="mx-auto flex max-w-6xl flex-col gap-12">
        <header className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#89e7ff]">
            Admin event editor
          </p>
          <h1 className="mt-4 text-4xl font-bold sm:text-5xl">
            Edit event details
          </h1>
          <p className="mt-3 text-base text-[#b9cde4]">
            Update name, schedule, location, pricing, capacity, and image using the
            same form as event creation.
          </p>
        </header>
        <CreateEventForm
          categories={categories}
          mode="edit"
          initialEvent={{
            eventId: event.eventId,
            eventName: event.eventName,
            categoryId: event.categoryId,
            description: event.description,
            pictureUrl: event.pictureUrl,
            eventDatetime: event.eventDatetime.toISOString(),
            eventEndtime: event.eventEndtime.toISOString(),
            addressLabel: decoded.addressLabel,
            latitude: decoded.latitude,
            longitude: decoded.longitude,
            capacity: event.capacity,
            priceField: event.priceField,
            isRecurring: event.isRecurring,
            recurrenceKind: event.recurrenceKind,
            recurrenceInterval: event.recurrenceInterval,
            recurrenceUntil: event.recurrenceUntil?.toISOString() ?? null,
            recurrenceWeekdays: event.recurrenceWeekdays,
            seriesId: event.seriesId,
            seriesCount,
          }}
        />
      </div>
    </main>
  );
}
