// Unit conversion for entering a quantity in a different but compatible
// scale than the unit an item is tracked in — e.g. a recipe needs "150 g"
// of an ingredient that Pantrly tracks in kg. Quantities are always stored
// in the item's own tracked unit; this only helps at data-entry time.

type Family = "mass" | "volume";

// Factor to convert 1 of this unit into the family's canonical smallest
// unit (grams for mass, millilitres for volume).
const UNIT_TO_CANONICAL: Record<string, { family: Family; factor: number }> = {
  kg: { family: "mass", factor: 1000 },
  g: { family: "mass", factor: 1 },
  l: { family: "volume", factor: 1000 },
  ml: { family: "volume", factor: 1 },
};

function normalizeUnit(unit: string) {
  return unit.trim().toLowerCase();
}

// Every unit in the same family as `itemUnit`, itemUnit itself first.
// Returns just [itemUnit] if it's not part of a known convertible family
// (e.g. "pcs", "packet") — those have no meaningful alternate scale.
export function getCompatibleUnits(itemUnit: string): string[] {
  const key = normalizeUnit(itemUnit);
  const entry = UNIT_TO_CANONICAL[key];
  if (!entry) return [itemUnit];
  return Object.keys(UNIT_TO_CANONICAL).filter(
    (u) => UNIT_TO_CANONICAL[u].family === entry.family,
  );
}

// Converts a quantity entered in `enteredUnit` into the equivalent
// quantity in `itemUnit`. Falls back to returning the quantity unchanged
// if either unit isn't recognized or they're not in the same family.
export function convertToItemUnit(quantity: number, enteredUnit: string, itemUnit: string): number {
  const entered = UNIT_TO_CANONICAL[normalizeUnit(enteredUnit)];
  const target = UNIT_TO_CANONICAL[normalizeUnit(itemUnit)];
  if (!entered || !target || entered.family !== target.family) return quantity;
  return (quantity * entered.factor) / target.factor;
}
