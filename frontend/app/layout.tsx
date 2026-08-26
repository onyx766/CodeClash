import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CodeClash",
  description: "Real-time JS coding challenge platform",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="w-full">
          <div className="util-bar">
            <div className="cc-container flex items-center">
              <div className="util-left">CodeClash</div>
              <div className="util-right">
                <a href="/support" className="uppercase text-[12px]">Support</a>
                <Link href="/login" className="uppercase text-[12px]">Login</Link>
              </div>
            </div>
          </div>
          <div className="main-nav">
            <div className="cc-container flex items-center">
              <div className="brand">CodeClash</div>
              <nav className="nav-links">
                <a href="/challenges" className="nav-link">Challenges</a>
                <a href="/leaderboard" className="nav-link">Leaderboard</a>
                <a href="/how-it-works" className="nav-link">How It Works</a>
                <a href="/community" className="nav-link">Community</a>
              </nav>
              <div className="nav-right">
                <a href="/lobby" className="btn-primary">Start Competing</a>
              </div>
            </div>
          </div>
        </div>
        <main className="flex-1">{children}</main>
        <footer className="site-footer">
          <div className="cc-container flex flex-col md:flex-row items-start md:items-center justify-between">
            <div>
              <div className="font-semibold">CodeClash</div>
              <div className="muted">Compete. Code. Improve.</div>
            </div>
            <div className="flex gap-8 mt-4 md:mt-0">
              <div className="flex flex-col">
                <a href="/" className="nav-link">Home</a>
                <a href="/lobby" className="nav-link">Lobby</a>
              </div>
              <div className="flex flex-col">
                <a href="/leaderboard" className="nav-link">Leaderboard</a>
                <a href="/challenges" className="nav-link">Challenges</a>
              </div>
            </div>
            <div className="muted mt-4 md:mt-0">© CodeClash</div>
          </div>
        </footer>
      </body>
    </html>
  );
}
