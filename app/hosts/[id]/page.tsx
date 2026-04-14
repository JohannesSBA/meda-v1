/**
 * Host profile page -- displays events hosted by a specific user.
 */

import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { EventCard } from "@/app/components/EventCard";
import { PageShell } from "@/app/components/ui/page-shell";
import { Card } from "@/app/components/ui/card";
import { buttonVariants } from "@/app/components/ui/button";
import { getActiveReservationCountMap } from "@/lib/events/availability";
import { serializePublicEvent } from "@/lib/events/serializers";
import {
  getAuthUserPublicProfiles,
  publicHostDisplayName,
} from "@/lib/auth/userLookup";
import { prisma } from "@/lib/prisma";

async function getHostEvents(userId: string) {
  const now = new Date();
  const [upcoming, past] = await Promise.all([
    prisma.event.findMany({
      where: { userId, eventEndtime: { gte: now } },
      orderBy: { eventDatetime: "asc" },
      include: {
        category: true,
        _count: { select: { attendees: true } },
      },
    }),
    prisma.event.findMany({
      where: { userId, eventEndtime: { lt: now } },
      orderBy: { eventDatetime: "desc" },
      take: 12,
      include: {
        category: true,
        _count: { select: { attendees: true } },
      },
    }),
  ]);

  return { upcoming, past };
}

export default async function HostProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: userId } = await params;
  if (!userId || !/^[0-9a-fA-F-]{36}$/.test(userId)) return notFound();

  const eventCount = await prisma.event.count({ where: { userId } });
  if (eventCount === 0) return notFound();

  const { upcoming, past } = await getHostEvents(userId);
  const reservationCounts = await getActiveReservationCountMap([
    ...upcoming.map((event) => event.eventId),
    ...past.map((event) => event.eventId),
  ]);

  const hostProfiles = await getAuthUserPublicProfiles([userId]);
  const hostProfile = hostProfiles.get(userId);
  const hostName = publicHostDisplayName(hostProfile);
  const hostAvatarSrc =
    hostProfile?.image ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(hostName)}&background=0F2235&color=22FF88&size=256`;

  const withHostFields = (serialized: ReturnType<typeof serializePublicEvent>) => ({
    ...serialized,
    hostDisplayName: hostName,
    hostImageUrl: hostProfile?.image ?? null,
  });

  const upcomingShaped = upcoming.map((event) =>
    withHostFields(
      serializePublicEvent(event, {
        attendeeCount: event._count.attendees,
        reservedCount: reservationCounts.get(event.eventId) ?? 0,
      }),
    ),
  );

  const pastShaped = past.map((event) =>
    withHostFields(
      serializePublicEvent(event, {
        attendeeCount: event._count.attendees,
        reservedCount: reservationCounts.get(event.eventId) ?? 0,
      }),
    ),
  );

  return (
    <PageShell>
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <Card className="rounded-3xl bg-[#0d1a27]/80 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-[var(--color-border-strong)] bg-[#0f1f2d] sm:h-24 sm:w-24">
                <Image
                  src={hostAvatarSrc}
                  alt={`${hostName} profile photo`}
                  fill
                  className="object-cover"
                  sizes="96px"
                  priority
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm uppercase tracking-[0.18em] text-[var(--color-brand)]">
                  Host
                </p>
                <h1 className="mt-2 truncate text-2xl font-bold text-white sm:text-3xl">
                  {hostName}
                </h1>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {upcoming.length + past.length} event
                  {upcoming.length + past.length === 1 ? "" : "s"} total
                </p>
              </div>
            </div>
            <Link
              href={`/events?hostId=${userId}`}
              className={buttonVariants("primary", "sm")}
            >
              View all events
            </Link>
          </div>
        </Card>

        {upcomingShaped.length > 0 ? (
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white">
              Upcoming events ({upcomingShaped.length})
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {upcomingShaped.map((event) => (
                <EventCard
                  key={event.eventId}
                  event={event}
                  href={`/events/${event.eventId}`}
                />
              ))}
            </div>
          </section>
        ) : null}

        {pastShaped.length > 0 ? (
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white">
              Past events ({pastShaped.length})
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {pastShaped.map((event) => (
                <EventCard
                  key={event.eventId}
                  event={event}
                  href={`/events/${event.eventId}`}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </PageShell>
  );
}
