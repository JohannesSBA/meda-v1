export class BrowserApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "BrowserApiError";
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = Omit<RequestInit, "body" | "method"> & {
  body?: unknown;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;

async function request<T>(
  input: string,
  method: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  let body: BodyInit | undefined;
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  if (options.signal) {
    options.signal.addEventListener("abort", () => controller.abort(), {
      once: true,
    });
  }

  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(input, {
      ...options,
      method,
      headers,
      body,
      credentials: options.credentials ?? "same-origin",
      signal: controller.signal,
    });
  } catch (error) {
    window.clearTimeout(timeoutId);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new BrowserApiError("Request timed out", 408);
    }
    throw error;
  }
  window.clearTimeout(timeoutId);

  const text = await response.text();
  const data = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    throw new BrowserApiError(
      getErrorMessage(data) || response.statusText || "Request failed",
      response.status,
      data,
    );
  }

  return data as T;
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function getErrorMessage(payload: unknown) {
  if (!payload) return null;
  if (typeof payload === "string") return payload;
  if (
    typeof payload === "object" &&
    payload &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }
  return null;
}

export const browserApi = {
  get<T>(input: string, options?: Omit<RequestOptions, "body">) {
    return request<T>(input, "GET", options);
  },
  post<T>(input: string, body?: unknown, options?: Omit<RequestOptions, "body">) {
    return request<T>(input, "POST", { ...options, body });
  },
  patch<T>(input: string, body?: unknown, options?: Omit<RequestOptions, "body">) {
    return request<T>(input, "PATCH", { ...options, body });
  },
  delete<T>(input: string, body?: unknown, options?: Omit<RequestOptions, "body">) {
    return request<T>(input, "DELETE", { ...options, body });
  },
};
