import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// socket.io-client, faked: each io() call returns a FakeSocket the test drives
// the way the server would.
const fake = vi.hoisted(() => {
  type Listener = (...args: unknown[]) => void;

  class FakeSocket {
    connected = false;
    /** socket.io-client's `active`: false once it has given up reconnecting. */
    active = true;
    emitted: { event: string; payload: unknown }[] = [];
    acks: ((err: Error | null, ack?: unknown) => void)[] = [];
    private listeners = new Map<string, Set<Listener>>();

    on(event: string, fn: Listener) {
      if (!this.listeners.has(event)) this.listeners.set(event, new Set());
      this.listeners.get(event)!.add(fn);
      return this;
    }
    off(event: string, fn: Listener) {
      this.listeners.get(event)?.delete(fn);
      return this;
    }
    removeAllListeners() {
      this.listeners.clear();
      return this;
    }
    listenerCount(event?: string) {
      if (event) return this.listeners.get(event)?.size ?? 0;
      return [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0);
    }
    connect() {
      this.active = true;
      return this;
    }
    disconnect() {
      const wasConnected = this.connected;
      this.connected = false;
      this.active = false;
      if (wasConnected) this.fire("disconnect", "io client disconnect");
      return this;
    }
    emit(event: string, payload?: unknown) {
      this.emitted.push({ event, payload });
      return this;
    }
    timeout() {
      return {
        emit: (event: string, payload: unknown, ack: (err: Error | null, ack?: unknown) => void) => {
          this.emitted.push({ event, payload });
          this.acks.push(ack);
        },
      };
    }

    private fire(event: string, ...args: unknown[]) {
      for (const fn of [...(this.listeners.get(event) ?? [])]) fn(...args);
    }
    // --- what the server and the network do ---
    accept() {
      this.connected = true;
      this.fire("connect");
    }
    /** The server closes a connected socket. */
    kick() {
      this.connected = false;
      this.active = false;
      this.fire("disconnect", "io server disconnect");
    }
    /** The server's auth middleware refuses the handshake. */
    refuse(code: string, { withData = true } = {}) {
      this.active = false;
      this.fire("connect_error", Object.assign(new Error(code), withData ? { data: { code } } : {}));
    }
    /** The server cannot be reached; socket.io keeps retrying. */
    transportError() {
      this.fire("connect_error", new Error("xhr poll error"));
    }
  }

  return { FakeSocket, sockets: [] as FakeSocket[] };
});

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => {
    const s = new fake.FakeSocket();
    fake.sockets.push(s);
    return s;
  }),
}));

type Answer = 200 | 401 | 403 | 429 | 503 | "network";

/**
 * The auth endpoints the socket recovery uses. The browser holds the refresh
 * cookie `cookie`; the server accepts `validToken`.
 */
const server = {
  validToken: 1,
  cookie: 1,
  /** Forces the answer of POST /auth/refresh. */
  refreshAnswer: null as Answer | null,
  calls: [] as string[],
};

function respond(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    headers: { get: () => "application/json" },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
  const path = new URL(url).pathname.replace(/^\/api/, "");
  server.calls.push(`${init.method ?? "GET"} ${path}`);
  const answer = path === "/auth/refresh" && server.refreshAnswer !== null ? server.refreshAnswer : null;
  if (answer === "network") throw new TypeError("fetch failed");
  if (answer === 403) {
    return respond(403, { success: false, error: { code: "ACCOUNT_BANNED", message: "This account has been suspended." } });
  }
  if (answer !== null) return respond(answer, { success: answer === 200 });
  return server.cookie === server.validToken
    ? respond(200, { success: true })
    : respond(401, { success: false, error: { code: "UNAUTHENTICATED" } });
});

let sock: typeof import("./socket");
let api: typeof import("./api");
let ended: string[];

const refreshCalls = () => server.calls.filter((call) => call === "POST /auth/refresh").length;
const latest = () => fake.sockets[fake.sockets.length - 1];

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  // No jitter unless a test asks for it: recovery attempt n waits 1 s * 2^n.
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.stubGlobal("fetch", fetchMock);
  Object.assign(server, { validToken: 1, cookie: 1, refreshAnswer: null, calls: [] });
  fake.sockets.length = 0;
  vi.resetModules();
  sock = await import("./socket");
  api = await import("./api");
  ended = [];
  // What the AuthProvider wires up.
  api.onSessionRefreshed(() => sock.recreateSocket());
  api.onSessionExpired((reason) => {
    ended.push(reason);
    sock.disconnectSocket();
  });
});

