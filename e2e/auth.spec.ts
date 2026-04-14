import { expect, test } from "@playwright/test";
import { setE2EUserCookie } from "./helpers/auth";

test("redirects unauthenticated users away from create-events", async ({ page }) => {
  await page.goto("/create-events", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/auth\/sign-in\?redirect=%2Fcreate-events/);
});

test("redirects unauthenticated users away from profile", async ({ page }) => {
  await page.goto("/profile", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/auth\/sign-in\?redirect=%2Fprofile/);
});

test("redirects unauthenticated users away from admin", async ({ page }) => {
  await page.goto("/admin", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/auth\/sign-in\?redirect=%2Fadmin/);
});

test("redirects unauthenticated users away from slot booking under /play/slots", async ({
  page,
}) => {
  await page.goto("/play/slots/550e8400-e29b-41d4-a716-446655440000", {
    waitUntil: "domcontentloaded",
  });

  await expect(page).toHaveURL(
    /\/auth\/sign-in\?redirect=%2Fplay%2Fslots%2F550e8400-e29b-41d4-a716-446655440000/,
  );
});

test("preserves e2e auth bypass for protected routes when cookie is present", async ({
  context,
  page,
  baseURL,
}) => {
  await setE2EUserCookie(context, baseURL!);

  await page.goto("/profile", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/profile/);
  await expect(page).not.toHaveURL(/\/auth\/sign-in/);
});
