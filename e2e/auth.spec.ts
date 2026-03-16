import { expect, test } from "@playwright/test";

test("redirects unauthenticated users away from create-events", async ({
  page,
}) => {
  await page.goto("/create-events", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/auth\/sign-in\?redirect=%2Fcreate-events/);
});
