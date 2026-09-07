import { Role } from '@prisma/client';

export interface UserPreferencesView {
  favoriteLanguages: string[];
  favoriteTopics: string[];
}

export interface PrivateProfileUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  // Approximate, IP-derived location - see GeolocationService. Best-effort
  // and may be null; never treat as precise.
  country: string | null;
  region: string | null;
  city: string | null;
  timezone: string | null;
  role: Role;
  joinedAt: Date;
}

export interface PublicProfileUser {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  // Approximate, IP-derived location. Timezone is withheld on public
  // profiles - it's not needed publicly and narrows the visitor's locale.
  country: string | null;
  region: string | null;
  city: string | null;
  role: Role;
  joinedAt: Date;
}

export interface PrivateProfileStats {
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
}

export interface PublicProfileStats {
  rating: number;
  globalRank: number;
  wins: number;
  losses: number;
  winRate: number;
  bestStreak: number;
  challengesSolved: number;
}

export interface MyProfileResponse {
  success: true;
  user: PrivateProfileUser;
  stats: PrivateProfileStats;
  preferences: UserPreferencesView;
}

export interface PublicProfileResponse {
  success: true;
  user: PublicProfileUser;
  stats: PublicProfileStats;
  preferences: UserPreferencesView;
}

export interface SafeAdminUser {
  id: string;
  username: string;
  email: string;
  role: Role;
  createdAt: Date;
}
