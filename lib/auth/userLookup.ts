import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const ALLOWED_SCHEMAS = ["neon_auth", "public"];
const ALLOWED_TABLES = ["user"];

export type AuthUser = { id: string; email: string | null; name: string | null };

/** Public host row from the auth user table (image omitted if the column is absent). */
export type AuthUserPublicProfile = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
};

function authUserTableQualifiedName() {
  const schema =
    process.env.AUTH_SCHEMA && ALLOWED_SCHEMAS.includes(process.env.AUTH_SCHEMA)
      ? process.env.AUTH_SCHEMA
      : "neon_auth";
  const table =
    process.env.AUTH_USER_TABLE && ALLOWED_TABLES.includes(process.env.AUTH_USER_TABLE)
      ? process.env.AUTH_USER_TABLE
      : "user";
  return `"${schema}"."${table}"`;
}

/**
 * Batch-load auth users for public host display (name, optional avatar image).
 * Does not require email to be present. Image is omitted when the auth table has no `image` column.
 */
export async function getAuthUserPublicProfiles(
  userIds: string[],
): Promise<Map<string, AuthUserPublicProfile>> {
  const map = new Map<string, AuthUserPublicProfile>();
  if (userIds.length === 0) return map;

  const unique = [...new Set(userIds)];
  const qualifiedTable = authUserTableQualifiedName();

  const normalizeRows = (
    rows: Array<{ id: string; email: string | null; name: string | null; image?: string | null }>,
  ) => {
    for (const row of rows ?? []) {
      map.set(row.id, {
        id: row.id,
        email: row.email,
        name: row.name,
        image: row.image?.trim() ? row.image.trim() : null,
      });
    }
  };

  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{ id: string; email: string | null; name: string | null; image: string | null }>
    >(
      `SELECT id, email, name, image FROM ${qualifiedTable} WHERE id = ANY($1::uuid[])`,
      unique,
    );
    normalizeRows(rows);
    return map;
  } catch {
    // Auth table may not expose `image` (older Neon Auth schemas).
  }

  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{ id: string; email: string | null; name: string | null }>
    >(`SELECT id, email, name FROM ${qualifiedTable} WHERE id = ANY($1::uuid[])`, unique);
    normalizeRows(rows.map((r) => ({ ...r, image: null })));
  } catch (err) {
    logger.error("Failed to fetch auth users for public profiles", err);
  }

  return map;
}

/** Fallback label for cards and headers when the auth profile is missing or empty. */
export function publicHostDisplayName(profile: AuthUserPublicProfile | undefined): string {
  const name = profile?.name?.trim();
  if (name) return name;
  const email = profile?.email?.trim();
  if (email) {
    const at = email.indexOf("@");
    if (at > 0) return email.slice(0, at);
    return email;
  }
  return "Host";
}

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
