import { describe, expect, it } from "vitest";
import type { ProfilePreferences, ProfileUser } from "../hooks/useProfile";
import { isWebUrl, parseList, profileChanges, type ProfileForm } from "./profileForm";

const savedUser: ProfileUser = {
  id: "u1",
  username: "ada",
  displayName: "Ada L.",
  avatarUrl: "https://example.com/ada.png",
  bio: "Engines and numbers.",
  location: "London",
  country: null,
  region: null,
  city: null,
  role: "USER",
  joinedAt: "2026-01-01T00:00:00.000Z",
};
const savedPreferences: ProfilePreferences = { favoriteLanguages: ["JavaScript"], favoriteTopics: [] };
const saved = { profileUser: savedUser, preferences: savedPreferences };

/** The form as the modal opens it: the saved values. */
const unchanged: ProfileForm = {
  displayName: "Ada L.",
  bio: "Engines and numbers.",
  location: "London",
  avatarUrl: "https://example.com/ada.png",
  languages: "JavaScript",
  topics: "",
};

describe("profileChanges", () => {
  it("sends nothing when nothing changed", () => {
    expect(profileChanges(unchanged, saved)).toEqual({ changes: {} });
    // Surrounding spaces are not a change.
    expect(profileChanges({ ...unchanged, displayName: "  Ada L. " }, saved)).toEqual({ changes: {} });
  });

  it("sends only the fields that changed, trimmed", () => {
    expect(profileChanges({ ...unchanged, location: " Paris ", topics: "Graphs, graphs, DP" }, saved)).toEqual({
      changes: { location: "Paris", favoriteTopics: ["Graphs", "DP"] },
    });
  });

  it("clears the optional fields the player emptied by sending null", () => {
    const cleared = { ...unchanged, displayName: "", bio: "   ", location: "", avatarUrl: " " };
    expect(profileChanges(cleared, saved)).toEqual({
      changes: { displayName: null, bio: null, location: null, avatarUrl: null },
    });
  });

  it("does not send an empty field that was already empty", () => {
    const empty = { profileUser: { ...savedUser, displayName: null, bio: null }, preferences: savedPreferences };
    expect(profileChanges({ ...unchanged, displayName: "", bio: "" }, empty)).toEqual({ changes: {} });
  });

  it.each(["ftp://example.com/a.png", "javascript:alert(1)", "example.com/a.png", "/img/a.png"])(
    "refuses the avatar link %j",
    (avatarUrl) => {
      expect(profileChanges({ ...unchanged, avatarUrl }, saved)).toEqual({
        problem: "The avatar must be an image link starting with https://.",
      });
    },
  );

  it("takes http and https avatar links", () => {
    expect(profileChanges({ ...unchanged, avatarUrl: "http://example.com/a.png" }, saved)).toEqual({
      changes: { avatarUrl: "http://example.com/a.png" },
    });
  });

  it("checks the list limits", () => {
    expect(profileChanges({ ...unchanged, languages: "a, b, c, d, e, f" }, saved)).toEqual({
      problem: "Pick at most 5 languages.",
    });
    expect(profileChanges({ ...unchanged, topics: "x".repeat(51) }, saved)).toEqual({
      problem: "Each topic can be at most 50 characters long.",
    });
  });

  it("works before the profile has loaded", () => {
    expect(profileChanges({ ...unchanged, bio: "", location: "" }, { profileUser: null, preferences: null })).toEqual({
      changes: {
        displayName: "Ada L.",
        avatarUrl: "https://example.com/ada.png",
        favoriteLanguages: ["JavaScript"],
      },
    });
  });
});

describe("form helpers", () => {
  it("parses comma-separated lists", () => {
    expect(parseList(" JavaScript, Go,, javascript ,")).toEqual(["JavaScript", "Go"]);
    expect(parseList("")).toEqual([]);
  });

  it("recognises web links", () => {
    expect(isWebUrl("https://example.com/a.png")).toBe(true);
    expect(isWebUrl("http://example.com")).toBe(true);
    expect(isWebUrl("data:image/png;base64,AAAA")).toBe(false);
    expect(isWebUrl("not a url")).toBe(false);
  });
});
