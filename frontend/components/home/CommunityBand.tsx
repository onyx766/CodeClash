"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Lightbulb, MessageSquare, Star, Users } from "lucide-react";
import { testimonials } from "../../lib/demo";
import { Avatar } from "../ui/Bits";

const stats = [
  { icon: MessageSquare, tone: "text-blue-300", value: "8.7K+", label: "Discussions" },
  { icon: Lightbulb, tone: "text-emerald-300", value: "3.2K+", label: "Tips & Solutions" },
  { icon: Users, tone: "text-violet-300", value: "1.2K+", label: "Active Members" },
];

export default function CommunityBand() {
  const [page, setPage] = useState(0);
  const pages = 6;

  return (
    <section className="cc-container py-8">
      <div className="card grid gap-8 overflow-hidden bg-gradient-to-br from-[#0d1730] to-[#0b1020] p-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:p-9">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-400">
            Community
          </p>
          <h2 className="mt-3 text-[clamp(1.5rem,3vw,2rem)] font-extrabold leading-tight tracking-[-0.025em]">
            Join a Thriving
            <br />
            Developer Community
          </h2>
          <p className="mt-3 text-[13.5px] text-dim">Learn, share, and grow together.</p>

          <div className="mt-6 flex flex-wrap gap-6">
            {stats.map((s) => (
              <div key={s.label}>
                <p className={`flex items-center gap-1.5 text-[17px] font-extrabold ${s.tone}`}>
                  <s.icon size={15} strokeWidth={2.2} />
                  {s.value}
                </p>
                <p className="mt-1 text-[11.5px] text-dim">{s.label}</p>
              </div>
            ))}
          </div>

          <Link href="/community" className="btn btn-blue mt-7 !px-5">
            Explore Community <ArrowRight size={15} />
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Previous testimonials"
            onClick={() => setPage((p) => (p - 1 + pages) % pages)}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-panel text-muted transition-colors hover:text-fg md:inline-flex"
          >
            <ChevronLeft size={17} />
          </button>

          <div className="min-w-0 flex-1">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((t) => (
                <figure key={t.name} className="card-soft p-4">
                  <figcaption className="flex items-center gap-2.5">
                    <Avatar src={t.avatar} alt={t.name} size={34} />
                    <span>
                      <span className="block text-[13px] font-semibold">{t.name}</span>
                      <span className="block text-[11px] text-dim">{t.handle}</span>
                    </span>
                  </figcaption>
                  <blockquote className="mt-3 text-[12.5px] leading-relaxed text-muted">
                    {t.text}
                  </blockquote>
                  <div className="mt-3 flex gap-0.5 text-amber">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={12} fill="currentColor" strokeWidth={0} />
                    ))}
                  </div>
                </figure>
              ))}
            </div>

            <div className="mt-6 flex justify-center gap-1.5">
              {Array.from({ length: pages }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to testimonial page ${i + 1}`}
                  onClick={() => setPage(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === page ? "w-5 bg-blue" : "w-1.5 bg-white/15"
                  }`}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            aria-label="Next testimonials"
            onClick={() => setPage((p) => (p + 1) % pages)}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-panel text-muted transition-colors hover:text-fg md:inline-flex"
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
    </section>
  );
}
