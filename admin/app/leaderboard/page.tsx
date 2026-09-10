import { SectionPlaceholder } from "../../components/layout/SectionPlaceholder";
import { IconAnalytics } from "../../components/ui/Icons";

export default function LeaderboardPage() {
  return (
    <SectionPlaceholder
      title="Leaderboard"
      description="Ratings and rankings across the platform."
      available="Ratings exist on user accounts and are shown in the Users table; a dedicated leaderboard view has not been built yet."
      icon={<IconAnalytics size={20} />}
    />
  );
}
