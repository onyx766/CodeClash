import Hero from '../components/home/Hero';
import HowItWorksStrip from '../components/home/HowItWorksStrip';
import Features from '../components/home/Features';
import StatsBar from '../components/home/StatsBar';
import LeaderboardPreview from '../components/home/LeaderboardPreview';
import CommunityBand from '../components/home/CommunityBand';
import FinalCta from '../components/home/FinalCta';

export default function Home() {
  return (
    <div>
      <Hero />
      <StatsBar />
      <Features />
      <LeaderboardPreview />
      <HowItWorksStrip />
      <CommunityBand />
      <FinalCta />
    </div>
  );
}
