import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  bookingFindManyMock,
  eventFindManyMock,
  executeRawUnsafeMock,
  getAuthUserEmailsMock,
  hostReviewFindManyMock,
  listBookingNotificationRecipientsMock,
  notifyUserByIdMock,
  queryRawMock,
  sendEventReminderEmailMock,
  sendHostReviewReminderEmailMock,
} = vi.hoisted(() => ({
  bookingFindManyMock: vi.fn(),
  eventFindManyMock: vi.fn(),
  executeRawUnsafeMock: vi.fn(),
  getAuthUserEmailsMock: vi.fn(),
  hostReviewFindManyMock: vi.fn(),
  listBookingNotificationRecipientsMock: vi.fn(),
  notifyUserByIdMock: vi.fn(),
  queryRawMock: vi.fn(),
  sendEventReminderEmailMock: vi.fn(),
  sendHostReviewReminderEmailMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: {
      findMany: eventFindManyMock,
    },
    booking: {
      findMany: bookingFindManyMock,
    },
    hostReview: {
      findMany: hostReviewFindManyMock,
    },
    $queryRaw: queryRawMock,
    $executeRawUnsafe: executeRawUnsafeMock,
  },
}));

vi.mock("@/lib/auth/userLookup", () => ({
  getAuthUserEmails: getAuthUserEmailsMock,
}));

vi.mock("@/services/email", () => ({
  sendEventReminderEmail: sendEventReminderEmailMock,
  sendHostReviewReminderEmail: sendHostReviewReminderEmailMock,
}));

vi.mock("@/services/actionNotifications", () => ({
  notifyUserById: notifyUserByIdMock,
}));

vi.mock("@/services/bookingNotifications", () => ({
  bookingNotificationInclude: {},
  listBookingNotificationRecipients: listBookingNotificationRecipientsMock,
}));

describe("GET /api/cron/send-reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret";

    eventFindManyMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    bookingFindManyMock
      .mockResolvedValueOnce([
        {
          id: "booking-1",
          productType: "MONTHLY",
          slot: {
            startsAt: new Date("2099-01-02T10:00:00.000Z"),
            endsAt: new Date("2099-01-02T12:00:00.000Z"),
            pitch: {
              name: "Meda Arena",
            },
          },
        },
      ])
      .mockResolvedValueOnce([]);
    getAuthUserEmailsMock.mockResolvedValue(new Map());
    hostReviewFindManyMock.mockResolvedValue([]);
    listBookingNotificationRecipientsMock.mockResolvedValue([
      {
        key: "user:user-1",
        userId: "user-1",
        email: "user@example.com",
      },
    ]);
    notifyUserByIdMock.mockResolvedValue(true);
    queryRawMock.mockResolvedValue([]);
    executeRawUnsafeMock.mockResolvedValue(undefined);
  });

  it("sends and logs booking reminders for confirmed bookings", async () => {
    const { GET } = await import("@/app/api/cron/send-reminders/route");

    const response = await GET(
      new Request("https://meda.test/api/cron/send-reminders", {
        headers: {
          authorization: "Bearer cron-secret",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(notifyUserByIdMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        subject: "Reminder: your booking starts in 24 hours",
      }),
    );
    expect(executeRawUnsafeMock).toHaveBeenCalledWith(
      expect.stringContaining("booking_id"),
      "booking-1",
      "user-1",
      "booking_24h",
    );
  });
});
