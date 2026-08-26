"use client";
import Link from "next/link";

export default function Hero(){
  return (
    <section className="hero hero-shapes">
      <div className="cc-container hero-inner">
        <div className="hero-tag">REAL-TIME JAVASCRIPT BATTLES</div>
        <h1 className="hero-title-primary">Real-Time JavaScript Battles</h1>
        <h2 className="hero-title-secondary">Compete, Solve &amp; Climb the Rankings</h2>
        <p className="hero-desc">CodeClash brings developers together in timed JavaScript challenges where speed, correctness, and problem-solving decide the winner.</p>
        <div className="hero-cta">
          <Link href="/lobby" className="btn-primary">Start Competing</Link>
        </div>
        <div className="hero-trust" aria-hidden>
          <div>LIVE 1v1</div>
          <div>TIMED ROUNDS</div>
          <div>HIDDEN TESTS</div>
          <div>RANKED MATCHES</div>
          <div>JAVASCRIPT</div>
        </div>
      </div>
    </section>
  );
}
