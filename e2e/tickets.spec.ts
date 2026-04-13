import { expect, test } from "@playwright/test";
import { installClipboardStub, setE2EUserCookie } from "./helpers/auth";

function buildTicketsHubResponse() {
  return {
    sections: {
      needsAction: [
        {
          kind: "booking",
          id: "booking-1",
          section: "needs_action",
          startsAt: "2099-04-12T08:00:00.000Z",
          endsAt: "2099-04-12T10:00:00.000Z",
          title: "Gergi Football",
          subtitle: "Saturday, April 12 · 8:00 AM",
          statusLabel: "Booked",
          helperText: "Add the player name before this ticket can be used.",
          primaryAction: {
            type: "add_player_names",
            label: "Add player names",
          },
          canCancel: true,
          purchaserCanManageTickets: true,
          claimableTicketIds: [],
          canPayShare: false,
          booking: {
            id: "booking-1",
            status: "CONFIRMED",
            productType: "DAILY",
            quantity: 1,
            totalAmount: 125,
            currency: "ETB",
            expiresAt: null,
            paidAt: "2099-04-10T12:00:00.000Z",
            slot: {
              id: "slot-1",
              pitchName: "Gergi Football",
              ownerId: "owner-1",
              addressLabel: "Bole Atlas, Addis Ababa",
              latitude: 8.997,
              longitude: 38.786,
              startsAt: "2099-04-12T08:00:00.000Z",
              endsAt: "2099-04-12T10:00:00.000Z",
              capacity: 10,
              remainingCapacity: 8,
            },
            party: null,
            tickets: [
              {
                id: "ticket-1",
                purchaserId: "550e8400-e29b-41d4-a716-446655440010",
                assignedUserId: null,
                assignedName: null,
                assignedEmail: null,
                assigneeDisplayName: null,
                status: "ASSIGNMENT_PENDING",
                checkedInAt: null,
              },
            ],
            ticketSummary: {
              sold: 1,
              assigned: 0,
              unassigned: 1,
              checkedIn: 0,
            },
            paymentPool: null,
          },
        },
      ],
      upNext: [],
      past: [],
    },
    summary: {
      needsAction: 1,
      upNext: 0,
      past: 0,
    },
  };
}

function buildGroupPaymentHubResponse() {
  return {
    sections: {
      needsAction: [
        {
          kind: "booking",
          id: "booking-2",
          section: "needs_action",
          startsAt: "2099-04-20T18:00:00.000Z",
          endsAt: "2099-04-20T20:00:00.000Z",
          title: "Weekend Group Booking",
          subtitle: "Sunday, April 20 · 6:00 PM",
          statusLabel: "Waiting for payment",
          helperText: "Everyone in the group still needs to finish payment before the deadline.",
          primaryAction: {
            type: "pay_share",
            label: "Pay your share",
            poolId: "pool-1",
          },
          canCancel: true,
          purchaserCanManageTickets: true,
          claimableTicketIds: [],
          canPayShare: true,
          booking: {
            id: "booking-2",
            status: "PENDING",
            productType: "MONTHLY",
            quantity: 10,
            totalAmount: 1250,
            currency: "ETB",
            expiresAt: "2099-04-20T17:00:00.000Z",
            paidAt: null,
            slot: {
              id: "slot-2",
              pitchName: "Weekend Turf",
              ownerId: "owner-2",
              addressLabel: "CMC, Addis Ababa",
              latitude: 9.05,
              longitude: 38.81,
              startsAt: "2099-04-20T18:00:00.000Z",
              endsAt: "2099-04-20T20:00:00.000Z",
              capacity: 10,
              remainingCapacity: 0,
            },
            party: {
              id: "party-1",
              ownerId: "550e8400-e29b-41d4-a716-446655440010",
              name: "Sunday Squad",
              status: "PENDING_PAYMENT",
              memberCount: 2,
              members: [
                {
                  id: "member-1",
                  userId: "550e8400-e29b-41d4-a716-446655440010",
                  invitedEmail: "e2e-user@example.com",
                  displayName: "E2E User",
                  status: "JOINED",
                  joinedAt: "2099-04-01T12:00:00.000Z",
                  paidAt: null,
                },
                {
                  id: "member-2",
                  userId: null,
                  invitedEmail: "friend@example.com",
                  displayName: "friend@example.com",
                  status: "INVITED",
                  joinedAt: null,
                  paidAt: null,
                },
              ],
            },
            tickets: [],
            ticketSummary: {
              sold: 10,
              assigned: 2,
              unassigned: 8,
              checkedIn: 0,
            },
            paymentPool: {
              id: "pool-1",
              status: "PENDING",
              totalAmount: 1250,
              amountPaid: 125,
              outstandingAmount: 1125,
              expiresAt: "2099-04-20T17:00:00.000Z",
              contributions: [
                {
                  id: "contrib-1",
                  userId: "550e8400-e29b-41d4-a716-446655440010",
                  partyMemberId: "member-1",
                  contributorLabel: "E2E User",
                  expectedAmount: 1125,
                  paidAmount: 125,
                  status: "PAID",
                },
                {
                  id: "contrib-2",
                  userId: null,
                  partyMemberId: "member-2",
                  contributorLabel: "friend@example.com",
                  expectedAmount: 125,
                  paidAmount: 0,
                  status: "PENDING",
                },
              ],
            },
          },
        },
      ],
      upNext: [],
      past: [],
    },
    summary: {
      needsAction: 1,
      upNext: 0,
      past: 0,
    },
  };
}

test.beforeEach(async ({ page, context, baseURL }) => {
  await installClipboardStub(page);
  await setE2EUserCookie(context, baseURL!);

  await page.route("**/api/profile/balance", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ balanceEtb: 350 }),
    });
  });
});

test("keeps ticket management hidden until requested and can create a claim link", async ({
  page,
}) => {
  const shareUrl = "http://127.0.0.1:3100/tickets/claim/booking-share-token-123";

  await page.route("**/api/tickets/hub", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildTicketsHubResponse()),
    });
  });

  await page.route("**/api/tickets/ticket-1/share-link", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ shareUrl }),
    });
  });

  await page.goto("/tickets", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", {
      name: "Your tickets in one place.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Open map" }).first()).toBeVisible();
  await expect(page.getByPlaceholder("Player or dependent name")).toHaveCount(0);

  await page.getByRole("button", { name: "Add player names" }).click();

  await expect(page.getByPlaceholder("Player or dependent name")).toBeVisible();
  await page.getByRole("button", { name: "Create claim link" }).click();
  await expect(page.locator('input[readonly]').first()).toHaveValue(shareUrl);
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          (window as Window & { __medaClipboard?: string }).__medaClipboard ?? "",
      ),
    )
    .toBe(shareUrl);
});

test("shows clear group payment guidance on Tickets", async ({ page }) => {
  await page.route("**/api/tickets/hub", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildGroupPaymentHubResponse()),
    });
  });

  await page.goto("/tickets", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Group payment: ETB 125 / ETB 1,250")).toBeVisible();
  await expect(
    page.getByText(
      "Important: if time runs out before everyone pays, any money already paid goes back to each person's Meda balance automatically.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Organizer: keeps the group together and can edit members before money starts moving. Members: each person pays their own share before the deadline.",
    ),
  ).toBeVisible();
});
