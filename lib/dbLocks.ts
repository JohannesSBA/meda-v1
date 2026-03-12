import type { Prisma } from "@/generated/prisma/client";

type TransactionClient = Prisma.TransactionClient;

export async function acquireTransactionLock(
  tx: TransactionClient,
  namespace: string,
  key: string,
) {
  if (typeof tx.$queryRaw !== "function") {
    return;
  }

  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(
      hashtext(${namespace}),
      hashtext(${key})
    )
  `;
}
