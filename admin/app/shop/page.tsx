import { SectionPlaceholder } from "../../components/layout/SectionPlaceholder";
import { IconShop } from "../../components/ui/Icons";

export default function ShopPage() {
  return (
    <SectionPlaceholder
      title="Shop"
      description="Coins, items, and purchases."
      icon={<IconShop size={20} />}
    />
  );
}
