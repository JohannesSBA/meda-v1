import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mockRequirePitchOwnerUser = vi.fn();
const mockExportOwnerDashboardCsv = vi.fn();

const { mockOwnerCsvExportRateLimit } = vi.hoisted(() => ({
  mockOwnerCsvExportRateLimit: vi.fn().mockResolvedValue({ limited: false }),
}));

vi.mock("@/lib/auth/guards", () => ({
  requirePitchOwnerUser: mockRequirePitchOwnerUser,
}));

vi.mock("@/lib/ratelimit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ratelimit")>("@/lib/ratelimit");
  return {
    ...actual,
    checkOwnerDashboardCsvExportRateLimit: mockOwnerCsvExportRateLimit,
  };
});

vi.mock("@/services/ownerAnalytics", () => ({
  exportOwnerDashboardCsv: mockExportOwnerDashboardCsv,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

const OWNER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("owner dashboard CSV export routes (auth + delegation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOwnerCsvExportRateLimit.mockResolvedValue({ limited: false });
  });

  it("returns 401 when pitch owner guard rejects the session", async () => {
    mockRequirePitchOwnerUser.mockResolvedValue({
      user: null,
      response: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }),
    });
    const { GET } = await import("@/app/api/owner/dashboard/exports/bookings.csv/route");
    const res = await GET(new Request("http://localhost/api/owner/dashboard/exports/bookings.csv"));
    expect(res.status).toBe(401);
    expect(mockExportOwnerDashboardCsv).not.toHaveBeenCalled();
    expect(mockOwnerCsvExportRateLimit).not.toHaveBeenCalled();
  });

  it("returns 403 when the user is not a pitch owner", async () => {
    mockRequirePitchOwnerUser.mockResolvedValue({
      user: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const { GET } = await import("@/app/api/owner/dashboard/exports/payments.csv/route");
    const res = await GET(new Request("http://localhost/api/owner/dashboard/exports/payments.csv"));
    expect(res.status).toBe(403);
    expect(mockExportOwnerDashboardCsv).not.toHaveBeenCalled();
    expect(mockOwnerCsvExportRateLimit).not.toHaveBeenCalled();
  });

  it("returns 429 when owner CSV export rate limit is exceeded", async () => {
    mockRequirePitchOwnerUser.mockResolvedValue({
      user: { id: OWNER_ID, role: "pitch_owner" },
      response: null,
    });
    mockOwnerCsvExportRateLimit.mockResolvedValueOnce({
      limited: true,
      retryAfterMs: 45_000,
    });
    const { GET } = await import("@/app/api/owner/dashboard/exports/bookings.csv/route");
    const res = await GET(new Request("http://localhost/api/owner/dashboard/exports/bookings.csv"));
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/too many requests/i);
    expect(res.headers.get("Retry-After")).toBe("45");
    expect(mockExportOwnerDashboardCsv).not.toHaveBeenCalled();
    expect(mockOwnerCsvExportRateLimit).toHaveBeenCalledWith(OWNER_ID);
  });

  it("returns CSV and passes session ownerId into exportOwnerDashboardCsv", async () => {
    mockRequirePitchOwnerUser.mockResolvedValue({
      user: { id: OWNER_ID, role: "pitch_owner" },
      response: null,
    });
    mockExportOwnerDashboardCsv.mockResolvedValue("h1,h2\nv1,v2");
    const { GET } = await import("@/app/api/owner/dashboard/exports/attendees.csv/route");
    const res = await GET(
      new Request(
        "http://localhost/api/owner/dashboard/exports/attendees.csv?from=2020-01-01T00:00:00.000Z&to=2030-01-01T00:00:00.000Z",
      ),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("h1");
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(mockExportOwnerDashboardCsv).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: OWNER_ID,
        type: "attendees",
        from: expect.any(Date),
        to: expect.any(Date),
      }),
    );
    expect(mockOwnerCsvExportRateLimit).toHaveBeenCalledWith(OWNER_ID);
  });
});
