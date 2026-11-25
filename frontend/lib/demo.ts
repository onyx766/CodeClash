// Static marketing content for the landing and community pages. Nothing in
// here comes from, or stands in for, the API: live data (players, ratings,
// matches, the leaderboard) is always loaded from the backend.

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
