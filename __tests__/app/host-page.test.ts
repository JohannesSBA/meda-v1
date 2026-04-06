import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";

const mockRedirect = vi.fn();
const mockGetSession = vi.fn();
const mockNormalizeAppUserRole = vi.fn();
const mockGetCategories = vi.fn();
const mockGetCurrentOwnerSubscription = vi.fn();
const mockListOwnerPitches = vi.fn();
const mockOwnerOperationsWorkspace = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children?: ReactNode;
    [key: string]: unknown;
  }) => createElement("a", { href, ...props }, children),
}));

vi.mock("@/lib/auth/server", () => ({
  auth: {
    getSession: mockGetSession,
  },
}));

vi.mock("@/lib/auth/roles", () => ({
  normalizeAppUserRole: mockNormalizeAppUserRole,
}));

vi.mock("@/lib/data/categories", () => ({
  getCategories: mockGetCategories,
}));

vi.mock("@/services/subscriptions", () => ({
  getCurrentOwnerSubscription: mockGetCurrentOwnerSubscription,
}));

vi.mock("@/services/pitches", () => ({
  listOwnerPitches: mockListOwnerPitches,
}));

vi.mock("@/app/components/owner/OwnerOperationsWorkspace", () => ({
  OwnerOperationsWorkspace: mockOwnerOperationsWorkspace,
}));

vi.mock("@/app/components/owner/OwnerDashboardWorkspace", () => ({
  OwnerDashboardWorkspace: () => createElement("div", { "data-owner-dashboard": "true" }),
}));

vi.mock("@/app/components/ui/page-shell", () => ({
  PageShell: ({ children }: { children: ReactNode }) => createElement("main", null, children),
}));

vi.mock("@/app/components/ui/primitives", () => ({
  Stack: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));

vi.mock("@/app/components/ui/app-page-header", () => ({
  AppPageHeader: () => createElement("header"),
}));

vi.mock("@/app/components/ui/app-section-card", () => ({
  AppSectionCard: ({ children }: { children: ReactNode }) =>
    createElement("section", null, children),
}));

vi.mock("@/app/components/ui/inline-status-banner", () => ({
  InlineStatusBanner: () => createElement("div", { "data-banner": "true" }),
}));

vi.mock("@/app/components/ui/button", () => ({
  buttonVariants: () => "button",
}));

vi.mock("@/app/components/ui/cn", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" "),
}));

async function renderHostPage(view?: string) {
  const HostPage = (await import("@/app/host/page")).default;
  const element = await HostPage({
    searchParams: Promise.resolve(view ? { view } : {}),
  });

  return renderToStaticMarkup(element);
}

describe("HostPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetSession.mockResolvedValue({
      data: {
        user: {
          id: "owner-1",
          role: "pitch_owner",
        },
      },
    });
    mockNormalizeAppUserRole.mockReturnValue("pitch_owner");
    mockGetCategories.mockResolvedValue([]);
    mockGetCurrentOwnerSubscription.mockResolvedValue({
      entitlementActive: true,
      gracePeriodActive: false,
      daysRemaining: 30,
    });
    mockListOwnerPitches.mockResolvedValue([]);
    mockOwnerOperationsWorkspace.mockImplementation(
      ({ initialView }: { initialView: "calendar" | "places" }) =>
        createElement("div", { "data-owner-view": initialView }),
    );
  });

  it("renders the places workspace when view=places", async () => {
    const html = await renderHostPage("places");

    expect(html).toContain('data-owner-view="places"');
    expect(mockOwnerOperationsWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ initialView: "places" }),
      undefined,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("renders the dedicated calendar workspace when view=calendar", async () => {
    const html = await renderHostPage("calendar");

    expect(html).toContain('data-owner-view="calendar"');
    expect(mockOwnerOperationsWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ initialView: "calendar" }),
      undefined,
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
