import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import CreateEventForm from "@/app/components/CreateEventForm";
import { decodeEventLocation } from "@/app/helpers/locationCodec";
import { PageShell } from "@/app/components/ui/page-shell";
import type { Category } from "@/app/types/catagory";

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
  const normalizedCategories: Category[] = categories.map((category) => ({
    categoryId: category.categoryId,
    categoryName: category.categoryName,
    description: category.description ?? "",
  }));

  return (
    <PageShell containerClassName="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-10 sm:px-6 lg:px-8">
        <header className="max-w-3xl">
          <p className="heading-kicker text-sm tracking-[0.28em]">
            Admin event editor
          </p>
          <h1 className="mt-4 text-4xl font-bold sm:text-5xl">
            Edit event details
          </h1>
          <p className="muted-copy mt-3 text-base">
            Update name, schedule, location, pricing, capacity, and image using the
            same form as event creation.
          </p>
        </header>
        <CreateEventForm
          categories={normalizedCategories}
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
    </PageShell>
  );
}
