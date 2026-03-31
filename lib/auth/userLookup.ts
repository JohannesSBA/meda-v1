import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const ALLOWED_SCHEMAS = ["neon_auth", "public"];
const ALLOWED_TABLES = ["user"];

export type AuthUser = { id: string; email: string | null; name: string | null };

/**
 * Looks up auth users by their IDs using the Neon Auth user table.
 * Returns a map from user ID to AuthUser (only users with an email).
 */
export async function getAuthUserEmails(
  userIds: string[],
): Promise<Map<string, AuthUser>> {
  const map = new Map<string, AuthUser>();
  if (userIds.length === 0) return map;

  const schema =
    process.env.AUTH_SCHEMA && ALLOWED_SCHEMAS.includes(process.env.AUTH_SCHEMA)
      ? process.env.AUTH_SCHEMA
      : "neon_auth";
  const table =
    process.env.AUTH_USER_TABLE && ALLOWED_TABLES.includes(process.env.AUTH_USER_TABLE)
      ? process.env.AUTH_USER_TABLE
      : "user";

  try {
    const qualifiedTable = `"${schema}"."${table}"`;
    const rows = await prisma.$queryRawUnsafe<AuthUser[]>(
      `SELECT id, email, name FROM ${qualifiedTable} WHERE id = ANY($1::uuid[]) AND email IS NOT NULL`,
      userIds,
    );
    for (const row of rows ?? []) {
      if (row.email) map.set(row.id, row);
    }
  } catch (err) {
    logger.error("Failed to fetch auth users", err);
  }
  return map;
}

export async function getAuthUserByEmail(
  email: string,
): Promise<AuthUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;

  const schema =
    process.env.AUTH_SCHEMA && ALLOWED_SCHEMAS.includes(process.env.AUTH_SCHEMA)
      ? process.env.AUTH_SCHEMA
      : "neon_auth";
  const table =
    process.env.AUTH_USER_TABLE && ALLOWED_TABLES.includes(process.env.AUTH_USER_TABLE)
      ? process.env.AUTH_USER_TABLE
      : "user";

  try {
    const qualifiedTable = `"${schema}"."${table}"`;
    const rows = await prisma.$queryRawUnsafe<AuthUser[]>(
      `SELECT id, email, name FROM ${qualifiedTable} WHERE lower(email) = $1 LIMIT 1`,
      normalizedEmail,
    );
    return rows?.[0] ?? null;
  } catch (err) {
    logger.error("Failed to fetch auth user by email", err);
    return null;
  }
}
