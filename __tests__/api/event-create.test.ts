import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mockRequireAdminOrPitchOwnerUser = vi.fn();
const mockPrismaEventCreate = vi.fn();
const mockPrismaEventCreateMany = vi.fn();
const mockPrismaEventFindUnique = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/auth/guards", () => ({
  requireAdminOrPitchOwnerUser: mockRequireAdminOrPitchOwnerUser,
}));

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

vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ limited: false }),
  getClientId: vi.fn().mockReturnValue("test-client"),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

const TEST_USER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const CATEGORY_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";

function makeSessionUser(id = TEST_USER_ID) {
  return {
    user: { id, email: "user@test.com", name: "Test User", role: "admin" },
    response: null,
  };
}

function makeFormData(overrides: Record<string, string> = {}) {
  const form = new FormData();
  const defaults: Record<string, string> = {
    eventName: "Test Event",
    categoryId: CATEGORY_ID,
    startDate: new Date(Date.now() + 86400_000).toISOString(),
    endDate: new Date(Date.now() + 2 * 86400_000).toISOString(),
    location: "Test Venue",
    latitude: "9.0",
    longitude: "38.7",
    ...overrides,
  };
  for (const [key, value] of Object.entries(defaults)) {
    form.set(key, value);
  }
  return form;
}

function makeRequest(formData: FormData, ip = "1.2.3.4") {
  return new Request("http://localhost/api/events/create", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
    body: formData,
  });
}

async function importHandler() {
  const mod = await import("@/app/api/events/create/route");
  return mod.POST;
}

describe("POST /api/events/create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminOrPitchOwnerUser.mockResolvedValue(makeSessionUser());
    mockPrismaEventCreate.mockResolvedValue({ eventId: "new-event-id" });
    mockPrismaEventFindUnique.mockResolvedValue({ eventId: "new-event-id" });
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        event: {
          createMany: mockPrismaEventCreateMany,
        },
      });
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAdminOrPitchOwnerUser.mockResolvedValue({
      user: null,
      response: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }),
    });

    const POST = await importHandler();
    const res = await POST(makeRequest(makeFormData()));
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing required fields", async () => {
    const form = new FormData();
    form.set("eventName", "Test");

    const POST = await importHandler();
    const res = await POST(makeRequest(form));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid event payload/i);
  });

  it("returns 400 for invalid date range", async () => {
    const form = makeFormData({
      startDate: new Date(Date.now() + 2 * 86400_000).toISOString(),
      endDate: new Date(Date.now() + 86400_000).toISOString(),
    });

    const POST = await importHandler();
    const res = await POST(makeRequest(form));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/end time/i);
  });

  it("creates a non-recurring event successfully", async () => {
    const POST = await importHandler();
    const res = await POST(makeRequest(makeFormData()));
    expect(res.status).toBe(201);
    expect(mockPrismaEventCreate).toHaveBeenCalledTimes(1);
  });

  it("returns 400 for invalid capacity", async () => {
    const form = makeFormData({ capacity: "-5" });

    const POST = await importHandler();
    const res = await POST(makeRequest(form));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/capacity/i);
  });

  it("returns 400 for invalid price", async () => {
    const form = makeFormData({ price: "-10" });

    const POST = await importHandler();
    const res = await POST(makeRequest(form));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/price/i);
  });
});
