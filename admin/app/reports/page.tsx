import { SectionPlaceholder } from "../../components/layout/SectionPlaceholder";
import { IconReport } from "../../components/ui/Icons";

export default function ReportsPage() {
  return (
    <SectionPlaceholder
      title="Reports"
      description="Player reports and moderation queue."
      icon={<IconReport size={20} />}
    />
  );
}
