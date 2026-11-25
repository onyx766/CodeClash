import Link from "next/link";
import Logo from "../ui/Logo";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Lobby", href: "/lobby" },
      { label: "Challenges", href: "/challenges" },
      { label: "Leaderboard", href: "/leaderboard" },
      { label: "How It Works", href: "/how-it-works" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "Discussions", href: "/community" },
      { label: "Tips & Solutions", href: "/community" },
      { label: "Events", href: "/community" },
      { label: "Announcements", href: "/community" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="cc-container grid gap-10 py-14 md:grid-cols-3 lg:grid-cols-[1.4fr_1fr_1fr] lg:gap-8">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-dim">
            The ultimate platform for real-time coding battles and developer growth.
          </p>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <h3 className="text-[13px] font-bold text-fg">{col.title}</h3>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-[13px] text-dim transition-colors hover:text-fg"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-line/70">
        <div className="cc-container flex flex-col items-center justify-between gap-3 py-5 text-[12.5px] text-dim sm:flex-row">
          <span>© 2024 CodeClash. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}

export function AuthFooter() {
  return (
    <div className="border-t border-line/70 py-5">
      <div className="cc-container flex flex-col items-center justify-between gap-2 text-[12.5px] text-dim sm:flex-row">
        <span>© 2024 CodeClash. All rights reserved.</span>
        <div className="flex items-center gap-5">
          <span>Terms of Service</span>
          <span>Privacy Policy</span>
          <span>Contact Us</span>
        </div>
      </div>
    </div>
  );
}
