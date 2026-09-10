import { SectionPlaceholder } from "../../components/layout/SectionPlaceholder";
import { IconSettings } from "../../components/ui/Icons";

export default function SettingsPage() {
  return (
    <SectionPlaceholder
      title="Settings"
      description="Platform configuration."
      icon={<IconSettings size={20} />}
    />
  );
}
