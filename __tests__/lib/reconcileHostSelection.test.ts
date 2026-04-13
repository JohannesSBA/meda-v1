import { describe, expect, it } from "vitest";
import { shouldClearStaleListSelection } from "@/lib/reconcileHostSelection";

describe("shouldClearStaleListSelection", () => {
  it("returns false for empty selection", () => {
    expect(shouldClearStaleListSelection("", ["a", "b"])).toBe(false);
  });

  it("returns false when whitespace-only selection is treated as empty", () => {
    expect(shouldClearStaleListSelection("   ", ["a"])).toBe(false);
  });

  it("returns false when the id is still in the list", () => {
    expect(shouldClearStaleListSelection("cust-1", ["cust-1", "cust-2"])).toBe(false);
  });

  it("returns true when the id is not in the list", () => {
    expect(shouldClearStaleListSelection("gone", ["a", "b"])).toBe(true);
  });

  it("returns true when the list is empty but selection is set", () => {
    expect(shouldClearStaleListSelection("x", [])).toBe(true);
  });
});
