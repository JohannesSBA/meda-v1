/**
 * Prisma client -- configured with Neon serverless adapter for serverless deployments.
 */

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getRequiredEnv } from "@/lib/env";

const globalForPrisma = globalThis as typeof globalThis & {
  medaPrisma?: PrismaClient;
  medaPrismaAdapter?: PrismaPg;
  medaPrismaMigrationCheck?: Promise<void>;
  medaPrismaMigrationWarningShown?: boolean;
};

function createPrismaClient() {
  const connectionString = getRequiredEnv("DATABASE_URL");

  const adapter =
    globalForPrisma.medaPrismaAdapter ??
    new PrismaPg({ connectionString });
  globalForPrisma.medaPrismaAdapter = adapter;

  return new PrismaClient({ adapter });
}

function getPrismaClient() {
  if (process.env.NODE_ENV !== "production") {
    const previousClient = globalForPrisma.medaPrisma;
    const nextClient = createPrismaClient();

    // Recreate the client on dev reloads so schema/client changes do not keep
    // using a stale Prisma instance from global state.
    globalForPrisma.medaPrisma = nextClient;

    if (previousClient && previousClient !== nextClient) {
      void previousClient.$disconnect().catch(() => undefined);
    }

    return nextClient;
  }

  return globalForPrisma.medaPrisma ?? createPrismaClient();
}

export const prisma = getPrismaClient();

async function warnIfPendingMigrations(client: PrismaClient) {
  if (process.env.NODE_ENV === "production") return;
  if (process.env.MEDA_SKIP_MIGRATION_WARNING === "1") return;
  if (globalForPrisma.medaPrismaMigrationCheck) {
    await globalForPrisma.medaPrismaMigrationCheck;
    return;
  }

  globalForPrisma.medaPrismaMigrationCheck = (async () => {
    try {
      const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
      if (!fs.existsSync(migrationsDir)) return;

      const filesystemMigrations = fs
        .readdirSync(migrationsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();

      if (filesystemMigrations.length === 0) return;

      const appliedRows = await client.$queryRawUnsafe<Array<{ migration_name: string }>>(
        'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY finished_at ASC',
      );
      const appliedMigrationNames = new Set(
        (appliedRows ?? []).map((row) => row.migration_name),
      );
      const pendingMigrations = filesystemMigrations.filter(
        (migrationName) => !appliedMigrationNames.has(migrationName),
      );

      if (
        pendingMigrations.length > 0 &&
        !globalForPrisma.medaPrismaMigrationWarningShown
      ) {
        globalForPrisma.medaPrismaMigrationWarningShown = true;
        console.warn(
          `[prisma] Pending database migrations detected. Run "npm run prisma:migrate:deploy" before relying on new schema paths. Missing: ${pendingMigrations.join(", ")}`,
        );
      }
    } catch {
      // Ignore migration introspection failures in dev. Runtime queries will still fail loudly.
    }
  })();

  await globalForPrisma.medaPrismaMigrationCheck;
}

if (process.env.NODE_ENV === "production") {
  globalForPrisma.medaPrisma = prisma;
} else {
  void warnIfPendingMigrations(prisma);
}
