import Hero from "../components/home/Hero";
import StatsBar from "../components/home/StatsBar";
import Features from "../components/home/Features";
import LeaderboardPreview from "../components/home/LeaderboardPreview";
import HowItWorksStrip from "../components/home/HowItWorksStrip";
import CommunityBand from "../components/home/CommunityBand";
import FinalCta from "../components/home/FinalCta";

export default function Home() {
  return (
    <>
      <Hero />
      <StatsBar />
      <Features />
      <LeaderboardPreview />
      <HowItWorksStrip />
      <CommunityBand />
      <FinalCta />
    </>
  );
}
