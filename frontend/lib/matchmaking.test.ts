import { describe, expect, it } from "vitest";
import type { BattlePlayer } from "./battle";
import { readyCheckAcceptance } from "./matchmaking";

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
