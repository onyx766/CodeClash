"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { profile as profileApi } from "../lib/api";
import useAuth from "./useAuth";

export type ProfileUser = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  role: string;
  joinedAt: string;
};

export type ProfileStats = {
  // Ranked record: only Quick Match results touch these.
  rating: number;
  /** 1-based position among active players, by rating. */
  globalRank: number;
  wins: number;
  losses: number;
  draws: number;
  matchesPlayed: number;
  /** Ranked win rate in percent (0-100). */
  winRate: number;
  bestStreak: number;
  currentStreak: number;
  /** Challenges solved in any battle, ranked or casual. */
  challengesSolved: number;
  // Casual record: private-room results, which never affect rating.
  casualWins: number;
  casualLosses: number;
  casualDraws: number;
  casualMatchesPlayed: number;
};

export type ProfilePreferences = {
  favoriteLanguages: string[];
  favoriteTopics: string[];
};

/** Editable fields of PATCH /users/me/profile; omitted fields stay as they are, null clears one. */
export type ProfileChanges = Partial<{
  /** Up to 50 characters; null removes it and the username is shown. */
  displayName: string | null;
  /** Up to 300 characters; null removes it. */
  bio: string | null;
  /** Up to 100 characters; null removes it. */
  location: string | null;
  /** An absolute http(s) image URL; null removes it and the default avatar is shown. */
  avatarUrl: string | null;
  favoriteLanguages: string[];
  favoriteTopics: string[];
}>;

type ProfileResponse = { user: ProfileUser; stats: ProfileStats; preferences?: ProfilePreferences };

type Snapshot = {
  owner: string;
  profileUser: ProfileUser | null;
  stats: ProfileStats | null;
  preferences: ProfilePreferences | null;
};

type ProfileContextValue = {
  profileUser: ProfileUser | null;
  stats: ProfileStats | null;
  preferences: ProfilePreferences | null;
  /** True until the signed-in player's profile has been read once. */
  loading: boolean;
  /** Re-reads the profile, e.g. after a match. Keeps the last values if that fails. */
  refetch: () => Promise<void>;
  /** Saves profile changes; rejects with the API error so a form can show it. */
  update: (changes: ProfileChanges) => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  // Read by async callbacks, which must not store one player's profile after
  // another has signed in.
  const userIdRef = useRef(userId);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  // Every read (and every save, which answers with the whole profile) gets a
  // number; an answer older than the one on screen is dropped, so a slow
  // read that started before a match ended cannot overwrite fresher stats.
  const issued = useRef(0);
  const shown = useRef(0);

  const apply = useCallback((owner: string, id: number, res: ProfileResponse) => {
    if (owner !== userIdRef.current || id <= shown.current) return;
    shown.current = id;
    setSnapshot({
      owner,
      profileUser: res.user,
      stats: res.stats,
      preferences: res.preferences ?? null,
    });
  }, []);

  const load = useCallback(
    (owner: string): Promise<void> => {
      const id = ++issued.current;
      return profileApi.me().then(
        (res: ProfileResponse) => apply(owner, id, res),
        () => {
          // Keep the last known values. A first read that fails still ends
          // the loading state, with nothing to show.
          setSnapshot((prev) =>
            prev?.owner === owner || owner !== userIdRef.current
              ? prev
              : { owner, profileUser: null, stats: null, preferences: null },
          );
        },
      );
    },
    [apply],
  );

  useEffect(() => {
    if (userId) void load(userId);
  }, [userId, load]);

  const refetch = useCallback(async () => {
    const owner = userIdRef.current;
    if (owner) await load(owner);
  }, [load]);

  const update = useCallback(
    async (changes: ProfileChanges) => {
      const owner = userIdRef.current;
      if (!owner) return;
      // PATCH answers with the whole profile, as GET does. Its answer is
      // numbered on arrival: it already contains the change, so a read that
      // was sent while the save was running must not replace it.
      const res = (await profileApi.update(changes)) as ProfileResponse;
      apply(owner, ++issued.current, res);
    },
    [apply],
  );

  const current = userId && snapshot?.owner === userId ? snapshot : null;

  const value = useMemo(
    () => ({
      profileUser: current?.profileUser ?? null,
      stats: current?.stats ?? null,
      preferences: current?.preferences ?? null,
      loading: !!userId && !current,
      refetch,
      update,
    }),
    [current, userId, refetch, update],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export default function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return ctx;
}
