import { describe, expect, it } from "vitest";
import { getCustomerProfileDetailHeaderCopy } from "@/lib/hostSplitPaneCopy";

describe("getCustomerProfileDetailHeaderCopy", () => {
  it("returns filtered-empty messaging when the master list is empty", () => {
    const copy = getCustomerProfileDetailHeaderCopy({
      listEmpty: true,
      selectedCustomer: null,
    });
    expect(copy.title).toContain("Nothing");
    expect(copy.description).toMatch(/filters/i);
  });

  it("returns idle messaging when the list has rows but nothing is selected", () => {
    const copy = getCustomerProfileDetailHeaderCopy({
      listEmpty: false,
      selectedCustomer: null,
    });
    expect(copy.title).toMatch(/Choose/);
    expect(copy.description).toMatch(/Select a row/i);
  });

  it("returns the selected customer name and email when present", () => {
    const copy = getCustomerProfileDetailHeaderCopy({
      listEmpty: false,
      selectedCustomer: {
        customerName: "Alex",
        customerEmail: "alex@example.com",
      },
    });
    expect(copy.title).toBe("Alex");
    expect(copy.description).toBe("alex@example.com");
  });

  it("falls back when email is missing", () => {
    const copy = getCustomerProfileDetailHeaderCopy({
      listEmpty: false,
      selectedCustomer: {
        customerName: "Alex",
        customerEmail: null,
      },
    });
    expect(copy.description).toMatch(/No email/);
  });
});
