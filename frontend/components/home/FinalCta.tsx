import Image from "next/image";
import Link from "next/link";

export default function FinalCta() {
  return (
    <section className="cc-container py-10">
      <div className="relative overflow-hidden rounded-2xl border border-violet/25 bg-gradient-to-r from-[#141a3d] via-[#181e46] to-[#221a4d] px-6 py-10 lg:px-12">
        <div className="pointer-events-none absolute -right-10 -top-16 h-72 w-72 rounded-full bg-violet/25 blur-[110px]" />

        <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-400">
              Ready to Code?
            </p>
            <h2 className="mt-3 text-[clamp(1.65rem,3.6vw,2.4rem)] font-extrabold tracking-[-0.025em]">
              Your Next Challenge <span className="text-grad-bp">Awaits</span>
            </h2>
            <p className="mt-3 max-w-lg text-[13.5px] leading-relaxed text-muted">
              Create a free account and start your coding journey today. Compete, learn, and become
              the CodeClash champion!
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/lobby" className="btn btn-blue !px-6 !py-3.5">
                Start Coding Now
              </Link>
              <Link href="/register" className="btn btn-ghost !px-6 !py-3.5">
                Create an Account
              </Link>
            </div>
          </div>

          <div className="justify-self-center lg:justify-self-end">
            <Image
              src="/img/trophy-purple.png"
              alt=""
              width={520}
              height={520}
              className="float-slow h-[200px] w-auto lg:h-[230px]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
