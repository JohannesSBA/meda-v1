import { expect, test } from "@playwright/test";
import { installClipboardStub, setE2EUserCookie } from "./helpers/auth";

const slotsPayload = {
  slots: [
    {
      id: "slot-1",
      pitchId: "pitch-1",
      pitchName: "Gergi Football",
      addressLabel: "Bole Atlas, Addis Ababa",
      latitude: 8.997,
      longitude: 38.786,
      categoryName: "Soccer",
      startsAt: "2099-04-12T08:00:00.000Z",
      endsAt: "2099-04-12T10:00:00.000Z",
      capacity: 10,
      price: 110,
      currency: "ETB",
      productType: "DAILY",
      status: "OPEN",
      requiresParty: false,
      notes: "Bring boots if you have them.",
      bookingCount: 1,
      soldQuantity: 2,
      remainingCapacity: 8,
    },
    {
      id: "slot-2",
      pitchId: "pitch-1",
      pitchName: "Gergi Football",
      addressLabel: "Bole Atlas, Addis Ababa",
      latitude: 8.997,
      longitude: 38.786,
      categoryName: "Soccer",
      startsAt: "2099-04-12T10:00:00.000Z",
      endsAt: "2099-04-12T12:00:00.000Z",
      capacity: 10,
      price: 110,
      currency: "ETB",
      productType: "DAILY",
      status: "OPEN",
      requiresParty: false,
      notes: "Bring boots if you have them.",
      bookingCount: 1,
      soldQuantity: 0,
      remainingCapacity: 10,
    },
  ],
};

test.beforeEach(async ({ page, context, baseURL }) => {
  await installClipboardStub(page);
  await setE2EUserCookie(context, baseURL!);

  await page.route("**/api/profile/balance", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ balanceEtb: 500 }),
    });
  });

  await page.route("**/api/slots*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(slotsPayload),
    });
  });

  await page.route("**/api/parties", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ parties: [] }),
    });
  });
});

test("shows grouped slot offers and opens the map modal from Play", async ({ page }) => {
  await page.goto("/play", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", {
      name: "Find somewhere to play, or join a match that is already happening.",
    }),
  ).toBeVisible();
  await expect(page.getByText("Gergi Football").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "See places on map" })).toBeVisible();

  await page.getByRole("button", { name: "See places on map" }).click();

  await expect(
    page.getByRole("heading", { name: "See which places are closest to you" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Close", exact: true })).toBeVisible();
});

test("updates the booking summary when a different 2-hour time is chosen", async ({ page }) => {
  await page.goto("/play", { waitUntil: "domcontentloaded" });

  const timeButtons = page
    .locator("button")
    .filter({ hasText: /^\d{1,2}:\d{2} (AM|PM) - \d{1,2}:\d{2} (AM|PM)$/ });
  const summaryCard = page
    .getByRole("heading", { name: "Reserve this time" })
    .locator("..")
    .locator("..");

  await expect(timeButtons).toHaveCount(2);

  const firstTimeLabel = (await timeButtons.nth(0).textContent())?.trim();
  const secondTimeLabel = (await timeButtons.nth(1).textContent())?.trim();

  expect(firstTimeLabel).toBeTruthy();
  expect(secondTimeLabel).toBeTruthy();
  expect(secondTimeLabel).not.toBe(firstTimeLabel);

  await expect(summaryCard).toContainText("8 spaces remain");
  await timeButtons.nth(1).click();
  await expect(summaryCard).toContainText("10 spaces remain");
});
