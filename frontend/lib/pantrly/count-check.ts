// Sanity check for a stock count before it's saved. Staff often weigh
// produce in grams (or measure in ml) and type that number into an item
// tracked in kg/litre — a 500 g ginger count saved as 500 kg makes current
// stock and low-stock alerts meaningless. A count 20x off the item's usual
// scale is almost certainly a unit slip (grams vs kg is 1000x), while
// normal day-to-day swings stay well inside that band.

const RATIO = 20;

export type CountWarning = {
  // How many times the usual amount the entered count is (e.g. 1000, 0.001).
  ratio: number;
  // The usual amount for this item, in its own unit.
  typical: number;
  // A converted value to offer instead (e.g. 0.5 for "500" on a kg item),
  // or null if no unit conversion explains the gap.
  suggestion: number | null;
};

function unitKind(unit: string): "kg" | "litre" | "g" | "ml" | "other" {
  const u = unit.trim().toLowerCase();
  if (u === "kg") return "kg";
  if (u === "litre" || u === "liter" || u === "l") return "litre";
  if (u === "g" || u === "gm") return "g";
  if (u === "ml") return "ml";
  return "other";
}

/**
 * Median of the positive values — the item's usual scale, from its recent
 * counts, recent delivery quantities and par level. Null if there's nothing
 * to compare against yet (a brand-new item), in which case no warning.
 */
export function typicalAmount(
  values: (number | null | undefined)[],
): number | null {
  const v = values
    .filter((x): x is number => x != null && x > 0)
    .sort((a, b) => a - b);
  if (v.length === 0) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function checkCount(
  qty: number,
  typical: number | null,
  unit: string,
): CountWarning | null {
  if (typical == null || !(qty > 0)) return null;
  const ratio = qty / typical;
  if (ratio < RATIO && ratio > 1 / RATIO) return null;

  const kind = unitKind(unit);
  let suggestion: number | null = null;
  // Entered in grams/ml on a kg/litre item: offer qty ÷ 1000.
  if (ratio >= RATIO && (kind === "kg" || kind === "litre"))
    suggestion = qty / 1000;
  // Entered in kg/litre on a gram/ml item: offer qty × 1000.
  if (ratio <= 1 / RATIO && (kind === "g" || kind === "ml"))
    suggestion = qty * 1000;
  // Only offer the conversion if it actually lands near the usual scale.
  if (suggestion != null) {
    const r = suggestion / typical;
    if (r >= RATIO || r <= 1 / RATIO) suggestion = null;
  }
  // A very low count is normal (stock running out), so on the low side only
  // warn when a unit mix-up explains it; a very high count always warns.
  if (ratio <= 1 / RATIO && suggestion == null) return null;
  return {
    ratio,
    typical,
    suggestion: suggestion == null ? null : +suggestion.toFixed(3),
  };
}
