import { describe, expect, it } from "vitest";
import type { BattlePlayer } from "./battle";
import {
  describeCancellation,
  readyCheckAcceptance,
  readyCheckEndFor,
  readyCheckFailure,
  type ReadyCheckEnd,
} from "./matchmaking";

function player(id: string, ready?: boolean): BattlePlayer {
  return {
    id,
    username: id,
    displayName: null,
    avatarUrl: null,
    rating: 1200,
    ratingAfter: null,
    solved: 0,
    total: 0,
    totalSolveDurationMs: 0,
    gaveUp: false,
    ...(ready === undefined ? {} : { ready }),
  };
}

describe("readyCheckAcceptance", () => {
  it("takes who accepted from the API, so a reload keeps it", () => {
    const match = { me: player("me", true), opponent: player("them", false) };
    expect(readyCheckAcceptance(match, [])).toEqual({ me: true, opponent: false });
  });

  it("adds the players match:ready announced since the last read", () => {
    const match = { me: player("me", false), opponent: player("them", false) };
    expect(readyCheckAcceptance(match, ["them"])).toEqual({ me: false, opponent: true });
    expect(readyCheckAcceptance(match, ["me", "them"])).toEqual({ me: true, opponent: true });
  });

  it("counts this tab's own accept before the server reports it", () => {
    const match = { me: player("me", false), opponent: player("them", false) };
    expect(readyCheckAcceptance(match, [], true)).toEqual({ me: true, opponent: false });
  });

  it("works with API versions that send no ready flags", () => {
    const match = { me: player("me"), opponent: player("them") };
    expect(readyCheckAcceptance(match, [])).toEqual({ me: false, opponent: false });
    expect(readyCheckAcceptance(match, ["them"])).toEqual({ me: false, opponent: true });
  });

  it("has nobody accept for a seat that is empty", () => {
    expect(readyCheckAcceptance({ me: null, opponent: null }, ["me"])).toEqual({ me: false, opponent: false });
  });
});

describe("describeCancellation", () => {
  it("tells a player who missed the ready check, without touching their search", () => {
    const { readyCheck, notice } = describeCancellation({ matchId: "m1", reason: "READY_TIMEOUT" });
    expect(readyCheck).toBe(true);
    expect(notice).toEqual({
      tone: "info",
      text: "You didn't accept the match in time, so it was cancelled.",
      retry: true,
    });
  });

  it("reports a match that could not be started as an error", () => {
    const { readyCheck, notice } = describeCancellation({ matchId: "m1", reason: "START_FAILED" });
    expect(readyCheck).toBe(true);
    expect(notice).toMatchObject({ tone: "error", text: "The match could not be started. Please search again." });
  });

  it("never mistakes a failed ready check for a search that ended", () => {
    for (const reason of ["READY_TIMEOUT", "START_FAILED"]) {
      expect(describeCancellation({ reason }).readyCheck).toBe(true);
      expect(describeCancellation({ matchId: "m1", reason }).notice?.text).not.toMatch(/queue|search has stopped/i);
    }
  });

  it("explains a search dropped for a lost connection", () => {
    expect(describeCancellation({ reason: "STALE" })).toEqual({
      readyCheck: false,
      notice: { tone: "error", text: "You were removed from the queue because the connection was lost.", retry: true },
    });
  });

  it("ends the search quietly when the player took a room seat", () => {
    expect(describeCancellation({ reason: "JOINED_ROOM" })).toEqual({ readyCheck: false, notice: null });
  });

  it("understands API versions that send no reason", () => {
    expect(describeCancellation({ matchId: "m1" })).toEqual({
      readyCheck: true,
      notice: { tone: "info", text: "The match was cancelled before it started.", retry: true },
    });
    expect(describeCancellation(undefined)).toEqual({
      readyCheck: false,
      notice: { tone: "info", text: "Your search has stopped.", retry: true },
    });
  });
});

describe("readyCheckEndFor", () => {
  it("maps the cancellation reasons", () => {
    expect(readyCheckEndFor({ matchId: "m1", reason: "READY_TIMEOUT" })).toBe("ready-timeout");
    expect(readyCheckEndFor({ matchId: "m1", reason: "START_FAILED" })).toBe("start-failed");
    expect(readyCheckEndFor({ matchId: "m1" })).toBe("cancelled");
  });
});

describe("readyCheckFailure", () => {
  const participant = (meReady?: boolean) => ({
    viewer: "PARTICIPANT" as const,
    finishReason: null,
    me: player("me", meReady),
  });
  const nobody = { me: false, opponent: false };

  it.each<[ReadyCheckEnd, { me: boolean; opponent: boolean }, string]>([
    ["ready-timeout", nobody, "you-timed-out"],
    ["start-failed", { me: true, opponent: true }, "start-failed"],
    ["opponent-unavailable", { me: true, opponent: false }, "opponent-timed-out"],
    ["cancelled", nobody, "timed-out"],
  ])("says what the %s event reported", (end, accepted, expected) => {
    expect(readyCheckFailure(participant(), end, accepted)).toBe(expected);
  });

  it("works it out from the ready flags after a reload", () => {
    expect(readyCheckFailure(participant(true), null, { me: true, opponent: true })).toBe("start-failed");
    expect(readyCheckFailure(participant(true), null, { me: true, opponent: false })).toBe("opponent-timed-out");
    expect(readyCheckFailure(participant(false), null, nobody)).toBe("you-timed-out");
    // API versions without the flags.
    expect(readyCheckFailure(participant(), null, nobody)).toBe("timed-out");
  });

  it("treats a match the system cancelled as one that could not start", () => {
    const match = { ...participant(false), finishReason: "SYSTEM_CANCELLED" as const };
    expect(readyCheckFailure(match, null, nobody)).toBe("start-failed");
  });

  it("never tells a spectator that they missed the ready check", () => {
    const match = { viewer: "SPECTATOR" as const, finishReason: null, me: player("a", false) };
    expect(readyCheckFailure(match, null, nobody)).toBe("timed-out");
    expect(readyCheckFailure(match, "start-failed", nobody)).toBe("start-failed");
  });
});
