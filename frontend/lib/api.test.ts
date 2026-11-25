import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A fake API behind fetch. The browser's cookie jar is `cookie`: requests
 * pass while it holds the current access token, POST /auth/refresh swaps in
 * a new one (unless told to answer otherwise).
 */
type Answer = number | "network";

function fakeServer() {
  const server = {
    /** The access token the server accepts. */
    validToken: 1,
    /** The access token the browser holds. */
    cookie: 1,
    refreshAnswer: 200 as Answer,
    /** A refresh answers 200 but the browser does not store the new cookie. */
    refreshKeepsOldCookie: false,
    banned: false,
    calls: [] as string[],
    /** Holds back the answer to the next call of this path until released. */
    hold: null as null | { path: string; release: Promise<void> },
  };

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const unauthenticated = () =>
    json(401, { success: false, error: { code: "UNAUTHENTICATED", message: "Authentication required" } });

  const fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
    const path = new URL(url).pathname.replace(/^\/api/, "");
    const method = init.method ?? "GET";
    server.calls.push(`${method} ${path}`);
    // Answer as the server saw the request when it arrived.
    const sentWith = server.cookie;
    const held = server.hold?.path === path ? server.hold : null;
    if (held) {
      server.hold = null;
      await held.release;
    }
    await new Promise((resolve) => setTimeout(resolve, 1));

    if (path === "/auth/refresh") {
      const answer = server.refreshAnswer;
      if (answer === "network") throw new TypeError("fetch failed");
      if (answer === 200) {
        server.validToken += 1;
        if (!server.refreshKeepsOldCookie) server.cookie = server.validToken;
        return json(200, { success: true, user: { id: "u1" } });
      }
      if (answer === 403) {
        return json(403, { success: false, error: { code: "ACCOUNT_BANNED", message: "This account has been suspended." } });
      }
      if (answer === 401) return unauthenticated();
      return json(answer, { success: false, error: { code: "ERROR", message: "ThrottlerException: Too Many Requests" } });
    }
    if (path === "/auth/login") {
      return json(401, { success: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } });
    }
    if (server.banned) {
      return json(403, { success: false, error: { code: "ACCOUNT_BANNED", message: "This account has been suspended." } });
    }
    if (sentWith !== server.validToken) return unauthenticated();
    if (path === "/matchmaking/quick" && method === "DELETE") {
      return json(409, {
        success: false,
        error: { code: "MATCH_ALREADY_FOUND", message: "A match has already been found.", matchId: "m1" },
      });
    }
    if (path === "/leaderboard") {
      return json(429, { success: false, error: { code: "ERROR", message: "ThrottlerException: Too Many Requests" } });
    }
    return json(200, { success: true, path });
  });

  return { server, fetch };
}

let server: ReturnType<typeof fakeServer>["server"];
let api: typeof import("./api");
let expired: number;
let reasons: string[];
let refreshed: number;

