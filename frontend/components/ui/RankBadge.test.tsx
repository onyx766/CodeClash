import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RankBadge from "./RankBadge";

const GOLD = "from-amber-300";

describe("RankBadge", () => {
  it("gives every player who shares first place the gold medal", () => {
    const ranks = [1, 1, 1, 4].map((rank) => renderToStaticMarkup(<RankBadge rank={rank} />));

    expect(ranks.slice(0, 3).every((html) => html.includes(GOLD) && html.includes(">1<"))).toBe(true);
    expect(ranks[3]).not.toContain(GOLD);
    expect(ranks[3]).toContain(">4<");
  });

  it("shows silver and bronze medals by rank, and plain numbers below", () => {
    expect(renderToStaticMarkup(<RankBadge rank={2} />)).toContain("from-slate-200");
    expect(renderToStaticMarkup(<RankBadge rank={3} />)).toContain("from-orange-300");
    const fifth = renderToStaticMarkup(<RankBadge rank={5} />);
    expect(fifth).not.toContain("rounded-full");
    expect(fifth).toContain(">5<");
  });
});
