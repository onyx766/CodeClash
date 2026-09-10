import { SectionPlaceholder } from "../../components/layout/SectionPlaceholder";
import { IconRooms } from "../../components/ui/Icons";

export default function RoomsPage() {
  return (
    <SectionPlaceholder
      title="Rooms"
      description="Inspect private rooms and their players."
      available="Rooms exist in the database, but this console view has not been built yet."
      icon={<IconRooms size={20} />}
    />
  );
}
