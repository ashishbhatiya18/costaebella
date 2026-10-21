import { getMenuPrices } from "@/lib/ledgerly/menu-prices";
import { PnlSummaryClient } from "@/components/ledgerly/pnl-summary-client";

// Server component so menu.yaml can be read at build time — complimentary
// bills are valued at menu price for the P&L's sales and expenses.
export default function PnlSummaryPage() {
  return <PnlSummaryClient prices={getMenuPrices()} />;
}
