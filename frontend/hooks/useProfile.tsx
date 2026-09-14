"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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
  rating: number;
  globalRank: number;
  wins: number;
  losses: number;
  matchesPlayed: number;
  winRate: number;
  bestStreak: number;
  currentStreak: number;
  challengesSolved: number;
  coins: number;
  xp: number;
};

type ProfileContextValue = {
  profileUser: ProfileUser | null;
  stats: ProfileStats | null;
  loading: boolean;
  refetch: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [profileUser, setProfileUser] = useState<ProfileUser | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setProfileUser(null);
      setStats(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await profileApi.me();
      setProfileUser(res.user);
      setStats(res.stats);
    } catch {
      setProfileUser(null);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo(
    () => ({ profileUser, stats, loading, refetch: load }),
    [profileUser, stats, loading, load],
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
