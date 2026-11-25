import { SectionPlaceholder } from "../../components/layout/SectionPlaceholder";
import { IconMatches } from "../../components/ui/Icons";

export default function MatchesPage() {
  return (
    <SectionPlaceholder
      title="Matches"
      description="Monitor live matches, player activity, and results."
      available="Matches, their challenges and each player's progress are recorded, but this console view has not been built yet."
      icon={<IconMatches size={20} />}
    />
  );
}
