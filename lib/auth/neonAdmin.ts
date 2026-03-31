/**
 * Neon admin helpers -- direct server-side access to Neon Auth admin methods.
 */

import { formatUnknownError } from "@/lib/apiResponse";
import {
  banAdminUserInStore,
  listAdminUsersFromStore,
  setAdminUserRoleInStore,
  unbanAdminUserInStore,
} from "./adminUserStore";
import { auth } from "./server";

type NeonAdminResult<T = unknown> = {
  data: T | null;
  error: string | null;
  status: number;
};

type AdminListUsersQuery = {
  limit?: string | number | undefined;
  offset?: string | number | undefined;
  searchValue?: string | number | undefined;
};

type AdminSetRolePayload = {
  userId: string;
  role: string;
};

type AdminBanPayload = {
  userId: string;
  banReason?: string;
  banExpiresIn?: number;
};

type AdminUnbanPayload = {
  userId: string;
};

type NeonAdminResponse<T = unknown> = {
  response: T;
  status: number;
};

type NeonAdminApi = {
  listUsers(args: {
    headers: Headers;
    query?: AdminListUsersQuery;
    returnStatus: true;
  }): Promise<NeonAdminResponse>;
  setRole(args: {
    headers: Headers;
    body: AdminSetRolePayload;
    returnStatus: true;
  }): Promise<NeonAdminResponse>;
  banUser(args: {
    headers: Headers;
    body: AdminBanPayload;
    returnStatus: true;
  }): Promise<NeonAdminResponse>;
  unbanUser(args: {
    headers: Headers;
    body: AdminUnbanPayload;
    returnStatus: true;
  }): Promise<NeonAdminResponse>;
};

function getNeonAdmin(): NeonAdminApi | null {
  return (auth as unknown as { admin?: NeonAdminApi }).admin ?? null;
}

function toFailure<T = never>(error: unknown): NeonAdminResult<T> {
  const status =
    typeof error === "object" && error && "status" in error && typeof error.status === "number"
      ? error.status
      : typeof error === "object" && error && "statusCode" in error && typeof error.statusCode === "number"
        ? error.statusCode
        : 500;

  const message =
    typeof error === "object" &&
    error &&
    "body" in error &&
    typeof error.body === "object" &&
    error.body &&
    "message" in error.body &&
    typeof error.body.message === "string"
      ? error.body.message
      : formatUnknownError(error);

  return {
    data: null,
    error: message || "Neon Auth request failed",
    status,
  };
}

function normalizeListUsersPayload(raw: unknown) {
  const body = (raw ?? null) as
    | {
        users?: unknown[];
        total?: number;
        data?: { users?: unknown[]; total?: number };
      }
    | null;
  const users = body?.users ?? body?.data?.users ?? [];
  const total =
    body?.total ?? body?.data?.total ?? (Array.isArray(users) ? users.length : 0);

  return {
    users: Array.isArray(users) ? users : [],
    total: Number(total) || 0,
  };
}

async function fallbackListUsers<T = unknown>(
  query?: AdminListUsersQuery,
): Promise<NeonAdminResult<T>> {
  try {
    const data = await listAdminUsersFromStore(query ?? {});
    return {
      data: data as T,
      error: null,
      status: 200,
    };
  } catch (error) {
    return toFailure(error);
  }
}

async function fallbackAdminPost<T = unknown>(
  path: "admin/set-role" | "admin/ban-user" | "admin/unban-user",
  payload: AdminSetRolePayload | AdminBanPayload | AdminUnbanPayload,
): Promise<NeonAdminResult<T>> {
  try {
    if (path === "admin/set-role") {
      const user = await setAdminUserRoleInStore(
        (payload as AdminSetRolePayload).userId,
        (payload as AdminSetRolePayload).role,
      );

      if (!user) {
        return {
          data: null,
          error: "User not found",
          status: 404,
        };
      }

      return {
        data: { user } as T,
        error: null,
        status: 200,
      };
    }

    if (path === "admin/ban-user") {
      const session = await auth.getSession();
      const actingUserId = (session.data?.user as { id?: string } | null)?.id ?? null;
      const banPayload = payload as AdminBanPayload;

      if (actingUserId === banPayload.userId) {
        return {
          data: null,
          error: "You cannot ban yourself",
          status: 400,
        };
      }

      const user = await banAdminUserInStore(banPayload);
      if (!user) {
        return {
          data: null,
          error: "User not found",
          status: 404,
        };
      }

      return {
        data: { user } as T,
        error: null,
        status: 200,
      };
    }

    const user = await unbanAdminUserInStore(
      (payload as AdminUnbanPayload).userId,
    );
    if (!user) {
      return {
        data: null,
        error: "User not found",
        status: 404,
      };
    }

    return {
      data: { user } as T,
      error: null,
      status: 200,
    };
  } catch (error) {
    return toFailure(error);
  }
}

export async function callNeonAdminGet<T = unknown>(
  request: Request,
  path: "admin/list-users",
  query?: AdminListUsersQuery,
): Promise<NeonAdminResult<T>> {
  const admin = getNeonAdmin();
  if (!admin) {
    return fallbackListUsers(query);
  }
  try {
    const result = await admin.listUsers({
      headers: request.headers,
      query,
      returnStatus: true,
    });

    const normalized = normalizeListUsersPayload(result.response);
    if (normalized.total === 0) {
      const fallback = await fallbackListUsers<T>(query);
      if (!fallback.error) {
        return fallback;
      }
    }

    return {
      data: result.response as T,
      error: null,
      status: result.status,
    };
  } catch (error) {
    const fallback = await fallbackListUsers<T>(query);
    if (!fallback.error) {
      return fallback;
    }
    return toFailure(error);
  }
}

export async function callNeonAdminPost<T = unknown>(
  request: Request,
  path: "admin/set-role" | "admin/ban-user" | "admin/unban-user",
  payload: AdminSetRolePayload | AdminBanPayload | AdminUnbanPayload,
): Promise<NeonAdminResult<T>> {
  const admin = getNeonAdmin();
  if (!admin) {
    return fallbackAdminPost(path, payload);
  }
  try {
    if (path === "admin/set-role") {
      const result = await admin.setRole({
        headers: request.headers,
        body: payload as AdminSetRolePayload,
        returnStatus: true,
      });
      return {
        data: result.response as T,
        error: null,
        status: result.status,
      };
    }

    if (path === "admin/ban-user") {
      const result = await admin.banUser({
        headers: request.headers,
        body: payload as AdminBanPayload,
        returnStatus: true,
      });
      return {
        data: result.response as T,
        error: null,
        status: result.status,
      };
    }

    const result = await admin.unbanUser({
      headers: request.headers,
      body: payload as AdminUnbanPayload,
      returnStatus: true,
    });
    return {
      data: result.response as T,
      error: null,
      status: result.status,
    };
  } catch (error) {
    const fallback = await fallbackAdminPost<T>(path, payload);
    if (!fallback.error) {
      return fallback;
    }
    return toFailure(error);
  }
}
