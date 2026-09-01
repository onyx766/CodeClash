import Hero from '../components/home/Hero';
import HowItWorks from '../components/home/HowItWorks';
import Features from '../components/home/Features';
import Stats from '../components/home/Stats';
import LeaderboardPreview from '../components/home/LeaderboardPreview';
import FinalCta from '../components/home/FinalCta';

export default function Home() {
  return (
    <div>
      <Hero />
      <main className="section">
        <div className="cc-container">
          <HowItWorks />
        </div>
      </main>
      <section className="section">
        <div className="cc-container">
          <Features />
        </div>
      </section>
      <section className="section">
        <div className="cc-container">
          <Stats />
        </div>
      </section>
      <LeaderboardPreview />
      <FinalCta />
    </div>
  );
}
