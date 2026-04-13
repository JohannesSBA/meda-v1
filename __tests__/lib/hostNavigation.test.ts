import { describe, expect, it } from "vitest";
import {
  hostFabTarget,
  hostPrimaryHeaderCta,
  hostTeamProfileHref,
  hostViewHref,
  parseHostViewParam,
} from "@/lib/hostNavigation";

describe("hostNavigation", () => {
  it("parseHostViewParam defaults unknown values to overview", () => {
    expect(parseHostViewParam(undefined)).toBe("overview");
    expect(parseHostViewParam("")).toBe("overview");
    expect(parseHostViewParam("nope")).toBe("overview");
  });

  it("parseHostViewParam accepts analytics and other known views", () => {
    expect(parseHostViewParam("analytics")).toBe("analytics");
    expect(parseHostViewParam("money")).toBe("money");
  });

  it("hostViewHref builds query URLs", () => {
    expect(hostViewHref("bookings")).toBe("/host?view=bookings");
  });

  it("hostTeamProfileHref points at profile hash for Team nav", () => {
    expect(hostTeamProfileHref()).toBe("/profile#host-facilitators");
  });

  it("hostPrimaryHeaderCta promotes Events from overview and returns from Events views", () => {
    expect(hostPrimaryHeaderCta("overview")).toEqual({
      href: "/host?view=calendar",
      label: "Open Events",
    });
    expect(hostPrimaryHeaderCta("calendar")).toEqual({
      href: "/host?view=overview",
      label: "Overview",
    });
    expect(hostPrimaryHeaderCta("bookings").label).toBe("Overview");
  });

  it("hostFabTarget switches between calendar and places on Events views", () => {
    expect(hostFabTarget("calendar").href).toBe("/host?view=places");
    expect(hostFabTarget("places").href).toBe("/host?view=calendar");
    expect(hostFabTarget("overview").href).toBe("/host?view=calendar");
  });
});
