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
        <header className="w-full border-b bg-white/80 dark:bg-black/80">
          <nav className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="text-lg font-semibold">CodeClash</div>
            <div className="flex items-center gap-3">
              <Link href="/" className="text-sm hover:underline">Home</Link>
              <Link href="/lobby" className="text-sm hover:underline">Lobby</Link>
              <Link href="/infra" className="text-sm hover:underline">Infra</Link>
              <Link href="/login" className="text-sm hover:underline">Login</Link>
              <Link href="/register" className="text-sm hover:underline">Register</Link>
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
