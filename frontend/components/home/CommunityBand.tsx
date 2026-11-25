import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import { testimonials } from "../../lib/demo";
import { Avatar } from "../ui/Bits";

export default function CommunityBand() {
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

          <Link href="/community" className="btn btn-blue mt-7 !px-5">
            Explore Community <ArrowRight size={15} />
          </Link>
        </div>

        <div className="flex items-center">
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
          </div>
        </div>
      </div>
    </section>
  );
}
