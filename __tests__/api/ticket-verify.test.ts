import { beforeEach, describe, expect, it, vi } from "vitest";

const mockParseVerificationToken = vi.fn();
const mockGetSession = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockFindUniqueAttendee = vi.fn();
const mockFindUniqueScan = vi.fn();
const mockQueryRawUnsafe = vi.fn();
const mockQueryRaw = vi.fn();

vi.mock("@/lib/tickets/verificationToken", () => ({
  parseVerificationToken: mockParseVerificationToken,
  verifyToken: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  auth: { getSession: mockGetSession },
}));

vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: mockCheckRateLimit,
  getClientId: vi.fn().mockReturnValue("test-client"),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    eventAttendee: {
      findUnique: mockFindUniqueAttendee,
    },
    ticketScan: {
      findUnique: mockFindUniqueScan,
    },
    $queryRawUnsafe: mockQueryRawUnsafe,
    $queryRaw: mockQueryRaw,
  },
}));

function makeAttendee() {
  return {
    attendeeId: "att-1",
    eventId: "11111111-1111-1111-1111-111111111111",
    userId: "22222222-2222-2222-2222-222222222222",
    event: {
      eventId: "11111111-1111-1111-1111-111111111111",
      eventName: "Floodlit 8v8",
      eventDatetime: new Date("2026-04-18T18:00:00.000Z"),
      eventEndtime: new Date("2026-04-18T20:00:00.000Z"),
      eventLocation: "Legacy Venue!longitude=38.7&latitude=9.0",
      addressLabel: "Addis Arena, Addis Ababa",
      latitude: 9.01,
      longitude: 38.76,
      userId: "33333333-3333-3333-3333-333333333333",
    },
  };
}

async function importHandlers() {
  const mod = await import("@/app/api/tickets/verify/[token]/route");
  return { GET: mod.GET, POST: mod.POST };
}

describe("ticket verification routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockCheckRateLimit.mockResolvedValue({ limited: false });
    mockGetSession.mockResolvedValue({
      data: {
        user: {
          id: "33333333-3333-3333-3333-333333333333",
          role: "admin",
        },
      },
    });
    mockQueryRawUnsafe.mockResolvedValue([
      {
        id: "22222222-2222-2222-2222-222222222222",
        name: "Player One",
        email: "player@example.com",
      },
    ]);
  });

  it("GET verifies a ticket without inserting a scan row", async () => {
    mockParseVerificationToken.mockReturnValue({
      id: "att-1",
      kind: "event_attendee",
    });
    mockFindUniqueAttendee.mockResolvedValue(makeAttendee());
    mockFindUniqueScan.mockResolvedValue(null);

    const { GET } = await importHandlers();
    const response = await GET(
      new Request(
        "http://localhost/api/tickets/verify/token-123?eventId=11111111-1111-1111-1111-111111111111",
      ),
      { params: Promise.resolve({ token: "token-123" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      valid: true,
      alreadyScanned: false,
      addressLabel: "Addis Arena, Addis Ababa",
      canScan: true,
    });
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it("POST records a scan when the ticket is first used", async () => {
    mockParseVerificationToken.mockReturnValue({
      id: "att-1",
      kind: "event_attendee",
    });
    mockFindUniqueAttendee.mockResolvedValue(makeAttendee());
    mockFindUniqueScan.mockResolvedValue(null);
    mockQueryRaw.mockResolvedValue([
      {
        scan_id: "scan-1",
        scanned_at: new Date(),
        scanned_by_user_id: "33333333-3333-3333-3333-333333333333",
        inserted: true,
      },
    ]);

    const { POST } = await importHandlers();
    const response = await POST(
      new Request("http://localhost/api/tickets/verify/token-123", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: "11111111-1111-1111-1111-111111111111",
        }),
      }),
      { params: Promise.resolve({ token: "token-123" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      valid: true,
      alreadyScanned: false,
      addressLabel: "Addis Arena, Addis Ababa",
    });
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid verification tokens before hitting the database", async () => {
    mockParseVerificationToken.mockReturnValue(null);

    const { GET } = await importHandlers();
    const response = await GET(
      new Request("http://localhost/api/tickets/verify/bad-token"),
      { params: Promise.resolve({ token: "bad-token" }) },
    );

    expect(response.status).toBe(400);
    expect(mockFindUniqueAttendee).not.toHaveBeenCalled();
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });
});
