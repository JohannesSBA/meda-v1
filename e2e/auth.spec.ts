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
