import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();
const errorMock = vi.fn();
const toBufferMock = vi.fn();
const createVerificationTokenMock = vi.fn();
const buildGoogleMapsUrlMock = vi.fn();

vi.mock("@/services/emails/client", () => ({
  FROM_ADDRESS: "Meda <hello@meda.app>",
  getResend: () => ({
    emails: {
      send: sendMock,
    },
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: errorMock,
  },
}));

vi.mock("qrcode", () => ({
  default: {
    toBuffer: toBufferMock,
  },
}));

vi.mock("@/lib/tickets/verificationToken", () => ({
  createVerificationToken: createVerificationTokenMock,
}));

vi.mock("@/lib/env", () => ({
  getAppBaseUrl: vi.fn().mockReturnValue("https://meda.test"),
}));

vi.mock("@/lib/location", () => ({
  buildGoogleMapsUrl: buildGoogleMapsUrlMock,
}));

describe("email templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendMock.mockResolvedValue({ error: null });
    toBufferMock.mockResolvedValue(Buffer.from("qr"));
    createVerificationTokenMock.mockImplementation((id: string) => `token-${id}`);
    buildGoogleMapsUrlMock.mockReturnValue(
      "https://www.google.com/maps/search/?api=1&query=8.997%2C38.786",
    );
  });

  it("sends action notifications with details and CTA text", async () => {
    const { sendActionNotificationEmail } = await import(
      "@/services/emails/actionNotification"
    );

    await sendActionNotificationEmail({
      to: "user@example.com",
      userName: "Abel",
      subject: "Action needed",
      title: "Finish setup",
      message: "Please finish setup.",
      details: [{ label: "Step", value: "Create your place" }],
      ctaLabel: "Open Host",
      ctaUrl: "https://meda.test/host",
    });

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Action needed",
        text: expect.stringContaining("Step: Create your place"),
        html: expect.stringContaining("Open Host"),
      }),
    );
  });

  it("sends booking ticket invites with map and QR attachments", async () => {
    const { sendBookingTicketInviteEmail } = await import(
      "@/services/emails/bookingTicketInvite"
    );

    await sendBookingTicketInviteEmail({
      to: "player@example.com",
      recipientName: "Player One",
      pitchName: "Gergi Football",
      addressLabel: "Bole Atlas, Addis Ababa",
      latitude: 8.997,
      longitude: 38.786,
      startsAt: new Date("2099-04-12T08:00:00.000Z"),
      endsAt: new Date("2099-04-12T10:00:00.000Z"),
      bookingTypeLabel: "Monthly group booking",
      shareAmountEtb: 110,
      paymentDeadline: new Date("2099-04-12T09:00:00.000Z"),
      viewTicketsUrl: "https://meda.test/tickets",
      qrTicketId: "ticket-1",
      qrEnabled: true,
      note: "Bring boots.",
    });

    expect(createVerificationTokenMock).toHaveBeenCalledWith(
      "ticket-1",
      "booking_ticket",
    );
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "You're on the list for Gergi Football",
        html: expect.stringContaining("Open map"),
        attachments: expect.arrayContaining([
          expect.objectContaining({ filename: "booking-ticket-qr.png" }),
        ]),
      }),
    );
  });

  it("sends refund confirmations with credited balance details", async () => {
    const { sendRefundConfirmationEmail } = await import(
      "@/services/emails/refundConfirmation"
    );

    await sendRefundConfirmationEmail({
      to: "user@example.com",
      userName: "Abel",
      eventName: "Sunday 5v5",
      eventDateTime: new Date("2099-01-01T18:00:00.000Z"),
      ticketCount: 2,
      amountCredited: 230,
      newBalance: 500,
    });

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Refund confirmed for Sunday 5v5",
        text: expect.stringContaining("Amount credited: ETB 230.00"),
        html: expect.stringContaining("Your Meda balance"),
      }),
    );
  });

  it("sends event reminders and waitlist notifications", async () => {
    const { sendEventReminderEmail } = await import("@/services/emails/reminder");
    const { sendWaitlistSpotAvailableEmail } = await import(
      "@/services/emails/waitlistNotification"
    );

    await sendEventReminderEmail({
      to: "user@example.com",
      attendeeName: "Abel",
      eventName: "Sunday 5v5",
      eventDateTime: new Date("2099-01-01T18:00:00.000Z"),
      eventEndTime: new Date("2099-01-01T20:00:00.000Z"),
      locationLabel: "Addis Arena",
      hoursUntil: 2,
      eventUrl: "https://meda.test/events/event-1",
    });

    await sendWaitlistSpotAvailableEmail({
      to: "user@example.com",
      userName: "Abel",
      eventName: "Sunday 5v5",
      eventDateTime: new Date("2099-01-01T18:00:00.000Z"),
      locationLabel: "Addis Arena",
      eventId: "event-1",
      baseUrl: "https://meda.test",
    });

    expect(sendMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        subject: "Reminder: Sunday 5v5 starts in 2 hours",
      }),
    );
    expect(sendMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        subject: "A spot opened up for Sunday 5v5!",
        html: expect.stringContaining("Register now"),
      }),
    );
  });

  it("sends subscription notices and ticket confirmations with QR attachments", async () => {
    const { sendSubscriptionNoticeEmail } = await import(
      "@/services/emails/subscriptionNotice"
    );
    const { sendTicketConfirmationEmail } = await import(
      "@/services/emails/ticketConfirmation"
    );

    await sendSubscriptionNoticeEmail({
      to: "host@example.com",
      userName: "Host",
      subject: "Plan expiring",
      title: "Your host plan is about to expire",
      message: "Renew soon.",
      planLabel: "Meda host plan",
      amountEtb: 1500,
      renewalDate: new Date("2099-01-10T00:00:00.000Z"),
      graceEndsAt: new Date("2099-01-25T00:00:00.000Z"),
      ctaUrl: "https://meda.test/host",
    });

    await sendTicketConfirmationEmail({
      to: "buyer@example.com",
      buyerName: "Buyer",
      eventName: "Floodlit 8v8",
      eventDateTime: new Date("2099-01-01T18:00:00.000Z"),
      eventEndTime: new Date("2099-01-01T20:00:00.000Z"),
      locationLabel: "Addis Arena",
      quantity: 2,
      eventId: "event-1",
      attendeeIds: ["att-1", "att-2"],
      baseUrl: "https://meda.test",
    });

    expect(sendMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        subject: "Plan expiring",
        html: expect.stringContaining("Grace period ends"),
      }),
    );
    expect(sendMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        subject: "Your ticket for Floodlit 8v8",
        attachments: expect.arrayContaining([
          expect.objectContaining({ filename: "ticket-qr-1.png" }),
          expect.objectContaining({ filename: "ticket-qr-2.png" }),
        ]),
      }),
    );
  });

  it("logs and throws when resend returns an error", async () => {
    sendMock.mockResolvedValueOnce({ error: { message: "No sender" } });

    const { sendSubscriptionNoticeEmail } = await import(
      "@/services/emails/subscriptionNotice"
    );

    await expect(
      sendSubscriptionNoticeEmail({
        to: "host@example.com",
        subject: "Plan expiring",
        title: "Plan expiring",
        message: "Renew soon.",
        planLabel: "Meda host plan",
        amountEtb: 1500,
      }),
    ).rejects.toThrow("Resend send failed: No sender");

    expect(errorMock).toHaveBeenCalled();
  });
});
