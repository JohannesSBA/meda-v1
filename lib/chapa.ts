import axios from "axios";
import { Chapa } from "chapa-nodejs";
import { getRequiredEnv } from "@/lib/env";

const CHAPA_API_BASE_URL = "https://api.chapa.co/v1";
const CHAPA_VERIFY_RETRY_DELAYS_MS = [0, 2000, 4000, 6000];
const CHAPA_VERIFY_MAX_ATTEMPTS = 4;

type ChapaListResponse<T> = {
  data?: T[] | { data?: T[] } | null;
  banks?: T[] | null;
};

type ChapaBankRecord = {
  id?: string | number | null;
  bank_code?: string | number | null;
  code?: string | number | null;
  name?: string | null;
  bank_name?: string | null;
};

export type ChapaBank = {
  code: string;
  name: string;
};

export type CreateChapaSubaccountInput = {
  accountName: string;
  accountNumber: string;
  bankCode: string;
  businessName: string;
  splitType: "percentage" | "flat";
  splitValue: number;
};

export type ChapaInitializePayload = {
  first_name: string;
  last_name: string;
  email: string;
  currency: string;
  amount: string;
  tx_ref: string;
  callback_url: string;
  return_url: string;
  customization?: {
    title?: string;
    description?: string;
  };
  subaccounts?: {
    id: string;
    split_type?: string;
    split_value?: number;
  };
};

export type ChapaInitializeResponse = {
  status?: string;
  message?: unknown;
  data?: {
    checkout_url?: string;
    [key: string]: unknown;
  };
};

export type ChapaVerification = {
  status?: string;
  message?: unknown;
  data?: {
    status?: string;
    tx_ref?: string;
    amount?: string | number;
    currency?: string;
  };
};

export function getChapaSecretKey() {
  return getRequiredEnv("CHAPA_SECRET_KEY");
}

export function getChapaClient() {
  return new Chapa({ secretKey: getChapaSecretKey() });
}

export function isChapaLiveMode() {
  return getChapaSecretKey().toUpperCase().startsWith("CHASECK_LIVE-");
}

function getChapaHeaders() {
  return {
    Authorization: `Bearer ${getChapaSecretKey()}`,
    "Content-Type": "application/json",
  };
}

export async function listChapaBanks() {
  const response = await axios.get<ChapaListResponse<ChapaBankRecord>>(
    `${CHAPA_API_BASE_URL}/banks`,
    {
      headers: {
        Authorization: `Bearer ${getChapaSecretKey()}`,
      },
      timeout: 15000,
    },
  );

  const body = response.data;
  const rawBanks =
    (Array.isArray(body?.data)
      ? body.data
      : Array.isArray(body?.data?.data)
        ? body.data.data
        : Array.isArray(body?.banks)
          ? body.banks
          : []) ?? [];

  return rawBanks
    .map((bank) => {
      const code = String(bank.bank_code ?? bank.code ?? bank.id ?? "").trim();
      const name = String(bank.name ?? bank.bank_name ?? "").trim();
      if (!code || !name) return null;
      return { code, name } satisfies ChapaBank;
    })
    .filter((bank): bank is ChapaBank => bank !== null)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function createChapaSubaccount(
  input: CreateChapaSubaccountInput,
) {
  const response = await axios.post(
    `${CHAPA_API_BASE_URL}/subaccount`,
    {
      account_name: input.accountName,
      account_number: input.accountNumber,
      bank_code: input.bankCode,
      business_name: input.businessName,
      split_type: input.splitType,
      split_value: input.splitValue,
    },
    {
      headers: getChapaHeaders(),
      timeout: 15000,
    },
  );

  return response.data;
}

export async function initializeChapaTransaction(
  payload: ChapaInitializePayload,
) {
  const response = await axios.post<ChapaInitializeResponse>(
    `${CHAPA_API_BASE_URL}/transaction/initialize`,
    payload,
    {
      headers: getChapaHeaders(),
      timeout: 15000,
    },
  );

  return response.data;
}

export async function verifyChapaTransaction(txRef: string) {
  const response = await axios.get<ChapaVerification>(
    `${CHAPA_API_BASE_URL}/transaction/verify/${encodeURIComponent(txRef)}`,
    {
      headers: {
        Authorization: `Bearer ${getChapaSecretKey()}`,
      },
      timeout: 15000,
    },
  );

  return response.data;
}

export async function verifyChapaTransactionWithRetry(txRef: string) {
  let lastVerification: ChapaVerification | null = null;

  for (let attempt = 0; attempt < CHAPA_VERIFY_MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      const delayMs = CHAPA_VERIFY_RETRY_DELAYS_MS[attempt] ?? 6000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    const verification = await verifyChapaTransaction(txRef);
    lastVerification = verification;
    const paidStatus = verification.data?.status?.toLowerCase();
    if (paidStatus === "success") {
      return verification;
    }
    if (paidStatus === "failed") {
      break;
    }
  }

  if (!lastVerification) {
    throw new Error("Chapa verify failed: empty response");
  }

  return lastVerification;
}

function readRecordValue(
  record: Record<string, unknown> | null | undefined,
  key: string,
) {
  if (!record) return null;
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNestedId(
  record: Record<string, unknown> | null | undefined,
  key: string,
) {
  if (!record) return null;
  const nested = record[key];
  if (!nested || typeof nested !== "object") return null;
  const value = (nested as Record<string, unknown>).id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function extractChapaSubaccountId(payload: unknown) {
  if (typeof payload === "string" && payload.trim()) {
    return payload.trim();
  }

  const record =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : null;
  const data =
    record?.data && typeof record.data === "object"
      ? (record.data as Record<string, unknown>)
      : typeof record?.data === "string"
        ? record.data.trim()
        : null;

  const candidates = [
    typeof data === "string" ? data : null,
    readRecordValue(record, "subaccount_id"),
    readRecordValue(record, "subaccounts[id]"),
    readRecordValue(record, "id"),
    readNestedId(record, "subaccounts"),
    typeof data === "object" ? readRecordValue(data, "subaccount_id") : null,
    typeof data === "object" ? readRecordValue(data, "subaccounts[id]") : null,
    typeof data === "object" ? readRecordValue(data, "id") : null,
    typeof data === "object" ? readNestedId(data, "subaccounts") : null,
  ];

  return candidates.find((candidate) => typeof candidate === "string" && candidate.trim()) ?? null;
}
