import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PartyMemberStatus,
  ProductType,
  TicketStatus,
} from "@/generated/prisma/client";

const {
  getAuthUserEmailsMock,
  notifyUserByEmailMock,
  notifyUserByIdMock,
} = vi.hoisted(() => ({
  getAuthUserEmailsMock: vi.fn(),
  notifyUserByEmailMock: vi.fn(),
  notifyUserByIdMock: vi.fn(),
}));

vi.mock("@/lib/auth/userLookup", () => ({
  getAuthUserEmails: getAuthUserEmailsMock,
}));

vi.mock("@/services/actionNotifications", () => ({
  notifyUserByEmail: notifyUserByEmailMock,
  notifyUserById: notifyUserByIdMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: {
      findUnique: vi.fn(),
    },
  },
}));

function makeBooking() {
  return {
    id: "booking-1",
    userId: "buyer-1",
    productType: ProductType.MONTHLY,
    slot: {
      pitch: {
        id: "pitch-1",
        ownerId: "owner-1",
        name: "Meda Arena",
        addressLabel: "Bole",
        latitude: 9.01,
        longitude: 38.76,
      },
    },
    party: {
      members: [
        {
          id: "member-owner",
          userId: "buyer-1",
          invitedEmail: "buyer@example.com",
          status: PartyMemberStatus.JOINED,
        },
        {
          id: "member-user",
          userId: "friend-1",
          invitedEmail: "friend@example.com",
          status: PartyMemberStatus.JOINED,
        },
        {
          id: "member-email",
          userId: null,
          invitedEmail: "guest@example.com",
          status: PartyMemberStatus.INVITED,
        },
        {
          id: "member-removed",
          userId: null,
          invitedEmail: "removed@example.com",
          status: PartyMemberStatus.REMOVED,
        },
      ],
    },
    tickets: [
      {
        id: "ticket-1",
        status: TicketStatus.VALID,
        assignedUserId: "friend-1",
        assignedEmail: "friend@example.com",
        assignedName: "Friend One",
      },
      {
        id: "ticket-2",
        status: TicketStatus.ASSIGNED,
        assignedUserId: null,
        assignedEmail: "captain@example.com",
        assignedName: "Captain",
      },
    ],
  };
}

describe("services/bookingNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthUserEmailsMock.mockResolvedValue(
      new Map([
        ["buyer-1", { email: "buyer@example.com", name: "Buyer" }],
        ["friend-1", { email: "friend@example.com", name: "Friend One" }],
      ]),
    );
  });

  it("deduplicates booking recipients across purchaser, party, and ticket assignments", async () => {
    const { listBookingNotificationRecipients } = await import(
      "@/services/bookingNotifications"
    );

    const recipients = await listBookingNotificationRecipients(makeBooking() as never);

    expect(recipients).toEqual([
      {
        key: "user:buyer-1",
        userId: "buyer-1",
        email: "buyer@example.com",
        userName: "Buyer",
      },
      {
        key: "user:friend-1",
        userId: "friend-1",
        email: "friend@example.com",
        userName: "Friend One",
      },
      {
        key: "email:guest@example.com",
        email: "guest@example.com",
        userName: null,
      },
      {
        key: "email:captain@example.com",
        email: "captain@example.com",
        userName: "Captain",
      },
    ]);
  });

  it("broadcasts to user ids and raw emails while honoring exclusions", async () => {
    const { notifyBookingParticipants } = await import(
      "@/services/bookingNotifications"
    );

    await notifyBookingParticipants({
      booking: makeBooking() as never,
      subject: "Your group booking is confirmed",
      title: "Your booking is ready",
      message: "The booking is now ready in Meda.",
      ctaPath: "/tickets",
      excludeUserIds: ["buyer-1"],
      excludeEmails: ["captain@example.com"],
    });

    expect(notifyUserByIdMock).toHaveBeenCalledTimes(1);
    expect(notifyUserByIdMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "friend-1",
        subject: "Your group booking is confirmed",
      }),
    );
    expect(notifyUserByEmailMock).toHaveBeenCalledTimes(1);
    expect(notifyUserByEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "guest@example.com",
        subject: "Your group booking is confirmed",
      }),
    );
  });
});
