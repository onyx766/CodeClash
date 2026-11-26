import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuickMatchPhase } from "../../hooks/useQuickMatch";
import QuickMatchIndicator from "./QuickMatchIndicator";

const quickMatch = vi.hoisted(() => ({
  phase: "searching" as QuickMatchPhase,
  searchShownOnPage: false,
}));

vi.mock("../../hooks/useQuickMatch", () => ({
  default: () => ({
    phase: quickMatch.phase,
    search: { joinedAt: new Date().toISOString(), rating: 1200, ratingRange: { min: 1100, max: 1300 } },
    searchShownOnPage: quickMatch.searchShownOnPage,
    cancel: async () => undefined,
  }),
}));

beforeEach(() => {
  quickMatch.phase = "searching";
  quickMatch.searchShownOnPage = false;
});

describe("QuickMatchIndicator", () => {
  it("shows a running search on any page, finished matches included", () => {
    expect(renderToStaticMarkup(<QuickMatchIndicator />)).toContain("Searching for an opponent");
  });

  it("stays hidden where the page shows the search itself", () => {
    quickMatch.searchShownOnPage = true;
    expect(renderToStaticMarkup(<QuickMatchIndicator />)).toBe("");
  });

  it("stays hidden while nobody is searching", () => {
    quickMatch.phase = "idle";
    expect(renderToStaticMarkup(<QuickMatchIndicator />)).toBe("");
  });
});
