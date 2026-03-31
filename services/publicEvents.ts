import { unstable_cache } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { boundingBox } from "@/lib/location";
import { cacheTags } from "@/lib/cacheTags";
import { MAX_SERIES_OCCURRENCES } from "@/lib/constants";
import { getActiveReservationCountMap } from "@/lib/events/availability";
import {
  serializeOccurrence,
  serializePublicEvent,
} from "@/lib/events/serializers";
import { getUserEventTicketSummaryMap } from "@/services/ticketSummaries";
import type { EventListQueryInput } from "@/lib/validations/events";
import type {
  EventOccurrence,
  EventResponse,
} from "@/app/types/eventTypes";

export type EventDetailResponse = EventResponse & {
  occurrences?: EventOccurrence[];
};

type ListedEventRow = {
  eventId: string;
  eventName: string;
  eventDatetime: Date;
  eventEndtime: Date;
  eventLocation: string | null;
  addressLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  pictureUrl: string | null;
  capacityTotal: number | null;
  priceField: number | null;
  userId: string;
  categoryId: string;
  categoryName: string | null;
  seriesId: string | null;
  isRecurring: boolean;
  recurrenceKind: string | null;
  recurrenceInterval: number | null;
  recurrenceWeekdays: string | null;
  recurrenceUntil: Date | null;
  occurrenceIndex: number | null;
  isSeriesMaster: boolean;
  createdAt: Date;
  updatedAt: Date;
  attendeeCount: number;
  reservedCount: number;
  spotsLeft: number | null;
  recurringCount: number;
};

type EventListResponse = {
  items: EventResponse[];
  mapItems: EventResponse[];
  total: number;
  offset: number;
  limit: number;
};

const MAP_ITEMS_LIMIT = 200;

function buildWhereClause(input: EventListQueryInput) {
  const filters: Prisma.Sql[] = [Prisma.sql`e.event_endtime >= NOW()`];

  if (input.from) {
    const fromDate = new Date(input.from);
    if (!Number.isNaN(fromDate.getTime())) {
      filters.push(Prisma.sql`e.event_datetime >= ${fromDate}`);
    }
  }

  if (input.to) {
    const toDate = new Date(input.to);
    if (!Number.isNaN(toDate.getTime())) {
      filters.push(Prisma.sql`e.event_datetime <= ${toDate}`);
    }
  }

  if (input.categoryId) {
    filters.push(Prisma.sql`e.category_id = ${input.categoryId}::uuid`);
  }

  if (input.hostId) {
    filters.push(Prisma.sql`e.user_id = ${input.hostId}::uuid`);
  }

  if (input.search) {
    const like = `%${input.search}%`;
    filters.push(
      Prisma.sql`(
        e.event_name ILIKE ${like}
        OR COALESCE(e.description, '') ILIKE ${like}
        OR COALESCE(e.address_label, '') ILIKE ${like}
        OR COALESCE(e.event_location, '') ILIKE ${like}
      )`,
    );
  }

  if (
    typeof input.nearLat === "number" &&
    Number.isFinite(input.nearLat) &&
    typeof input.nearLng === "number" &&
    Number.isFinite(input.nearLng)
  ) {
    const bbox = boundingBox(
      { lat: input.nearLat, lng: input.nearLng },
      input.radiusKm,
    );
    const distanceSql = Prisma.sql`
      6371 * 2 * ASIN(
        SQRT(
          POWER(SIN(RADIANS((e.latitude - ${input.nearLat}) / 2)), 2) +
          COS(RADIANS(${input.nearLat})) * COS(RADIANS(e.latitude)) *
          POWER(SIN(RADIANS((e.longitude - ${input.nearLng}) / 2)), 2)
        )
      )
    `;

    filters.push(
      Prisma.sql`
        e.latitude IS NOT NULL
        AND e.longitude IS NOT NULL
        AND e.latitude BETWEEN ${bbox.minLat} AND ${bbox.maxLat}
        AND e.longitude BETWEEN ${bbox.minLng} AND ${bbox.maxLng}
        AND ${distanceSql} <= ${input.radiusKm}
      `,
    );
  }

  return Prisma.join(filters, " AND ");
}

function buildOrderByClause(sort: "date" | "price", order: "asc" | "desc") {
  if (sort === "price") {
    return order === "desc"
      ? Prisma.sql`ORDER BY COALESCE("priceField", 0) DESC, "eventDatetime" ASC`
      : Prisma.sql`ORDER BY COALESCE("priceField", 0) ASC, "eventDatetime" ASC`;
  }

  return order === "desc"
    ? Prisma.sql`ORDER BY "eventDatetime" DESC`
    : Prisma.sql`ORDER BY "eventDatetime" ASC`;
}

