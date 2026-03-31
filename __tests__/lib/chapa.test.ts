import { beforeEach, describe, expect, it, vi } from "vitest";

const axiosGetMock = vi.fn();
const axiosPostMock = vi.fn();
const chapaCtorMock = vi.fn();

vi.mock("axios", () => ({
  default: {
    get: axiosGetMock,
    post: axiosPostMock,
  },
}));

vi.mock("chapa-nodejs", () => ({
  Chapa: chapaCtorMock,
}));

describe("chapa helpers", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = {
      ...ORIGINAL_ENV,
      CHAPA_SECRET_KEY: "CHASECK_TEST-123",
    };
  });

  it("supports the documented and observed Chapa response shapes", async () => {
    const { extractChapaSubaccountId } = await import("@/lib/chapa");

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

  it("returns null when no subaccount identifier is present", async () => {
    const { extractChapaSubaccountId } = await import("@/lib/chapa");
    expect(extractChapaSubaccountId({ data: { message: "ok" } })).toBeNull();
  });

  it("builds the Chapa client and detects live mode from the secret key", async () => {
    const { getChapaClient, isChapaLiveMode } = await import("@/lib/chapa");

    chapaCtorMock.mockImplementation(function (this: { args?: unknown }, args) {
      this.args = args;
    });

    expect(getChapaClient()).toMatchObject({
      args: { secretKey: "CHASECK_TEST-123" },
    });
    expect(isChapaLiveMode()).toBe(false);

    vi.resetModules();
    process.env.CHAPA_SECRET_KEY = "CHASECK_LIVE-123";
    const liveMod = await import("@/lib/chapa");
    expect(liveMod.isChapaLiveMode()).toBe(true);
  });

  it("lists and normalizes bank records from multiple response shapes", async () => {
    axiosGetMock.mockResolvedValueOnce({
      data: {
        data: [
          { bank_code: " 01 ", name: "Bank A" },
          { code: "02", bank_name: "Bank B" },
          { id: 3, name: "Bank C" },
          { name: "Missing code" },
        ],
      },
    });

    const { listChapaBanks } = await import("@/lib/chapa");
    await expect(listChapaBanks()).resolves.toEqual([
      { code: "01", name: "Bank A" },
      { code: "02", name: "Bank B" },
      { code: "3", name: "Bank C" },
    ]);
  });

  it("posts subaccount, transaction, and transfer payloads with auth headers", async () => {
    axiosPostMock
      .mockResolvedValueOnce({ data: { subaccount_id: "sub-1" } })
      .mockResolvedValueOnce({ data: { status: "success" } })
      .mockResolvedValueOnce({ data: { status: "success" } });

    const {
      createChapaSubaccount,
      createChapaTransfer,
      initializeChapaTransaction,
    } = await import("@/lib/chapa");

    await createChapaSubaccount({
      accountName: "Meda Host",
      accountNumber: "1234567890",
      bankCode: "01",
      businessName: "Meda Host",
      splitType: "percentage",
      splitValue: 0.05,
    });
    await initializeChapaTransaction({
      first_name: "Meda",
      last_name: "User",
      email: "user@example.com",
      currency: "ETB",
      amount: "100.00",
      tx_ref: "tx-1",
      callback_url: "https://meda.test/callback",
      return_url: "https://meda.test/return",
    });
    await createChapaTransfer({
      account_name: "Meda Host",
      account_number: "1234567890",
      amount: "100.00",
      currency: "ETB",
      beneficiary_name: "Meda Host",
      reference: "payout-1",
      bank_code: "01",
      callback_url: "https://meda.test/payout-callback",
    });

    expect(axiosPostMock).toHaveBeenCalledTimes(3);
    expect(axiosPostMock).toHaveBeenCalledWith(
      expect.stringContaining("/subaccount"),
      expect.objectContaining({ account_name: "Meda Host" }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer CHASECK_TEST-123",
        }),
      }),
    );
  });

  it("verifies transactions with retries until success", async () => {
    axiosGetMock
      .mockResolvedValueOnce({ data: { data: { status: "pending" } } })
      .mockResolvedValueOnce({ data: { data: { status: "success", tx_ref: "tx-1" } } });
    const setTimeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(
        (((fn: (...args: unknown[]) => void) => {
          fn();
          return 0 as never;
        }) as unknown) as typeof setTimeout,
      );

    const { verifyChapaTransaction, verifyChapaTransactionWithRetry } = await import(
      "@/lib/chapa"
    );

    await expect(verifyChapaTransaction("tx-1")).resolves.toEqual({
      data: { status: "pending" },
    });
    await expect(verifyChapaTransactionWithRetry("tx-1")).resolves.toEqual({
      data: { status: "success", tx_ref: "tx-1" },
    });

    setTimeoutSpy.mockRestore();
  });
});
