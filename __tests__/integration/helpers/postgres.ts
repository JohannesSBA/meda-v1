import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { GenericContainer, Wait } from "testcontainers";
import type { PrismaClient } from "@/generated/prisma/client";

const ROOT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

type StartedContainer = Awaited<ReturnType<GenericContainer["start"]>>;

type StartedIntegrationDatabase =
  | {
      available: true;
      container: StartedContainer;
      databaseUrl: string;
    }
  | {
      available: false;
      reason: string;
    };

export async function resetPrismaGlobals() {
  const globalForPrisma = globalThis as typeof globalThis & {
    medaPrisma?: { $disconnect: () => Promise<void> };
    medaPrismaAdapter?: unknown;
  };

  try {
    await globalForPrisma.medaPrisma?.$disconnect();
  } catch {
    // Best effort for test cleanup.
  }

  delete globalForPrisma.medaPrisma;
  delete globalForPrisma.medaPrismaAdapter;
}

export async function startIntegrationDatabase(): Promise<StartedIntegrationDatabase> {
  try {
    const container = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({
        POSTGRES_DB: "meda_test",
        POSTGRES_USER: "postgres",
        POSTGRES_PASSWORD: "postgres",
      })
      .withExposedPorts(5432)
      .withWaitStrategy(
        Wait.forLogMessage("database system is ready to accept connections", 2),
      )
      .start();

    const databaseUrl = `postgresql://postgres:postgres@${container.getHost()}:${container.getMappedPort(5432)}/meda_test`;

    process.env.DATABASE_URL = databaseUrl;
    process.env.NEON_AUTH_BASE_URL ??= "https://example.com";
    process.env.NEON_AUTH_COOKIE_SECRET ??= "integration-cookie-secret";
    process.env.NEXT_PUBLIC_BASE_URL ??= "http://127.0.0.1:3100";
    process.env.CHAPA_SECRET_KEY ??= "integration-chapa-secret";

    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      cwd: ROOT_DIR,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
      stdio: "pipe",
    });

    await resetPrismaGlobals();

    return { available: true, container, databaseUrl };
  } catch (error) {
    await resetPrismaGlobals();
    return {
      available: false,
      reason: error instanceof Error ? error.message : "Container runtime unavailable",
    };
  }
}

export async function stopIntegrationDatabase(container?: StartedContainer | null) {
  await resetPrismaGlobals();
  if (container) {
    await container.stop();
  }
}

export async function getIntegrationPrisma(): Promise<PrismaClient> {
  const { prisma } = await import("@/lib/prisma");
  return prisma;
}

export async function resetDatabase(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      invitation_claims,
      invitations,
      ticket_scan,
      refunds,
      payments,
      saved_events,
      event_waitlist,
      eventattendees,
      events,
      categories,
      user_balances
    RESTART IDENTITY CASCADE
  `);
}
