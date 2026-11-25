import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CatalogueChallenge } from "../../lib/api";
import ChallengesRail from "./ChallengesRail";

const render = (props: Partial<Parameters<typeof ChallengesRail>[0]>) =>
  renderToStaticMarkup(<ChallengesRail challenges={null} activeTag={null} onSelectTag={() => undefined} {...props} />);

describe("ChallengesRail", () => {
  it("shows that the catalogue is loading", () => {
    expect(render({})).toContain("Loading…");
  });

  it("offers a retry when the catalogue could not be loaded, instead of loading forever", () => {
    const html = render({ failed: true, onRetry: () => undefined });
    expect(html).toContain("The catalogue could not be loaded.");
    expect(html).toContain("Try again");
    expect(html).not.toContain("Loading…");
  });

  it("breaks the loaded catalogue down by difficulty", () => {
    const challenge = { id: "c1", difficulty: "EASY", tags: ["arrays"] } as CatalogueChallenge;
    const html = render({ challenges: [challenge, { ...challenge, id: "c2", difficulty: "HARD", tags: [] }] });
    expect(html).toContain(">2<");
    expect(html).toContain("Arrays");
  });
});
