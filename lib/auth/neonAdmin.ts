type NeonAdminResult<T = unknown> = {
  data: T | null;
  error: string | null;
  status: number;
};

function buildAuthApiUrl(request: Request, path: string, query?: Record<string, string | number | undefined>) {
  const url = new URL(`/api/auth/${path}`, request.url);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}

export async function callNeonAdminGet<T = unknown>(
  request: Request,
  path: string,
  query?: Record<string, string | number | undefined>
): Promise<NeonAdminResult<T>> {
  const res = await fetch(buildAuthApiUrl(request, path, query), {
    method: "GET",
    headers: {
      cookie: request.headers.get("cookie") ?? "",
    },
    cache: "no-store",
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    return {
      data: null,
      error: body?.error?.message ?? body?.error ?? "Neon Auth request failed",
      status: res.status,
    };
  }
  return { data: body as T, error: null, status: res.status };
}

export async function callNeonAdminPost<T = unknown>(
  request: Request,
  path: string,
  payload: Record<string, unknown>
): Promise<NeonAdminResult<T>> {
  const res = await fetch(buildAuthApiUrl(request, path), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: request.headers.get("cookie") ?? "",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    return {
      data: null,
      error: body?.error?.message ?? body?.error ?? "Neon Auth request failed",
      status: res.status,
    };
  }
  return { data: body as T, error: null, status: res.status };
}
