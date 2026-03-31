import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const ALLOWED_SCHEMAS = ["neon_auth", "public"] as const;
const ALLOWED_TABLES = ["user"] as const;

type AuthAdminUserRow = {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
  authRole: string | null;
  banned: boolean | null;
  banReason: string | null;
  banExpires: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type CountRow = {
  count: number;
};

function getAuthSchema() {
  return process.env.AUTH_SCHEMA &&
    ALLOWED_SCHEMAS.includes(
      process.env.AUTH_SCHEMA as (typeof ALLOWED_SCHEMAS)[number],
    )
    ? process.env.AUTH_SCHEMA
    : "neon_auth";
}

function getAuthUserTable() {
  return process.env.AUTH_USER_TABLE &&
    ALLOWED_TABLES.includes(
      process.env.AUTH_USER_TABLE as (typeof ALLOWED_TABLES)[number],
    )
    ? process.env.AUTH_USER_TABLE
    : "user";
}

function getQualifiedAuthUserTable() {
  return `"${getAuthSchema()}"."${getAuthUserTable()}"`;
}

function getQualifiedAuthSessionTable() {
  return `"${getAuthSchema()}"."session"`;
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function normalizeUser(row: AuthAdminUserRow) {
  return {
    ...row,
    role: row.role ?? "user",
    authRole: row.authRole ?? "user",
    banned: Boolean(row.banned),
  };
}

function toBanExpiry(banExpiresIn?: number) {
  if (!banExpiresIn || banExpiresIn <= 0) {
    return null;
  }

  return new Date(Date.now() + banExpiresIn * 1000);
}

export async function listAdminUsersFromStore(args: {
  limit?: string | number | undefined;
  offset?: string | number | undefined;
  searchValue?: string | number | undefined;
}) {
  const limit = Math.max(1, Number(args.limit) || 20);
  const offset = Math.max(0, Number(args.offset) || 0);
  const searchValue = String(args.searchValue ?? "").trim();
  const searchPattern = searchValue ? `%${escapeLike(searchValue)}%` : null;
  const table = getQualifiedAuthUserTable();

  try {
    const [users, totals] = await Promise.all([
      prisma.$queryRawUnsafe<AuthAdminUserRow[]>(
        `
          SELECT
            auth_users.id,
            auth_users.email,
            auth_users.name,
            CASE
              WHEN auth_users.role = 'admin' THEN 'admin'
              WHEN pitch_owner_profiles.user_id IS NOT NULL THEN 'pitch_owner'
              WHEN facilitators.facilitator_user_id IS NOT NULL THEN 'facilitator'
              ELSE 'user'
            END AS role,
            auth_users.role AS "authRole",
            auth_users.banned,
            auth_users."banReason",
            auth_users."banExpires",
            auth_users."createdAt",
            auth_users."updatedAt"
          FROM ${table} AS auth_users
          LEFT JOIN public.pitch_owner_profiles
            ON pitch_owner_profiles.user_id = auth_users.id
          LEFT JOIN public.facilitators
            ON facilitators.facilitator_user_id = auth_users.id
           AND facilitators.is_active = true
          WHERE (
            $1::text IS NULL
            OR auth_users.email ILIKE $1 ESCAPE '\\\\'
            OR auth_users.name ILIKE $1 ESCAPE '\\\\'
          )
          ORDER BY auth_users."createdAt" DESC, auth_users.id DESC
          LIMIT $2 OFFSET $3
        `,
        searchPattern,
        limit,
        offset,
      ),
      prisma.$queryRawUnsafe<CountRow[]>(
        `
          SELECT COUNT(*)::int AS count
          FROM ${table} AS auth_users
          WHERE (
            $1::text IS NULL
            OR auth_users.email ILIKE $1 ESCAPE '\\\\'
            OR auth_users.name ILIKE $1 ESCAPE '\\\\'
          )
        `,
        searchPattern,
      ),
    ]);

    return {
      users: (users ?? []).map(normalizeUser),
      total: Number(totals[0]?.count ?? 0),
    };
  } catch (error) {
    logger.error("Failed to list auth users from store", error);
    throw error;
  }
}

export async function setAdminUserRoleInStore(userId: string, role: string) {
  const rows = await prisma.$queryRawUnsafe<AuthAdminUserRow[]>(
    `
      UPDATE ${getQualifiedAuthUserTable()}
      SET role = $2, "updatedAt" = NOW()
      WHERE id = $1::uuid
      RETURNING
        id,
        email,
        name,
        role,
        banned,
        "banReason",
        "banExpires",
        "createdAt",
        "updatedAt"
    `,
    userId,
    role,
  );

  return rows[0] ? normalizeUser(rows[0]) : null;
}

export async function banAdminUserInStore(args: {
  userId: string;
  banReason?: string;
  banExpiresIn?: number;
}) {
  const rows = await prisma.$queryRawUnsafe<AuthAdminUserRow[]>(
    `
      UPDATE ${getQualifiedAuthUserTable()}
      SET
        banned = true,
        "banReason" = $2,
        "banExpires" = $3,
        "updatedAt" = NOW()
      WHERE id = $1::uuid
      RETURNING
        id,
        email,
        name,
        role,
        banned,
        "banReason",
        "banExpires",
        "createdAt",
        "updatedAt"
    `,
    args.userId,
    args.banReason || "No reason",
    toBanExpiry(args.banExpiresIn),
  );
  const user = rows[0] ? normalizeUser(rows[0]) : null;

  if (user) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM ${getQualifiedAuthSessionTable()} WHERE "userId" = $1::uuid`,
      args.userId,
    );
  }

  return user;
}

export async function unbanAdminUserInStore(userId: string) {
  const rows = await prisma.$queryRawUnsafe<AuthAdminUserRow[]>(
    `
      UPDATE ${getQualifiedAuthUserTable()}
      SET
        banned = false,
        "banReason" = NULL,
        "banExpires" = NULL,
        "updatedAt" = NOW()
      WHERE id = $1::uuid
      RETURNING
        id,
        email,
        name,
        role,
        banned,
        "banReason",
        "banExpires",
        "createdAt",
        "updatedAt"
    `,
    userId,
  );

  return rows[0] ? normalizeUser(rows[0]) : null;
}
