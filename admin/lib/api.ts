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
 *
 * Access tokens are short-lived (JWT_ACCESS_EXPIRES_IN, 15 minutes by default).
 * When a request comes back 401, the client renews the session through
 * POST /auth/refresh - which reads the httpOnly refresh cookie - and replays
 * the request once. Concurrent 401s share a single refresh. When the refresh
 * itself is refused the session is over: everything registered with
 * onSessionExpired is told, and the auth provider signs the console out.
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

// ---------------------------------------------------------------------------
// session renewal
// ---------------------------------------------------------------------------

/**
 * Endpoints whose 401 means "wrong credentials" or "no session to renew",
 * never "renew and retry". Refreshing on these would loop or mask the error.
 */
const NO_REFRESH = /\/auth\/(?:login|register|refresh|logout)\/?(?:[?#]|$)/;

type RefreshOutcome = "refreshed" | "rejected" | "unavailable";

let refreshInFlight: Promise<RefreshOutcome> | null = null;

/**
 * Bumped after every successful refresh. A request remembers the value it was
 * sent under, so a 401 that arrives after another request already renewed the
 * session is simply replayed instead of triggering a second refresh.
 */
let sessionGeneration = 0;

const expiryListeners = new Set<() => void>();

/** Called once per refused refresh. Returns an unsubscribe function. */
export function onSessionExpired(listener: () => void): () => void {
  expiryListeners.add(listener);
  return () => {
    expiryListeners.delete(listener);
  };
}

function refreshSession(): Promise<RefreshOutcome> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${getApiBase()}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then((res): RefreshOutcome => {
        if (res.ok) {
          sessionGeneration += 1;
          return "refreshed";
        }
        // 401: the refresh cookie is missing, expired or revoked. 403: the
        // account was banned. Anything else (429, 5xx) is transient and must
        // not sign anyone out.
        if (res.status === 401 || res.status === 403) {
          expiryListeners.forEach((listener) => listener());
          return "rejected";
        }
        return "unavailable";
      })
      .catch((): RefreshOutcome => "unavailable")
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

// ---------------------------------------------------------------------------
// requests
// ---------------------------------------------------------------------------

async function send(
  method: string,
  url: string,
  body: unknown,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  try {
    return await fetch(url, {
      method,
      headers,
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch only rejects when no response could be read: the API is down or
    // unreachable, or - most often in a fresh deployment - the browser
    // blocked the response because this origin is not in the API's CORS list.
    const origin =
      typeof window !== "undefined" ? window.location.origin : "this console";
    throw new ApiError(
      0,
      `Could not reach the CodeClash API at ${getApiBase()}. Check that the backend is running, and that this page's origin (${origin}) is listed in the API's ADMIN_FRONTEND_URL.`,
      "NETWORK_ERROR",
    );
  }
}

export async function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const base = getApiBase();
  const url = path.startsWith("http")
    ? path
    : `${base}${path.startsWith("/") ? "" : "/"}${path}`;

  const generation = sessionGeneration;
  let res = await send(method, url, body);

  if (res.status === 401 && !NO_REFRESH.test(url)) {
    // The guards reject before any handler runs, so a 401 means nothing was
    // done and replaying the request once is safe, even for a POST.
    const outcome =
      generation !== sessionGeneration ? "refreshed" : await refreshSession();
    if (outcome === "refreshed") res = await send(method, url, body);
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
  /** Signs out the account's other sessions; this one gets fresh cookies. */
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ success: true }>("POST", "/auth/change-password", {
      currentPassword,
      newPassword,
    }),
};
