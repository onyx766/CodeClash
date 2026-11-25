"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { ApiError } from "../../lib/api";
import useProfile, { type ProfileChanges } from "../../hooks/useProfile";

// Limits enforced by PATCH /users/me/profile (UpdateProfileDto).
const MAX = {
  displayName: 50,
  bio: 300,
  location: 100,
  avatarUrl: 500,
  languages: 5,
  language: 30,
  topics: 10,
  topic: 50,
};

/** "JavaScript, Go, javascript" -> ["JavaScript", "Go"]: trimmed, blanks and repeats dropped. */
function parseList(raw: string): string[] {
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

function isWebUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[12px] font-semibold text-muted">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-dim">{hint}</p>}
    </div>
  );
}

/** PATCH /users/me/profile. Only changed fields are sent; the page updates from the answer. */
export default function EditProfileModal({ onClose }: { onClose: () => void }) {
  const { profileUser, preferences, update } = useProfile();
  const [displayName, setDisplayName] = useState(profileUser?.displayName ?? "");
  const [bio, setBio] = useState(profileUser?.bio ?? "");
  const [location, setLocation] = useState(profileUser?.location ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profileUser?.avatarUrl ?? "");
  const [languages, setLanguages] = useState((preferences?.favoriteLanguages ?? []).join(", "));
  const [topics, setTopics] = useState((preferences?.favoriteTopics ?? []).join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (saving) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saving, onClose]);

  /** The fields that differ from the saved profile, or why the form cannot be saved. */
  const collectChanges = (): { changes: ProfileChanges } | { problem: string } => {
    const changes: ProfileChanges = {};

    const name = displayName.trim();
    if (name !== (profileUser?.displayName ?? "")) {
      if (!name) return { problem: "Enter a display name. It can be changed, but not removed." };
      changes.displayName = name;
    }

    const nextBio = bio.trim();
    if (nextBio !== (profileUser?.bio ?? "")) changes.bio = nextBio;

    const nextLocation = location.trim();
    if (nextLocation !== (profileUser?.location ?? "")) changes.location = nextLocation;

    const nextAvatar = avatarUrl.trim();
    if (nextAvatar !== (profileUser?.avatarUrl ?? "")) {
      if (nextAvatar && !isWebUrl(nextAvatar)) {
        return { problem: "The avatar must be an image link starting with https://." };
      }
      // null removes a custom avatar; the default one is shown again.
      changes.avatarUrl = nextAvatar || null;
    }

    const nextLanguages = parseList(languages);
    if (nextLanguages.length > MAX.languages) return { problem: `Pick at most ${MAX.languages} languages.` };
    if (nextLanguages.some((l) => l.length > MAX.language)) {
      return { problem: `Each language can be at most ${MAX.language} characters long.` };
    }
    if (!sameList(nextLanguages, preferences?.favoriteLanguages ?? [])) changes.favoriteLanguages = nextLanguages;

    const nextTopics = parseList(topics);
    if (nextTopics.length > MAX.topics) return { problem: `Pick at most ${MAX.topics} topics.` };
    if (nextTopics.some((t) => t.length > MAX.topic)) {
      return { problem: `Each topic can be at most ${MAX.topic} characters long.` };
    }
    if (!sameList(nextTopics, preferences?.favoriteTopics ?? [])) changes.favoriteTopics = nextTopics;

    return { changes };
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;
    setError("");
    const result = collectChanges();
    if ("problem" in result) {
      setError(result.problem);
      return;
    }
    if (Object.keys(result.changes).length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await update(result.changes);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Your profile could not be saved. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={saving ? undefined : onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        className="card max-h-[90vh] w-full max-w-[540px] overflow-y-auto p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="edit-profile-title" className="text-[22px] font-extrabold tracking-[-0.02em]">
              Edit Profile
            </h2>
            <p className="mt-1.5 text-[13px] text-dim">This is what other players see on your profile.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-dim hover:bg-white/5 hover:text-fg"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <Field id="profile-display-name" label="Display name" hint="Shown instead of your username.">
            <input
              id="profile-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={MAX.displayName}
              autoFocus
              className="field"
            />
          </Field>

          <Field id="profile-bio" label="Bio" hint={`${bio.length} / ${MAX.bio}`}>
            <textarea
              id="profile-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={MAX.bio}
              rows={3}
              className="field resize-y"
            />
          </Field>

          <Field id="profile-location" label="Location">
            <input
              id="profile-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={MAX.location}
              placeholder="e.g. Berlin, Germany"
              className="field"
            />
          </Field>

          <Field id="profile-avatar" label="Avatar image URL" hint="Leave empty to use the default avatar.">
            <input
              id="profile-avatar"
              type="url"
              inputMode="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              maxLength={MAX.avatarUrl}
              placeholder="https://…"
              className="field"
            />
          </Field>

          <Field
            id="profile-languages"
            label="Favorite languages"
            hint={`Separate with commas, up to ${MAX.languages}.`}
          >
            <input
              id="profile-languages"
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
              placeholder="JavaScript, TypeScript"
              className="field"
            />
          </Field>

          <Field id="profile-topics" label="Favorite topics" hint={`Separate with commas, up to ${MAX.topics}.`}>
            <input
              id="profile-topics"
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              placeholder="Arrays, Dynamic Programming"
              className="field"
            />
          </Field>
        </div>

        {error && (
          <p role="alert" className="mt-5 rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-[12.5px] text-rose-300">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={saving} className="btn btn-ghost sm:w-auto">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn btn-blue sm:w-auto">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
