import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function CommunityBand() {
  return (
    <section className="cc-container py-8">
      <div className="card flex flex-col gap-6 overflow-hidden bg-gradient-to-br from-[#0d1730] to-[#0b1020] p-6 sm:flex-row sm:items-center sm:justify-between lg:p-9">
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
        </div>

        <Link href="/community" className="btn btn-blue shrink-0 !px-5">
          Explore Community <ArrowRight size={15} />
        </Link>
      </div>
    </section>
  );
}
