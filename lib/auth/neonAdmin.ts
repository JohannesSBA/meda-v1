/**
 * Neon admin helpers -- direct server-side access to Neon Auth admin methods.
 */

import { formatUnknownError } from "@/lib/apiResponse";
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

function getNeonAdmin() {
  const admin = (auth as unknown as { admin?: NeonAdminApi }).admin;
  if (!admin) {
    throw new Error("Neon Auth admin API is unavailable");
  }
  return admin;
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

export async function callNeonAdminGet<T = unknown>(
  request: Request,
  path: "admin/list-users",
  query?: AdminListUsersQuery,
): Promise<NeonAdminResult<T>> {
  try {
    const result = await getNeonAdmin().listUsers({
      headers: request.headers,
      query,
      returnStatus: true,
    });

    return {
      data: result.response as T,
      error: null,
      status: result.status,
    };
  } catch (error) {
    return toFailure(error);
  }
}

export async function callNeonAdminPost<T = unknown>(
  request: Request,
  path: "admin/set-role" | "admin/ban-user" | "admin/unban-user",
  payload: AdminSetRolePayload | AdminBanPayload | AdminUnbanPayload,
): Promise<NeonAdminResult<T>> {
  try {
    if (path === "admin/set-role") {
      const result = await getNeonAdmin().setRole({
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
      const result = await getNeonAdmin().banUser({
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

    const result = await getNeonAdmin().unbanUser({
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
    return toFailure(error);
  }
}