afterEach(() => {
  sock.disconnectSocket();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("one socket per player", () => {
  it("creates a socket for the signed-in player and keeps it", () => {
    const changes = vi.fn();
    sock.subscribeSocket(changes);

    sock.connectSocket("u1");
    sock.connectSocket("u1");

    expect(fake.sockets).toHaveLength(1);
    expect(sock.getSocket()).toBe(fake.sockets[0]);
    expect(changes).toHaveBeenCalledTimes(1);
  });

  it("replaces another player's socket and closes it on sign-out", () => {
    sock.connectSocket("u1");
    const first = latest();
    sock.connectSocket("u2");

    expect(fake.sockets).toHaveLength(2);
    expect(first.active).toBe(false);
    expect(first.listenerCount()).toBe(0);

    sock.disconnectSocket();
    expect(sock.getSocket()).toBeNull();
    expect(latest().active).toBe(false);
  });
});

describe("recoveryDelay", () => {
  it("waits about a second first, then doubles up to 30 s, each within 25%", () => {
    expect(sock.recoveryDelay(0, () => 0.5)).toBe(1_000);
    expect(sock.recoveryDelay(0, () => 0)).toBe(750);
    expect(sock.recoveryDelay(0, () => 1)).toBe(1_250);
    expect(sock.recoveryDelay(1, () => 0.5)).toBe(2_000);
    expect(sock.recoveryDelay(3, () => 0.5)).toBe(8_000);
    expect(sock.recoveryDelay(5, () => 0.5)).toBe(30_000);
    expect(sock.recoveryDelay(12, () => 1)).toBe(37_500);
  });
});

describe("recovery", () => {
  it("renews the session and reconnects after the server disconnects the socket", async () => {
    sock.connectSocket("u1");
    const first = latest();
    first.accept();

    first.kick();
    await vi.advanceTimersByTimeAsync(999);
    expect(refreshCalls()).toBe(0);
    await vi.advanceTimersByTimeAsync(1);

    expect(refreshCalls()).toBe(1);
    expect(fake.sockets).toHaveLength(2);
    expect(sock.getSocket()).toBe(latest());
    expect(first.listenerCount()).toBe(0);
  });

  it.each([
    ["UNAUTHENTICATED", { withData: true }],
    ["SESSION_REVOKED", { withData: true }],
    // err.message carries the code too.
    ["SESSION_REVOKED", { withData: false }],
  ])("renews the session and reconnects when the handshake is refused with %s", async (code, options) => {
    sock.connectSocket("u1");

    latest().refuse(code, options);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(refreshCalls()).toBe(1);
    expect(fake.sockets).toHaveLength(2);
    expect(ended).toEqual([]);
  });

  it("leaves transport errors to socket.io's own reconnection", async () => {
    sock.connectSocket("u1");
    const first = latest();

    first.transportError();
    first.transportError();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(server.calls).toEqual([]);
    expect(sock.getSocket()).toBe(first);
    expect(fake.sockets).toHaveLength(1);
  });

  it("ends the session with the ban when the handshake finds the account banned", async () => {
    sock.connectSocket("u1");

    latest().refuse("ACCOUNT_BANNED");
    await vi.advanceTimersByTimeAsync(60_000);

    expect(ended).toEqual(["banned"]);
    expect(server.calls).toEqual([]);
    expect(sock.getSocket()).toBeNull();
  });

  it("ends the session with the ban when the renewal finds the account banned", async () => {
    server.refreshAnswer = 403;
    sock.connectSocket("u1");
    latest().accept();

    latest().kick();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(ended).toEqual(["banned"]);
    expect(refreshCalls()).toBe(1);
  });

  it("ends the session once, without logging out, when the renewal is refused", async () => {
    server.refreshAnswer = 401;
    server.cookie = 0;
    sock.connectSocket("u1");

    latest().refuse("UNAUTHENTICATED");
    await vi.advanceTimersByTimeAsync(120_000);

    expect(ended).toEqual(["expired"]);
    expect(server.calls).toEqual(["POST /auth/refresh", "GET /auth/me"]);
    expect(sock.getSocket()).toBeNull();
  });

  it.each<Answer>([503, 429, "network"])(
    "keeps trying, and never signs out, while the session cannot be renewed (%s)",
    async (answer) => {
      server.refreshAnswer = answer;
      sock.connectSocket("u1");

      latest().refuse("UNAUTHENTICATED");
      await vi.advanceTimersByTimeAsync(1_000);
      expect(refreshCalls()).toBe(1);
      await vi.advanceTimersByTimeAsync(2_000);
      expect(refreshCalls()).toBe(2);
      await vi.advanceTimersByTimeAsync(4_000);
      expect(refreshCalls()).toBe(3);

      server.refreshAnswer = null;
      await vi.advanceTimersByTimeAsync(8_000);
      expect(refreshCalls()).toBe(4);
      expect(fake.sockets).toHaveLength(2);
      expect(ended).toEqual([]);
    },
  );

  it("backs off while the server keeps refusing new sockets, and resets once one stays up", async () => {
    sock.connectSocket("u1");

    latest().refuse("UNAUTHENTICATED");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(refreshCalls()).toBe(1);

    latest().refuse("UNAUTHENTICATED");
    await vi.advanceTimersByTimeAsync(1_999);
    expect(refreshCalls()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(refreshCalls()).toBe(2);

    latest().refuse("UNAUTHENTICATED");
    await vi.advanceTimersByTimeAsync(3_999);
    expect(refreshCalls()).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(refreshCalls()).toBe(3);

    // A connection that stays up for 10 s resets the backoff.
    latest().accept();
    await vi.advanceTimersByTimeAsync(10_000);
    latest().kick();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(refreshCalls()).toBe(4);
  });

  it("varies the wait, so several tabs do not renew at the same instant", async () => {
    vi.mocked(Math.random).mockReturnValue(0);
    sock.connectSocket("u1");

    latest().refuse("UNAUTHENTICATED");
    await vi.advanceTimersByTimeAsync(749);
    expect(refreshCalls()).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(refreshCalls()).toBe(1);
  });

  describe("when another tab changes the password", () => {
    // The server revokes every session but the changing tab's, closes all of
    // the account's sockets, and only then answers that tab with new cookies,
    // which the browser shares with this tab.
    function passwordChangedElsewhere({ cookiesArriveAfterMs }: { cookiesArriveAfterMs: number }) {
      server.validToken += 1;
      latest().kick();
      setTimeout(() => {
        server.cookie = server.validToken;
      }, cookiesArriveAfterMs);
    }

    it("waits for the other tab's cookies before renewing", async () => {
      sock.connectSocket("u1");
      latest().accept();

      passwordChangedElsewhere({ cookiesArriveAfterMs: 50 });
      await vi.advanceTimersByTimeAsync(1_000);

      expect(server.calls).toEqual(["POST /auth/refresh"]);
      expect(ended).toEqual([]);
      expect(fake.sockets).toHaveLength(2);
    });

    it("re-checks the session once before ending it when the renewal raced the new cookies", async () => {
      sock.connectSocket("u1");
      latest().accept();
      // The refresh goes out with the revoked cookie; the new ones land
      // while it is on its way.
      fetchMock.mockImplementationOnce(async (url: string) => {
        server.calls.push(`POST ${new URL(url).pathname.replace(/^\/api/, "")}`);
        server.cookie = server.validToken;
        return respond(401, { success: false, error: { code: "UNAUTHENTICATED" } });
      });

      passwordChangedElsewhere({ cookiesArriveAfterMs: 5_000 });
      await vi.advanceTimersByTimeAsync(1_000);

      expect(server.calls).toEqual(["POST /auth/refresh", "GET /auth/me"]);
      expect(ended).toEqual([]);
      expect(fake.sockets).toHaveLength(2);
    });

    it("ends the session when the re-check is refused too, still without logging out", async () => {
      sock.connectSocket("u1");
      latest().accept();

      // This tab's session was revoked, and no new cookies arrive.
      server.validToken += 1;
      latest().kick();
      await vi.advanceTimersByTimeAsync(60_000);

      expect(server.calls).toEqual(["POST /auth/refresh", "GET /auth/me"]);
      expect(ended).toEqual(["expired"]);
      expect(sock.getSocket()).toBeNull();
    });
  });

  it("stops recovering once the player signs out", async () => {
    sock.connectSocket("u1");
    latest().accept();
    latest().kick();

    sock.disconnectSocket();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(server.calls).toEqual([]);
    expect(sock.getSocket()).toBeNull();
  });
});

describe("channels", () => {
  it("runs the join on connect and again after every reconnect", () => {
    sock.connectSocket("u1");
    const s = latest();
    const onConnect = vi.fn();
    const stop = sock.onEveryConnect(sock.getSocket()!, onConnect);
    expect(onConnect).not.toHaveBeenCalled();

    s.accept();
    s.accept();
    stop();
    s.accept();

    expect(onConnect.mock.calls).toEqual([[true], [true]]);
  });

  it("retries a join the server was not ready for, then reports the ack", async () => {
    sock.connectSocket("u1");
    const s = latest();
    s.accept();
    const onAck = vi.fn();

    sock.joinChannel(sock.getSocket()!, "match:join", { matchId: "m1" }, onAck);
    s.acks[0](null, { ok: false, error: "INVALID_REQUEST" });
    await vi.advanceTimersByTimeAsync(200);
    s.acks[1](null, { ok: true });

    expect(s.emitted.map((e) => e.event)).toEqual(["match:join", "match:join"]);
    expect(onAck).toHaveBeenCalledWith({ ok: true });
  });

  it("reports a join that got no answer as a timeout", () => {
    sock.connectSocket("u1");
    const s = latest();
    s.accept();
    const onAck = vi.fn();

    sock.joinChannel(sock.getSocket()!, "room:join", { roomId: "r1" }, onAck);
    s.acks[0](new Error("operation has timed out"));

    expect(onAck).toHaveBeenCalledWith({ ok: false, error: "TIMEOUT" });
  });
});
