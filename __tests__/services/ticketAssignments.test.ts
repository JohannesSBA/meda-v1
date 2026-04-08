import { beforeEach, describe, expect, it, vi } from "vitest";
import { TicketStatus } from "@/generated/prisma/client";

const {
  bookingTicketFindUniqueMock,
  bookingTicketUpdateMock,
  getAuthUserByEmailMock,
  getAuthUserEmailsMock,
  hostActivityCreateMock,
  notifyUserByEmailMock,
  notifyUserByIdMock,
  prismaTransactionMock,
  sendBookingTicketInviteEmailMock,
} = vi.hoisted(() => ({
  bookingTicketFindUniqueMock: vi.fn(),
  bookingTicketUpdateMock: vi.fn(),
  getAuthUserByEmailMock: vi.fn(),
  getAuthUserEmailsMock: vi.fn(),
  hostActivityCreateMock: vi.fn(),
  notifyUserByEmailMock: vi.fn(),
  notifyUserByIdMock: vi.fn(),
  prismaTransactionMock: vi.fn(),
  sendBookingTicketInviteEmailMock: vi.fn(),
}));

vi.mock("@/lib/auth/userLookup", () => ({
  getAuthUserByEmail: getAuthUserByEmailMock,
  getAuthUserEmails: getAuthUserEmailsMock,
}));

vi.mock("@/services/actionNotifications", () => ({
  notifyUserByEmail: notifyUserByEmailMock,
  notifyUserById: notifyUserByIdMock,
}));

vi.mock("@/services/email", () => ({
  sendBookingTicketInviteEmail: sendBookingTicketInviteEmailMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bookingTicket: {
      findUnique: bookingTicketFindUniqueMock,
    },
    $transaction: prismaTransactionMock,
  },
}));

function makeTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: "ticket-1",
    bookingId: "booking-1",
    purchaserId: "buyer-1",
    assignedUserId: null,
    assignedEmail: "old@example.com",
    assignedName: "Old Player",
    status: TicketStatus.ASSIGNED,
    checkedInAt: null,
    booking: {
      productType: "DAILY",
      expiresAt: null,
      party: {
        members: [],
      },
      slot: {
        id: "slot-1",
        pitchId: "pitch-1",
        startsAt: new Date("2099-01-01T10:00:00.000Z"),
        endsAt: new Date("2099-01-01T12:00:00.000Z"),
        pitch: {
          id: "pitch-1",
          ownerId: "owner-1",
          name: "Meda Arena",
          addressLabel: "Addis",
          latitude: 9.01,
          longitude: 38.76,
        },
      },
    },
    ...overrides,
  };
}

describe("services/ticketAssignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthUserByEmailMock.mockResolvedValue(null);
    getAuthUserEmailsMock.mockResolvedValue(new Map());
    bookingTicketFindUniqueMock.mockResolvedValue(makeTicket());
    prismaTransactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        bookingTicket: {
          update: bookingTicketUpdateMock,
        },
        hostActivityLog: {
          create: hostActivityCreateMock,
        },
      }),
    );
    bookingTicketUpdateMock.mockResolvedValue(
      makeTicket({
        assignedEmail: "new@example.com",
        assignedName: "New Player",
      }),
    );
  });

  it("notifies the previous assignee when a ticket is directly reassigned", async () => {
    const { assignTicket } = await import("@/services/ticketAssignments");

    await assignTicket({
      ticketId: "ticket-1",
      actor: {
        userId: "buyer-1",
        email: "buyer@example.com",
      },
      assignedEmail: "new@example.com",
      assignedName: "New Player",
    });

    expect(sendBookingTicketInviteEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "new@example.com",
      }),
    );
    expect(notifyUserByEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "old@example.com",
        subject: "A booking ticket was removed from your name",
      }),
    );
  });
});
