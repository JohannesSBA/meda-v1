import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingStatus, PaymentPoolStatus, ProductType, TicketStatus } from "@/generated/prisma/client";
import { createBookingPoolShareToken } from "@/lib/tickets/bookingShareToken";

const {
  bookingFindUniqueMock,
  bookingTicketFindUniqueMock,
  getAuthUserEmailsMock,
  notifyUserByIdMock,
  partyMemberCreateMock,
  prismaTransactionMock,
  syncEditableMonthlyBookingForPartyTxMock,
} = vi.hoisted(() => ({
  bookingFindUniqueMock: vi.fn(),
  bookingTicketFindUniqueMock: vi.fn(),
  getAuthUserEmailsMock: vi.fn(),
  notifyUserByIdMock: vi.fn(),
  partyMemberCreateMock: vi.fn(),
  prismaTransactionMock: vi.fn(),
  syncEditableMonthlyBookingForPartyTxMock: vi.fn(),
}));

vi.mock("@/lib/auth/userLookup", () => ({
  getAuthUserEmails: getAuthUserEmailsMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: {
      findUnique: bookingFindUniqueMock,
    },
    bookingTicket: {
      findUnique: bookingTicketFindUniqueMock,
    },
    $transaction: prismaTransactionMock,
  },
}));

vi.mock("@/services/actionNotifications", () => ({
  notifyUserById: notifyUserByIdMock,
}));

vi.mock("@/services/parties", () => ({
  syncEditableMonthlyBookingForPartyTx: syncEditableMonthlyBookingForPartyTxMock,
}));

describe("booking ticket sharing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates one multi-claim link for an editable monthly booking pool", async () => {
    bookingFindUniqueMock.mockResolvedValue({
      id: "booking-1",
      userId: "owner-1",
      productType: ProductType.MONTHLY,
      status: BookingStatus.PENDING,
      slot: {
        startsAt: new Date("2099-01-01T10:00:00.000Z"),
        endsAt: new Date("2099-01-01T12:00:00.000Z"),
        pitch: {
          id: "pitch-1",
          ownerId: "pitch-owner-1",
          name: "Meda Arena",
          addressLabel: "Addis",
        },
      },
      party: {
        id: "party-1",
        members: [],
      },
      paymentPool: {
        id: "pool-1",
        status: PaymentPoolStatus.PENDING,
        amountPaid: 0,
        expiresAt: new Date("2099-01-01T09:00:00.000Z"),
      },
      tickets: [
        {
          id: "ticket-open-1",
          status: TicketStatus.ASSIGNMENT_PENDING,
          assignedUserId: null,
          assignedEmail: null,
          assignedName: null,
        },
        {
          id: "ticket-open-2",
          status: TicketStatus.ASSIGNMENT_PENDING,
          assignedUserId: null,
          assignedEmail: null,
          assignedName: null,
        },
      ],
    });

    const { createBookingPoolShareLink } = await import("@/services/bookingTicketSharing");
    const result = await createBookingPoolShareLink({
      bookingId: "booking-1",
      ownerUserId: "owner-1",
      baseUrl: "https://meda.test",
    });

    expect(result.kind).toBe("booking_pool");
    expect(result.remainingClaims).toBe(2);
    expect(result.shareUrl).toContain("/tickets/claim/bps_");
  });

  it("claims an open pool spot by creating a member and syncing the booking", async () => {
    const startsAt = new Date("2099-01-01T10:00:00.000Z");
    const endsAt = new Date("2099-01-01T12:00:00.000Z");
    const expiresAt = new Date("2099-01-01T09:00:00.000Z");

    prismaTransactionMock.mockImplementation(
      async (callback: (tx: { booking: { findUnique: typeof bookingFindUniqueMock }; partyMember: { create: typeof partyMemberCreateMock } }) => unknown) =>
        callback({
          booking: {
            findUnique: vi.fn().mockResolvedValue({
              id: "booking-1",
              userId: "owner-1",
              productType: ProductType.MONTHLY,
              status: BookingStatus.PENDING,
              slot: {
                startsAt,
                endsAt,
                pitch: {
                  id: "pitch-1",
                  ownerId: "pitch-owner-1",
                  name: "Meda Arena",
                },
              },
              party: {
                id: "party-1",
                members: [
                  {
                    id: "member-owner",
                    userId: "owner-1",
                    invitedEmail: "owner@example.com",
                    status: "JOINED",
                  },
                ],
              },
              paymentPool: {
                id: "pool-1",
                status: PaymentPoolStatus.PENDING,
                amountPaid: 0,
                expiresAt,
              },
              tickets: [
                {
                  id: "ticket-open-1",
                  status: TicketStatus.ASSIGNMENT_PENDING,
                  assignedUserId: null,
                  assignedEmail: null,
                  assignedName: null,
                },
              ],
            }),
          },
          partyMember: {
            create: partyMemberCreateMock,
          },
        }),
    );
    syncEditableMonthlyBookingForPartyTxMock.mockResolvedValue({
      booking: null,
      activeMembers: [],
      assignments: new Map(),
    });
    getAuthUserEmailsMock.mockResolvedValue(
      new Map([["claimant-1", { name: "New Player", email: "claimant@example.com" }]]),
    );

    const { claimBookingPoolShareLink } = await import("@/services/bookingTicketSharing");
    const result = await claimBookingPoolShareLink({
      token: createBookingPoolShareToken({
        bookingId: "booking-1",
        purchaserId: "owner-1",
        expiresAt,
      }),
      claimantUserId: "claimant-1",
      claimantEmail: "claimant@example.com",
    });

    expect(partyMemberCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          partyId: "party-1",
          userId: "claimant-1",
          invitedEmail: "claimant@example.com",
        }),
      }),
    );
    expect(syncEditableMonthlyBookingForPartyTxMock).toHaveBeenCalledWith({
      tx: expect.any(Object),
      partyId: "party-1",
    });
    expect(notifyUserByIdMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      kind: "booking_pool",
      redirectPath: "/tickets",
    });
  });
});