beforeEach(async () => {
  const fake = fakeServer();
  server = fake.server;
  vi.stubGlobal("fetch", fake.fetch);
  // Fresh module state (shared refresh, session generation) for every test.
  vi.resetModules();
  api = await import("./api");
  expired = 0;
  reasons = [];
  refreshed = 0;
  api.onSessionExpired((reason) => {
    expired += 1;
    reasons.push(reason);
  });
  api.onSessionRefreshed(() => {
    refreshed += 1;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const refreshCalls = () => server.calls.filter((call) => call === "POST /auth/refresh").length;

describe("session renewal", () => {
  it("sends nothing extra while the session is valid", async () => {
    await expect(api.auth.me()).resolves.toMatchObject({ path: "/auth/me" });
    expect(server.calls).toEqual(["GET /auth/me"]);
  });

  it("renews an expired access token and replays the request once", async () => {
    server.validToken = 2;

    await expect(api.matches.active()).resolves.toMatchObject({ path: "/matches/me/active" });

    expect(server.calls).toEqual(["GET /matches/me/active", "POST /auth/refresh", "GET /matches/me/active"]);
    expect(refreshed).toBe(1);
    expect(expired).toBe(0);
  });

  it("shares one refresh between concurrent 401s", async () => {
    server.validToken = 2;

    const results = await Promise.all([
      api.auth.me(),
      api.matches.active(),
      api.matches.get("m1"),
      api.rooms.get("r1"),
      api.invitations.mine(),
    ]);

    expect(results.every((res) => res.success)).toBe(true);
    expect(refreshCalls()).toBe(1);
    expect(refreshed).toBe(1);
    // Five requests, one refresh, five replays.
    expect(server.calls).toHaveLength(11);
  });

  it("replays a late 401 without a second refresh once another request renewed the session", async () => {
    server.validToken = 2;
    let release!: () => void;
    server.hold = { path: "/matches/me/active", release: new Promise<void>((resolve) => (release = resolve)) };

    const slow = api.matches.active();
    // Renews the session while the slow request's 401 is still on its way.
    await api.auth.me();
    release();

    await expect(slow).resolves.toMatchObject({ path: "/matches/me/active" });
    expect(refreshCalls()).toBe(1);
  });

  it("replays only once, even when the replay is refused again", async () => {
    server.validToken = 2;
    server.refreshKeepsOldCookie = true;

    await expect(api.auth.me()).rejects.toMatchObject({
      status: 401,
      message: "Your session has expired. Please sign in again.",
    });
    expect(server.calls).toEqual(["GET /auth/me", "POST /auth/refresh", "GET /auth/me"]);
  });

  it("ends the session once when the refresh is refused", async () => {
    server.validToken = 2;
    server.refreshAnswer = 401;

    const results = await Promise.allSettled([api.auth.me(), api.matches.active(), api.profile.me()]);

    expect(refreshCalls()).toBe(1);
    expect(reasons).toEqual(["expired"]);
    for (const result of results) {
      expect(result).toMatchObject({
        status: "rejected",
        reason: { status: 401, message: "Your session has expired. Please sign in again." },
      });
    }
    // Ending a session never clears the cookies other tabs share.
    expect(server.calls).not.toContain("POST /auth/logout");
  });

  it.each([500, 503, 429, "network" as const])(
    "never signs the player out when the refresh is unavailable (%s)",
    async (answer) => {
      server.validToken = 2;
      server.refreshAnswer = answer;

      await expect(api.matches.active()).rejects.toMatchObject({
        status: 401,
        message: "Your session could not be renewed right now. Please try again in a moment.",
      });
      expect(expired).toBe(0);
      expect(refreshed).toBe(0);
    },
  );

  it("ends the session when the account is banned", async () => {
    server.banned = true;

    await expect(api.matches.active()).rejects.toMatchObject({ status: 403, code: "ACCOUNT_BANNED" });
    expect(reasons).toEqual(["banned"]);
    expect(refreshCalls()).toBe(0);
  });

  it("ends the session when the refresh finds the account banned", async () => {
    server.validToken = 2;
    server.refreshAnswer = 403;

    await expect(api.matches.active()).rejects.toMatchObject({ status: 401 });
    expect(reasons).toEqual(["banned"]);
  });

  it("ends a session locally, without calling the API", () => {
    api.endSession("banned");

    expect(reasons).toEqual(["banned"]);
    expect(server.calls).toEqual([]);
  });
});

describe("errors", () => {
  it("never renews on the sign-in endpoints and keeps their message", async () => {
    await expect(api.auth.login("a@example.com", "wrong")).rejects.toMatchObject({
      status: 401,
      code: "INVALID_CREDENTIALS",
      message: "Invalid email or password",
    });
    expect(refreshCalls()).toBe(0);
  });

  it("explains rate limiting instead of showing the limiter's class name", async () => {
    await expect(api.leaderboard.top(5)).rejects.toMatchObject({
      status: 429,
      message: "Too many requests. Please wait a moment and try again.",
    });
  });

  it("keeps the extra fields of an error", async () => {
    await expect(api.matchmaking.cancel()).rejects.toMatchObject({
      status: 409,
      code: "MATCH_ALREADY_FOUND",
      details: { matchId: "m1" },
    });
  });

  it("reports an unreachable server as a network error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));

    await expect(api.matches.active()).rejects.toMatchObject({ status: 0, code: "NETWORK_ERROR" });
    expect(expired).toBe(0);
  });
});
