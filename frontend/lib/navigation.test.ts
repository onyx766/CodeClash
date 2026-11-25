import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authHref, currentPathWithQuery, isAuthPage, safeNextPath } from "./navigation";

beforeEach(() => {
  vi.stubGlobal("window", {
    location: { origin: "http://localhost:3000", pathname: "/lobby", search: "?code=AB12CD" },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("safeNextPath", () => {
  it.each([
    ["/lobby", "/lobby"],
    ["/lobby?code=AB12CD", "/lobby?code=AB12CD"],
    ["/profile#match-history", "/profile#match-history"],
    ["/match/123?tab=tests#editor", "/match/123?tab=tests#editor"],
    // Dot segments are resolved; the result is still a path on this site.
    ["/a/./b", "/a/b"],
    // Encoded slashes are not path separators: a path segment on this site.
    ["/%2F%2Fevil.example", "/%2F%2Fevil.example"],
  ])("keeps the site path %j", (raw, expected) => {
    expect(safeNextPath(raw)).toBe(expected);
  });

  it.each([
    // Protocol-relative and backslash forms leave the origin.
    "//evil.example",
    "//evil.example/lobby",
    "/\\evil.example",
    "/./\\evil.example",
    // Dot segments that normalise into "//host".
    "/.//evil.example",
    "/..//evil.example",
    "/a/..//evil.example",
    "/%2e//evil.example",
    "/%2E%2E//evil.example",
    // The URL parser drops tabs and newlines, which would join the slashes.
    "/\t/evil.example",
    "/\n/evil.example",
    "/\r\n/evil.example",
    // Absolute URLs and other schemes.
    "https://evil.example/",
    "http://localhost:3000.evil.example/",
    "javascript:alert(1)",
    "data:text/html,hi",
    // Not a path at all.
    "lobby",
    " /lobby",
    "",
  ])("refuses %j", (raw) => {
    expect(safeNextPath(raw)).toBe("/lobby");
  });

  it("never sends the player back to the sign-in pages", () => {
    expect(safeNextPath("/login")).toBe("/lobby");
    expect(safeNextPath("/register?next=/match/1")).toBe("/lobby");
  });

  it("uses the given fallback", () => {
    expect(safeNextPath(null, "")).toBe("");
    expect(safeNextPath(undefined, "/profile")).toBe("/profile");
    expect(safeNextPath("//evil.example", "")).toBe("");
  });

  it("falls back while there is no window (prerendering)", () => {
    vi.unstubAllGlobals();
    expect(safeNextPath("/lobby", "/fallback")).toBe("/fallback");
  });
});

describe("authHref", () => {
  it("returns to the page the player came from", () => {
    expect(authHref("/login", "/lobby?code=X")).toBe("/login?next=%2Flobby%3Fcode%3DX");
    expect(authHref("/register", "/match/1")).toBe("/register?next=%2Fmatch%2F1");
  });

  it("tells the login page why the last session ended", () => {
    expect(authHref("/login", "/lobby", { ended: "expired" })).toBe("/login?next=%2Flobby&expired=1");
    expect(authHref("/login", "/match/1", { ended: "banned" })).toBe("/login?next=%2Fmatch%2F1&banned=1");
    expect(authHref("/login", "/lobby", { ended: null })).toBe("/login?next=%2Flobby");
  });

  it("leaves out a next that leads nowhere useful", () => {
    expect(authHref("/login")).toBe("/login");
    expect(authHref("/login", "/")).toBe("/login");
    expect(authHref("/login", "/login?next=/a")).toBe("/login");
    expect(authHref("/register", "/register")).toBe("/register");
  });
});

describe("current location helpers", () => {
  it("reads the path and query string", () => {
    expect(currentPathWithQuery()).toBe("/lobby?code=AB12CD");
  });

  it("knows the sign-in pages", () => {
    expect(isAuthPage("/login")).toBe(true);
    expect(isAuthPage("/register")).toBe(true);
    expect(isAuthPage("/lobby")).toBe(false);
  });
});
