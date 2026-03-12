/**
 * Prisma client -- configured with Neon serverless adapter for serverless deployments.
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getRequiredEnv } from "@/lib/env";

const globalForPrisma = globalThis as typeof globalThis & {
  medaPrisma?: PrismaClient;
  medaPrismaAdapter?: PrismaPg;
};

function createPrismaClient() {
  const connectionString = getRequiredEnv("DATABASE_URL");

  const adapter =
    globalForPrisma.medaPrismaAdapter ??
    new PrismaPg({ connectionString });
  globalForPrisma.medaPrismaAdapter = adapter;

  return new PrismaClient({ adapter });
}

export const prisma =
  globalForPrisma.medaPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.medaPrisma = prisma;
}
