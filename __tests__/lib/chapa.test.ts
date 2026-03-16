import { describe, expect, it } from "vitest";
import { extractChapaSubaccountId } from "@/lib/chapa";

describe("extractChapaSubaccountId", () => {
  it("supports the documented and observed Chapa response shapes", () => {
    expect(
      extractChapaSubaccountId({ data: { subaccount_id: "sub-1" } }),
    ).toBe("sub-1");
    expect(
      extractChapaSubaccountId({ data: { "subaccounts[id]": "sub-2" } }),
    ).toBe("sub-2");
    expect(
      extractChapaSubaccountId({ data: { id: "sub-3" } }),
    ).toBe("sub-3");
    expect(
      extractChapaSubaccountId({ data: { subaccounts: { id: "sub-4" } } }),
    ).toBe("sub-4");
    expect(extractChapaSubaccountId({ data: "sub-5" })).toBe("sub-5");
  });

  it("returns null when no subaccount identifier is present", () => {
    expect(extractChapaSubaccountId({ data: { message: "ok" } })).toBeNull();
  });
});
