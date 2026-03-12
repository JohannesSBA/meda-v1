import { expect, test } from "@playwright/test";

test("verifies a scanned ticket through the E2E harness", async ({ page }) => {
  let postedEventId = "";

  await page.route("**/api/tickets/verify/**", async (route) => {
    const payload = route.request().postDataJSON() as { eventId?: string };
    postedEventId = payload.eventId ?? "";

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        valid: true,
        attendeeName: "Mesay Bekele",
        eventName: "Sunrise Kickoff",
      }),
    });
  });

  await page.goto("/e2e/scan");
  await page.getByRole("button", { name: "Verify token" }).click();

  await expect(page.getByTestId("scan-harness-result")).toContainText(
    "Ticket verified",
  );
  await expect(page.getByTestId("scan-harness-result")).toContainText(
    "Mesay Bekele",
  );
  await expect
    .poll(() => Promise.resolve(postedEventId))
    .toBe("550e8400-e29b-41d4-a716-446655440000");
});
