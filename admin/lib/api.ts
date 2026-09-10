/**
 * Admin API client.
 *
 * Deliberately the same shape as frontend/lib/api.ts: every request carries
 * `credentials: "include"` so the backend's httpOnly access/refresh cookies are
 * sent, and errors are unwrapped from the backend's
 * `{ success: false, error: { code, message } }` envelope.
 *
 * There is no token in JavaScript to steal and no role stored client-side: the
 * server resolves the caller's role from its own JWT on every request.
 */

function getApiBase() {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:4000/api`;
  }
  return "http://localhost:4000/api";
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type ErrorEnvelope = {
  success?: false;
  error?: { code?: string; message?: string };
};

export async function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const base = getApiBase();
  const url = path.startsWith("http")
    ? path
    : `${base}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      0,
      "Could not reach the CodeClash API. Is the backend running on port 4000?",
      "NETWORK_ERROR",
    );
  }

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson
    ? await res.json().catch(() => null)
    : await res.text();

  if (!res.ok) {
    const envelope = (isJson ? (payload as ErrorEnvelope) : null) ?? {};
    throw new ApiError(
      res.status,
      envelope.error?.message || `API ${res.status} ${res.statusText}`,
      envelope.error?.code,
    );
  }

  return payload as T;
}

export const auth = {
  login: (email: string, password: string) =>
    request("POST", "/auth/login", { email, password }),
  me: () => request("GET", "/auth/me"),
  logout: () => request("POST", "/auth/logout"),
  refresh: () => request("POST", "/auth/refresh"),
};
