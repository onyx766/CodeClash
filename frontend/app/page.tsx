import Hero from '../components/home/Hero';
import HowItWorks from '../components/home/HowItWorks';
import Features from '../components/home/Features';
import Stats from '../components/home/Stats';
import LeaderboardPreview from '../components/home/LeaderboardPreview';
import CommunitySection from '../components/home/CommunitySection';
import FinalCta from '../components/home/FinalCta';

export default function Home() {
  return (
    <div className="landing-page">
      <Hero />
      <Stats />
      <div className="cc-container">
        <Features />
        <LeaderboardPreview />
        <HowItWorks />
        <CommunitySection />
      </div>
      <FinalCta />
    </div>
  );
}
