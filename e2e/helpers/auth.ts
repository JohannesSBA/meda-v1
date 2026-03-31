import type { BrowserContext, Page } from "@playwright/test";

const DEFAULT_E2E_USER = {
  id: "550e8400-e29b-41d4-a716-446655440010",
  email: "e2e-user@example.com",
  name: "E2E User",
  role: "user",
};

export async function setE2EUserCookie(
  context: BrowserContext,
  baseURL: string,
  overrides: Partial<typeof DEFAULT_E2E_USER> = {},
) {
  const user = { ...DEFAULT_E2E_USER, ...overrides };
  const value = Buffer.from(JSON.stringify(user)).toString("base64url");

  await context.addCookies([
    {
      name: "meda_e2e_user",
      value,
      url: baseURL,
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);

  return user;
}

export async function installClipboardStub(page: Page) {
  await page.addInitScript(() => {
    let clipboardValue = "";
    Object.defineProperty(window, "__medaClipboard", {
      configurable: true,
      get: () => clipboardValue,
      set: (value: string) => {
        clipboardValue = value;
      },
    });

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          (window as typeof window & { __medaClipboard?: string }).__medaClipboard =
            value;
        },
        readText: async () =>
          (window as typeof window & { __medaClipboard?: string })
            .__medaClipboard ?? "",
      },
    });
  });
}
