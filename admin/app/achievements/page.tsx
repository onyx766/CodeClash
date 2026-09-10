import { SectionPlaceholder } from "../../components/layout/SectionPlaceholder";
import { IconAward } from "../../components/ui/Icons";

export default function AchievementsPage() {
  return (
    <SectionPlaceholder
      title="Achievements"
      description="Badges and milestones players can earn."
      icon={<IconAward size={20} />}
    />
  );
}
