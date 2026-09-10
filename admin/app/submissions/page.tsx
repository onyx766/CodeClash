import { SectionPlaceholder } from "../../components/layout/SectionPlaceholder";
import { IconFile } from "../../components/ui/Icons";

export default function SubmissionsPage() {
  return (
    <SectionPlaceholder
      title="Submissions"
      description="Review submitted solutions and their judged results."
      available="Submissions exist in the database, but this console view has not been built yet."
      icon={<IconFile size={20} />}
    />
  );
}
