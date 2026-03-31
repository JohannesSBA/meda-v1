import { expect, test } from "@playwright/test";

const EVENT_ID = "550e8400-e29b-41d4-a716-446655440000";

test("confirms checkout status on the payment return screen", async ({
  page,
}) => {
  await page.route("**/api/payments/chapa/confirm", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ quantity: 2 }),
    });
  });

  await page.goto(`/payments/chapa/status?eventId=${EVENT_ID}&tx_ref=MEDA-TX-123`, {
    waitUntil: "domcontentloaded",
  });

  await expect(
    page.getByRole("heading", { name: "Payment confirmed" }),
  ).toBeVisible();
  await expect(
    page.getByText("Your payment was confirmed and 2 tickets were issued."),
  ).toBeVisible();
});
