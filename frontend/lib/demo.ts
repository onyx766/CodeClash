export type DemoUser = {
  name: string;
  avatar: string;
  rating: number;
};

export const currentUser = {
  name: "Tyler",
  username: "tyler_dev",
  avatar: "/img/avatars/avatar-7.png",
  rating: 1850,
  level: 12,
  xp: 2450,
  xpGoal: 4000,
  wins: 128,
  losses: 42,
  winRate: 75,
  streak: 7,
  globalRank: 3248,
  rankDelta: 128,
  topPercent: "3.2%",
};

export const onlineFriends: (DemoUser & { status: string })[] = [
  { name: "Alex", avatar: "/img/avatars/avatar-6.png", rating: 1920, status: "In Lobby" },
  { name: "Jason", avatar: "/img/avatars/avatar-1.png", rating: 1780, status: "In a Match" },
  { name: "Mike", avatar: "/img/avatars/avatar-13.png", rating: 1650, status: "In Lobby" },
  { name: "Sarah", avatar: "/img/avatars/avatar-2.png", rating: 1600, status: "Online" },
  { name: "David", avatar: "/img/avatars/avatar-3.png", rating: 1580, status: "Online" },
];

export const activeRooms = [
  { code: "AB12CD", host: "Jason", avatar: "/img/avatars/avatar-1.png", players: 1, max: 2, level: "All Levels", req: "Any Level", tone: "blue" },
  { code: "ZX7Y89", host: "Alex", avatar: "/img/avatars/avatar-6.png", players: 2, max: 2, level: "Senior+", req: "1500+ Rating", tone: "teal" },
  { code: "QW34ER", host: "Mike", avatar: "/img/avatars/avatar-13.png", players: 1, max: 2, level: "Beginner Friendly", req: "Any Level", tone: "amber" },
  { code: "PL98OK", host: "Sarah", avatar: "/img/avatars/avatar-2.png", players: 1, max: 2, level: "All Levels", req: "Any Level", tone: "rose" },
] as const;

export const recentActivity = [
  { icon: "trophy", title: "You won against Alex", meta: "+24 Rating", time: "2m ago", tone: "green" },
  { icon: "zap", title: "New personal best!", meta: 'Solved "Two Sum" in 1.24s', time: "15m ago", tone: "violet" },
  { icon: "chart", title: "You reached Level 12", meta: "Keep going!", time: "1h ago", tone: "blue" },
  { icon: "flame", title: "Tournament starts soon", meta: "JS Masters • Starts in 2h", time: "2h ago", tone: "amber" },
] as const;

export type LeaderRow = {
  rank: number;
  name: string;
  avatar: string;
  tier: "Pro" | "Expert" | "Advanced";
  flag: string;
  country: string;
  rating: number;
  wins: number;
  winRate: string;
  streak: number;
};

export const leaderboard: LeaderRow[] = [
  { rank: 1, name: "Alex Kim", avatar: "/img/avatars/avatar-6.png", tier: "Pro", flag: "🇰🇷", country: "Seoul, South Korea", rating: 1820, wins: 342, winRate: "78.4%", streak: 12 },
  { rank: 2, name: "Sarah Chen", avatar: "/img/avatars/avatar-2.png", tier: "Pro", flag: "🇨🇦", country: "Vancouver, Canada", rating: 1650, wins: 298, winRate: "76.1%", streak: 10 },
  { rank: 3, name: "Jason Lee", avatar: "/img/avatars/avatar-1.png", tier: "Pro", flag: "🇸🇬", country: "Singapore", rating: 1780, wins: 310, winRate: "75.2%", streak: 9 },
  { rank: 4, name: "Mike Wong", avatar: "/img/avatars/avatar-13.png", tier: "Expert", flag: "🇭🇰", country: "Hong Kong", rating: 1600, wins: 260, winRate: "74.3%", streak: 8 },
  { rank: 5, name: "David Park", avatar: "/img/avatars/avatar-3.png", tier: "Expert", flag: "🇺🇸", country: "Los Angeles, USA", rating: 1580, wins: 244, winRate: "72.8%", streak: 7 },
  { rank: 6, name: "Emma Davis", avatar: "/img/avatars/avatar-4.png", tier: "Expert", flag: "🇬🇧", country: "London, UK", rating: 1520, wins: 232, winRate: "71.2%", streak: 7 },
  { rank: 7, name: "Arjun Patel", avatar: "/img/avatars/avatar-5.png", tier: "Expert", flag: "🇮🇳", country: "Bangalore, India", rating: 1520, wins: 218, winRate: "70.1%", streak: 6 },
  { rank: 8, name: "Kevin Liu", avatar: "/img/avatars/avatar-9.png", tier: "Advanced", flag: "🇹🇼", country: "Taipei, Taiwan", rating: 1480, wins: 210, winRate: "68.9%", streak: 6 },
  { rank: 9, name: "Daniel Zhang", avatar: "/img/avatars/avatar-10.png", tier: "Advanced", flag: "🇨🇳", country: "Beijing, China", rating: 1460, wins: 198, winRate: "67.1%", streak: 5 },
  { rank: 10, name: "Olivia Smith", avatar: "/img/avatars/avatar-8.png", tier: "Advanced", flag: "🇺🇸", country: "New York, USA", rating: 1440, wins: 185, winRate: "66.8%", streak: 5 },
];

