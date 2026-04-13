import { decryptPayoutValue, maskAccountNumber } from "@/lib/encryption";
import { logger } from "@/lib/logger";

export const PAYOUT_REVERIFICATION_REQUIRED_MESSAGE =
  "Your saved payout details can no longer be read with the current encryption key. Re-enter and verify them again.";

type ReadPitchOwnerPayoutCredentialsArgs = {
  ownerId: string;
  accountNameEnc?: string | null;
  accountNumberEnc?: string | null;
  bankCodeEnc?: string | null;
  context: string;
};

export type ReadPitchOwnerPayoutCredentialsResult = {
  accountName: string | null;
  accountNumber: string | null;
  accountNumberLast4: string | null;
  accountNumberMasked: string | null;
  bankCode: string | null;
  payoutSetupIssue: string | null;
};

export function readPitchOwnerPayoutCredentials(
  args: ReadPitchOwnerPayoutCredentialsArgs,
): ReadPitchOwnerPayoutCredentialsResult {
  const failures: Array<{ field: string; message: string }> = [];

  const decryptField = (
    field: "accountNameEnc" | "accountNumberEnc" | "bankCodeEnc",
    value: string | null | undefined,
  ) => {
    if (!value) return null;

    try {
      return decryptPayoutValue(value);
    } catch (error) {
      failures.push({
        field,
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  };

  const accountName = decryptField("accountNameEnc", args.accountNameEnc);
  const accountNumber = decryptField("accountNumberEnc", args.accountNumberEnc);
  const bankCode = decryptField("bankCodeEnc", args.bankCodeEnc);

  if (failures.length > 0) {
    logger.error("Failed to decrypt pitch owner payout credentials", {
      ownerId: args.ownerId,
      context: args.context,
      failures,
    });
  }

  return {
    accountName,
    accountNumber,
    accountNumberLast4: accountNumber ? accountNumber.slice(-4) : null,
    accountNumberMasked: maskAccountNumber(accountNumber),
    bankCode,
    payoutSetupIssue:
      failures.length > 0 ? PAYOUT_REVERIFICATION_REQUIRED_MESSAGE : null,
  };
}
