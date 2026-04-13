import { expect, test } from "@playwright/test";
import {
  installClipboardStub,
  setE2EUserCookie,
} from "./helpers/auth";

const EVENT_ID = "550e8400-e29b-41d4-a716-446655440101";

const registeredItem = {
  eventId: EVENT_ID,
  eventName: "Friday Night Match",
  eventDatetime: "2099-04-12T18:00:00.000Z",
  eventEndtime: "2099-04-12T20:00:00.000Z",
  addressLabel: "Megenagna Turf",
  ticketCount: 2,
  heldTicketCount: 2,
  refundableTicketCount: 2,
  refundableAmountEtb: 200,
  priceField: 100,
};

test.beforeEach(async ({ page, context, baseURL }) => {
  await installClipboardStub(page);
  await setE2EUserCookie(context, baseURL!);
});

test("creates and copies a ticket sharing link from the profile dashboard", async ({
  page,
}) => {
  const shareUrl = "http://127.0.0.1:3100/tickets/claim/share-token-123";

  await page.route("**/api/profile/balance", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ balanceEtb: 250 }),
    });
  });

  await page.route("**/api/profile/registered-events**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [registeredItem] }),
    });
  });

  await page.route("**/api/tickets/share/create", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ shareUrl }),
    });
  });

  await page.goto("/profile", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Friday Night Match")).toBeVisible();
  await page.getByRole("button", { name: "Share ticket" }).click();

  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          (window as Window & { __medaClipboard?: string }).__medaClipboard ??
          "",
      ),
    )
    .toBe(shareUrl);
});

test("refunds tickets from the profile dashboard and refreshes the list", async ({
  page,
}) => {
  let refunded = false;

  await page.route("**/api/profile/balance", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ balanceEtb: refunded ? 400 : 200 }),
    });
  });

  await page.route("**/api/profile/registered-events**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: refunded ? [] : [registeredItem] }),
    });
  });

  await page.route("**/api/events/**/refund", async (route) => {
    refunded = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        amountEtb: 200,
        ticketCount: 2,
      }),
    });
  });

  await page.goto("/profile", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Friday Night Match")).toBeVisible();
  await page.getByRole("button", { name: "Refund" }).click();
  await expect(
    page.getByRole("dialog", { name: "Refund tickets?" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Refund tickets" }).click();

  await expect(
    page
      .getByText("Refund processed. ETB 200 credited to your balance.")
      .first(),
  ).toBeVisible();
  await expect(page.getByText("No tickets yet")).toBeVisible();
});