function buildListingBaseSql(whereClause: Prisma.Sql) {
  return Prisma.sql`
    WITH attendee_counts AS (
      SELECT event_id, COUNT(*)::int AS attendee_count
      FROM eventattendees
      GROUP BY event_id
    ),
    reservation_counts AS (
      SELECT event_id, COALESCE(SUM(quantity), 0)::int AS reserved_count
      FROM payments
      WHERE provider = 'chapa'::payment_provider
        AND status IN ('created'::payment_status, 'processing'::payment_status)
        AND reservation_expires_at > NOW()
      GROUP BY event_id
    ),
    filtered AS (
      SELECT
        e.event_id AS "eventId",
        e.event_name AS "eventName",
        e.event_datetime AS "eventDatetime",
        e.event_endtime AS "eventEndtime",
        e.event_location AS "eventLocation",
        e.address_label AS "addressLabel",
        e.latitude AS "latitude",
        e.longitude AS "longitude",
        e.description AS "description",
        e.picture_url AS "pictureUrl",
        e.capacity AS "capacityTotal",
        e.price_field AS "priceField",
        e.user_id AS "userId",
        e.category_id AS "categoryId",
        c.category_name AS "categoryName",
        e.series_id AS "seriesId",
        e.is_recurring AS "isRecurring",
        e.recurrence_kind AS "recurrenceKind",
        e.recurrence_interval AS "recurrenceInterval",
        e.recurrence_weekdays AS "recurrenceWeekdays",
        e.recurrence_until AS "recurrenceUntil",
        e.occurrence_index AS "occurrenceIndex",
        e.is_series_master AS "isSeriesMaster",
        e.created_at AS "createdAt",
        e.updated_at AS "updatedAt",
        COALESCE(attendee_counts.attendee_count, 0)::int AS "attendeeCount",
        COALESCE(reservation_counts.reserved_count, 0)::int AS "reservedCount",
        CASE
          WHEN e.capacity IS NULL THEN NULL
          ELSE GREATEST(
            e.capacity - COALESCE(attendee_counts.attendee_count, 0)::int - COALESCE(reservation_counts.reserved_count, 0)::int,
            0
          )
        END AS "spotsLeft",
        COALESCE(
          e.series_id::text,
          e.event_id::text
        ) AS "groupKey"
      FROM events e
      LEFT JOIN categories c ON c.category_id = e.category_id
      LEFT JOIN attendee_counts ON attendee_counts.event_id = e.event_id
      LEFT JOIN reservation_counts ON reservation_counts.event_id = e.event_id
      WHERE ${whereClause}
    ),
    grouped AS (
      SELECT
        *,
        ROW_NUMBER() OVER (PARTITION BY "groupKey" ORDER BY "eventDatetime" ASC) AS "seriesRank",
        COUNT(*) OVER (PARTITION BY "groupKey")::int AS "recurringCount"
      FROM filtered
    )
  `;
}

function mapEventRow(row: ListedEventRow): EventResponse {
  return {
    eventId: row.eventId,
    eventName: row.eventName,
    eventDatetime: row.eventDatetime.toISOString(),
    eventEndtime: row.eventEndtime.toISOString(),
    eventLocation: row.eventLocation,
    addressLabel: row.addressLabel,
    latitude: row.latitude,
    longitude: row.longitude,
    description: row.description,
    pictureUrl: row.pictureUrl,
    capacity: row.spotsLeft,
    capacityTotal: row.capacityTotal,
    reservedCount: row.reservedCount,
    spotsLeft: row.spotsLeft,
    priceField: row.priceField,
    userId: row.userId,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    seriesId: row.seriesId,
    isRecurring: row.isRecurring,
    recurrenceKind: row.recurrenceKind,
    recurrenceInterval: row.recurrenceInterval,
    recurrenceWeekdays: row.recurrenceWeekdays,
    recurrenceUntil: row.recurrenceUntil?.toISOString() ?? null,
    occurrenceIndex: row.occurrenceIndex,
    isSeriesMaster: row.isSeriesMaster,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    attendeeCount: row.attendeeCount,
    recurringCount: row.recurringCount,
    nextOccurrence: row.eventDatetime.toISOString(),
    myTickets: null,
  };
}

