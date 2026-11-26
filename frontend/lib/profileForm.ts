import type { ProfileChanges, ProfilePreferences, ProfileUser } from "../hooks/useProfile";

// Limits enforced by PATCH /users/me/profile (UpdateProfileDto).
export const PROFILE_LIMITS = {
  displayName: 50,
  bio: 300,
  location: 100,
  avatarUrl: 500,
  languages: 5,
  language: 30,
  topics: 10,
  topic: 50,
};

/** What the edit form holds: every field as typed. */
export type ProfileForm = {
  displayName: string;
  bio: string;
  location: string;
  avatarUrl: string;
  /** Comma-separated. */
  languages: string;
  topics: string;
};

/** "JavaScript, Go, javascript" -> ["JavaScript", "Go"]: trimmed, blanks and repeats dropped. */
export function parseList(raw: string): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const part of raw.split(",")) {
    const item = part.trim();
    const key = item.toLowerCase();
    if (item && !seen.has(key)) {
      seen.add(key);
      items.push(item);
    }
  }
  return items;
}

function sameList(a: string[], b: string[]) {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

/** An absolute http:// or https:// URL - the only avatar links the API takes. */
export function isWebUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** The new value of an optional text field, or undefined when unchanged. Emptied, it is null, which clears it. */
function changedText(value: string, saved: string | null | undefined): string | null | undefined {
  const next = value.trim();
  if (next === (saved ?? "")) return undefined;
  return next || null;
}

/** The fields that differ from the saved profile - all PATCH needs - or why the form cannot be saved. */
export function profileChanges(
  form: ProfileForm,
  saved: { profileUser: ProfileUser | null; preferences: ProfilePreferences | null },
): { changes: ProfileChanges } | { problem: string } {
  const changes: ProfileChanges = {};
  const { profileUser, preferences } = saved;

  const displayName = changedText(form.displayName, profileUser?.displayName);
  if (displayName !== undefined) changes.displayName = displayName;

  const bio = changedText(form.bio, profileUser?.bio);
  if (bio !== undefined) changes.bio = bio;

  const location = changedText(form.location, profileUser?.location);
  if (location !== undefined) changes.location = location;

  const avatarUrl = changedText(form.avatarUrl, profileUser?.avatarUrl);
  if (avatarUrl !== undefined) {
    if (avatarUrl && !isWebUrl(avatarUrl)) {
      return { problem: "The avatar must be an image link starting with https://." };
    }
    changes.avatarUrl = avatarUrl;
  }

  const languages = parseList(form.languages);
  if (languages.length > PROFILE_LIMITS.languages) return { problem: `Pick at most ${PROFILE_LIMITS.languages} languages.` };
  if (languages.some((l) => l.length > PROFILE_LIMITS.language)) {
    return { problem: `Each language can be at most ${PROFILE_LIMITS.language} characters long.` };
  }
  if (!sameList(languages, preferences?.favoriteLanguages ?? [])) changes.favoriteLanguages = languages;

  const topics = parseList(form.topics);
  if (topics.length > PROFILE_LIMITS.topics) return { problem: `Pick at most ${PROFILE_LIMITS.topics} topics.` };
  if (topics.some((t) => t.length > PROFILE_LIMITS.topic)) {
    return { problem: `Each topic can be at most ${PROFILE_LIMITS.topic} characters long.` };
  }
  if (!sameList(topics, preferences?.favoriteTopics ?? [])) changes.favoriteTopics = topics;

  return { changes };
}
