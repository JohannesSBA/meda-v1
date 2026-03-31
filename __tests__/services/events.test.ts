/**
 * Unit tests for the events service (createEvent).
 *
 * Tests recurrence validation and single-event creation with mocked Prisma.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrismaEventCreate = vi.fn();
const mockPrismaEventCreateMany = vi.fn();
const mockPrismaEventFindUnique = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: {
      create: mockPrismaEventCreate,
      createMany: mockPrismaEventCreateMany,
      findUnique: mockPrismaEventFindUnique,
    },
    $transaction: mockTransaction,
  },
}));

vi.mock("@/lib/uploadEventImage", () => ({
  uploadEventImageUnified: vi.fn().mockResolvedValue("https://example.com/image.jpg"),
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440001";
const CATEGORY_ID = "550e8400-e29b-41d4-a716-446655440002";

async function importCreateEvent() {
  const mod = await import("@/services/events");
  return mod.createEvent;
}

describe("createEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrismaEventCreate.mockResolvedValue({ eventId: "new-event-id" });
    mockPrismaEventFindUnique.mockResolvedValue({ eventId: "new-event-id" });
  });

  it("throws for missing required fields", async () => {
    const createEvent = await importCreateEvent();
    await expect(
      createEvent({
        userId: TEST_USER_ID,
        eventName: "",
        categoryId: CATEGORY_ID,
        description: null,
        startDate: "2025-06-01",
        endDate: "2025-06-02",
        location: "Venue",
        latitude: "9",
        longitude: "38",
        capacity: 10,
        price: 0,
        recurrenceEnabled: false,
      }),
    ).rejects.toThrow("Missing required fields");
  });

  it("throws when end time is before start time", async () => {
    const createEvent = await importCreateEvent();
    await expect(
      createEvent({
        userId: TEST_USER_ID,
        eventName: "Test",
        categoryId: CATEGORY_ID,
        description: null,
        startDate: "2025-06-02",
        endDate: "2025-06-01",
        location: "Venue",
        latitude: "9",
        longitude: "38",
        capacity: 10,
        price: 0,
        recurrenceEnabled: false,
      }),
    ).rejects.toThrow("End time must be after start time");
  });

  it("creates a single event successfully", async () => {
    const createEvent = await importCreateEvent();
    const start = new Date(Date.now() + 86400_000).toISOString();
    const end = new Date(Date.now() + 2 * 86400_000).toISOString();

    const result = await createEvent({
      userId: TEST_USER_ID,
      eventName: "Test Event",
      categoryId: CATEGORY_ID,
      description: null,
      startDate: start,
      endDate: end,
      location: "Venue",
      latitude: "9",
      longitude: "38",
      capacity: 10,
      price: 0,
      recurrenceEnabled: false,
    });

    expect(result.event).toBeDefined();
    expect(result.event.eventId).toBeDefined();
    expect(mockPrismaEventCreate).toHaveBeenCalledTimes(1);
  });
});