const getCachedPublicEventDetail = unstable_cache(
  async (eventId: string): Promise<EventDetailResponse | null> => {
    const event = await prisma.event.findUnique({
      where: { eventId },
      include: {
        category: true,
        _count: { select: { attendees: true } },
      },
    });

    if (!event) return null;

    const reservationCounts = await getActiveReservationCountMap([event.eventId]);

    let occurrences: EventOccurrence[] | undefined;
    if (event.seriesId) {
      const seriesEvents = await prisma.event.findMany({
        where: {
          seriesId: event.seriesId,
          eventEndtime: { gte: new Date() },
        },
        include: {
          _count: { select: { attendees: true } },
        },
        orderBy: { eventDatetime: "asc" },
        take: MAX_SERIES_OCCURRENCES,
      });

      const seriesReservationCounts = await getActiveReservationCountMap(
        seriesEvents.map((entry) => entry.eventId),
      );

      occurrences = seriesEvents.map((entry) =>
        serializeOccurrence(entry, {
          attendeeCount: entry._count.attendees,
          reservedCount: seriesReservationCounts.get(entry.eventId) ?? 0,
          myTickets: 0,
          refundableTicketCount: 0,
          refundableAmountEtb: 0,
        }),
      );
    }

    return {
      ...serializePublicEvent(event, {
        attendeeCount: event._count.attendees,
        reservedCount: reservationCounts.get(event.eventId) ?? 0,
        myTickets: null,
      }),
      occurrences,
    };
  },
  ["public-event-detail"],
  {
    revalidate: 60,
    tags: [cacheTags.events],
  },
);

const getCachedEventList = unstable_cache(
  async (serializedInput: string): Promise<EventListResponse> => {
    const input = JSON.parse(serializedInput) as EventListQueryInput;
    const whereClause = buildWhereClause(input);
    const baseSql = buildListingBaseSql(whereClause);
    const orderByClause = buildOrderByClause(input.sort, input.order);
    const offset = (input.page - 1) * input.limit;

    const [items, mapItems, totalRows] = await Promise.all([
      prisma.$queryRaw<ListedEventRow[]>(Prisma.sql`
        ${baseSql}
        SELECT *
        FROM grouped
        WHERE "seriesRank" = 1
        ${orderByClause}
        LIMIT ${input.limit}
        OFFSET ${offset}
      `),
      prisma.$queryRaw<ListedEventRow[]>(Prisma.sql`
        ${baseSql}
        SELECT *
        FROM grouped
        WHERE "seriesRank" = 1
        ${orderByClause}
        LIMIT ${MAP_ITEMS_LIMIT}
      `),
      prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
        ${baseSql}
        SELECT COUNT(*)::int AS total
        FROM grouped
        WHERE "seriesRank" = 1
      `),
    ]);

    return {
      items: items.map(mapEventRow),
      mapItems: mapItems.map(mapEventRow),
      total: totalRows[0]?.total ?? 0,
      offset,
      limit: input.limit,
    };
  },
  ["public-event-list"],
  {
    revalidate: 30,
    tags: [cacheTags.events, cacheTags.landing],
  },
);

export async function getPublicEventDetail(
  eventId: string,
  viewerUserId?: string | null,
): Promise<EventDetailResponse | null> {
  const baseDetail = await getCachedPublicEventDetail(eventId);
  if (!baseDetail || !viewerUserId) {
    return baseDetail;
  }

  const relatedEventIds = [
    baseDetail.eventId,
    ...(baseDetail.occurrences?.map((occurrence) => occurrence.eventId) ?? []),
  ];

  const ticketSummaryMap = await getUserEventTicketSummaryMap(
    viewerUserId,
    relatedEventIds,
  );
  const detailSummary = ticketSummaryMap.get(baseDetail.eventId);

  return {
    ...baseDetail,
    myTickets: detailSummary?.heldTicketCount ?? 0,
    heldTicketCount: detailSummary?.heldTicketCount ?? 0,
    refundableTicketCount: detailSummary?.refundableTicketCount ?? 0,
    refundableAmountEtb: detailSummary?.refundableAmountEtb ?? 0,
    occurrences: baseDetail.occurrences?.map((occurrence) => ({
      ...occurrence,
      myTickets: ticketSummaryMap.get(occurrence.eventId)?.heldTicketCount ?? 0,
      heldTicketCount:
        ticketSummaryMap.get(occurrence.eventId)?.heldTicketCount ?? 0,
      refundableTicketCount:
        ticketSummaryMap.get(occurrence.eventId)?.refundableTicketCount ?? 0,
      refundableAmountEtb:
        ticketSummaryMap.get(occurrence.eventId)?.refundableAmountEtb ?? 0,
    })),
  };
}

export async function listPublicEvents(
  input: EventListQueryInput,
): Promise<EventListResponse> {
  return getCachedEventList(JSON.stringify(input));
}
