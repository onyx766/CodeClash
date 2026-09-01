import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

export default function FinalCta() {
  return (
    <section className="landing-final-cta">
      <div className="cc-container landing-final-grid">
        <div className="landing-final-copy">
          <h2>Your Next Challenge Awaits</h2>
          <p>Join thousands of developers competing in real-time coding battles.</p>
          <div className="landing-final-btns">
            <Link href="/register" className="btn-gradient">
              Start Coding Now
              <ArrowRight size={16} strokeWidth={2.2} />
            </Link>
            <Link href="/register" className="btn-outline">
              Create an Account
            </Link>
          </div>
        </div>
        <div className="landing-final-art">
          <Image
            src="/assets/logo.png"
            alt=""
            width={120}
            height={120}
            className="landing-trophy-img"
            aria-hidden="true"
          />
        </div>
      </div>
    </section>
  );
}
