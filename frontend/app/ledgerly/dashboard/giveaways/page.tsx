import { getMenuPrices } from "@/lib/ledgerly/menu-prices";
import { GiveawaysClient } from "@/components/ledgerly/giveaways-client";

// Server component so menu.yaml can be read at build time — complimentary
// dishes are valued at their menu price. Same access as the rest of
// Ledgerly's data entry (owner + accounting): it only reads sales.
export default function GiveawaysPage() {
  return <GiveawaysClient prices={getMenuPrices()} />;
}