export const topWeekly = [
  { rank: 1, name: "Alex Kim", avatar: "/img/avatars/avatar-6.png", rating: 1820, delta: 120 },
  { rank: 2, name: "Jason Lee", avatar: "/img/avatars/avatar-1.png", rating: 1780, delta: 85 },
  { rank: 3, name: "Sarah Chen", avatar: "/img/avatars/avatar-2.png", rating: 1650, delta: 60 },
];

export const recentWinners = [
  { text: "Tyler won against Alex", time: "2m ago", avatar: "/img/avatars/avatar-7.png" },
  { text: "Sarah won against Jason", time: "15m ago", avatar: "/img/avatars/avatar-2.png" },
  { text: "Mike won against David", time: "1h ago", avatar: "/img/avatars/avatar-13.png" },
];

export type Post = {
  author: string;
  avatar: string;
  rating: number;
  time: string;
  category: string;
  pinned?: boolean;
  title: string;
  excerpt: string;
  tags: string[];
  comments: number;
  views: number;
  likes: number;
  thumb?: string;
};

export const posts: Post[] = [
  {
    author: "Alex Kim",
    avatar: "/img/avatars/avatar-6.png",
    rating: 1820,
    time: "2h ago",
    category: "Discussions",
    pinned: true,
    title: 'What\u2019s the best approach to solve "Two Sum" in JavaScript?',
    excerpt:
      "I know there are multiple ways, but I'm curious what you all prefer and why. Time complexity, readability, trade-offs, everything is welcome!",
    tags: ["JavaScript", "Algorithms", "Arrays"],
    comments: 18,
    views: 256,
    likes: 24,
  },
  {
    author: "Sarah Chen",
    avatar: "/img/avatars/avatar-2.png",
    rating: 1650,
    time: "5h ago",
    category: "Tips & Solutions",
    title: "Understanding Closures in JavaScript (With Examples)",
    excerpt:
      "Closures can be tricky at first. I wrote a simple breakdown with examples that helped me a lot. Hope this helps someone too!",
    tags: ["JavaScript"],
    comments: 12,
    views: 198,
    likes: 31,
  },
  {
    author: "Jason Lee",
    avatar: "/img/avatars/avatar-1.png",
    rating: 1780,
    time: "7h ago",
    category: "Looking for Opponent",
    title: "Looking for 1v1 match \u2013 Around 1700+ rating",
    excerpt:
      "I'm online most evenings (EST). Let's have a good match and improve together!",
    tags: ["1v1", "1700+", "Quick Match"],
    comments: 6,
    views: 112,
    likes: 8,
  },
  {
    author: "Mike Wong",
    avatar: "/img/avatars/avatar-13.png",
    rating: 1600,
    time: "1d ago",
    category: "Showcase",
    title: "Built a JS Visualizer for Binary Search Tree",
    excerpt:
      "A small project I built to visualize BST operations step by step. Feedback welcome!",
    tags: ["JavaScript", "Visualization"],
    comments: 7,
    views: 147,
    likes: 19,
    thumb: "/img/how-it-works-hero.png",
  },
  {
    author: "Emma Davis",
    avatar: "/img/avatars/avatar-4.png",
    rating: 1520,
    time: "1d ago",
    category: "Announcements",
    title: "Weekly 1v1 Tournament \u2014 registration is open",
    excerpt:
      "1,024 slots, single elimination, best of 3 rounds. Winners get exclusive season rewards.",
    tags: ["Tournament", "Announcement"],
    comments: 34,
    views: 512,
    likes: 66,
  },
];

export const topContributors = [
  { rank: 1, name: "Alex Kim", avatar: "/img/avatars/avatar-6.png", rating: 1820, posts: 125 },
  { rank: 2, name: "Sarah Chen", avatar: "/img/avatars/avatar-2.png", rating: 1650, posts: 98 },
  { rank: 3, name: "Jason Lee", avatar: "/img/avatars/avatar-1.png", rating: 1780, posts: 87 },
  { rank: 4, name: "Mike Wong", avatar: "/img/avatars/avatar-13.png", rating: 1600, posts: 76 },
  { rank: 5, name: "David Park", avatar: "/img/avatars/avatar-3.png", rating: 1580, posts: 65 },
];

export const upcomingEvents = [
  {
    title: "Weekly 1v1 Tournament",
    date: "May 18, 2025 • 7:00 PM EST",
    going: "1,024 going",
    tone: "violet",
  },
  {
    title: "JS Algorithm Workshop",
    date: "May 24, 2025 • 3:00 PM EST",
    going: "512 going",
    tone: "blue",
  },
] as const;

export const testimonials = [
  {
    name: "Kevin Liu",
    handle: "@kevin_dev",
    avatar: "/img/avatars/avatar-9.png",
    text: "CodeClash helped me improve my algorithm skills while competing with others!",
  },
  {
    name: "Emma Davis",
    handle: "@emma.v",
    avatar: "/img/avatars/avatar-4.png",
    text: "The real-time battles are addictive. Perfect for developers who love a challenge.",
  },
  {
    name: "Arjun Patel",
    handle: "@arjun_code",
    avatar: "/img/avatars/avatar-5.png",
    text: "Great challenges, fair matchmaking, and an awesome community!",
  },
];

export const avatarStack = [
  "/img/avatars/avatar-1.png",
  "/img/avatars/avatar-2.png",
  "/img/avatars/avatar-3.png",
  "/img/avatars/avatar-4.png",
  "/img/avatars/avatar-5.png",
  "/img/avatars/avatar-6.png",
  "/img/avatars/avatar-9.png",
];
