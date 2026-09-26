// Best-effort parsing of OCR'd bill text into a prefillable amount + dish
// selection — output is always meant to be reviewed/edited by the user
// before submitting, not trusted as-is.

const NUMBER_REGEX = /\d[\d,]*\.\d{1,2}|\d[\d,]*/g;

function toCents(raw: string): number {
  const n = Number(raw.replace(/,/g, ""));
  return isNaN(n) ? 0 : Math.round(n * 100);
}

function lineCentsCandidates(line: string): number[] {
  return [...line.matchAll(NUMBER_REGEX)].map((m) => toCents(m[0])).filter((c) => c > 0);
}

export function extractAmountCents(text: string): number | null {
  const lines = text.split("\n");

  let bestTier = -1;
  let bestValue: number | null = null;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes("sub total") || lower.includes("subtotal") || lower.includes("sub-total")) {
      continue;
    }

    let tier = -1;
    if (lower.includes("grand total")) tier = 3;
    else if (lower.includes("net total")) tier = 2;
    else if (lower.includes("total")) tier = 1;

    if (tier === -1) continue;

    const candidates = lineCentsCandidates(line);
    if (candidates.length === 0) continue;
    const lineMax = Math.max(...candidates);

    if (tier > bestTier || (tier === bestTier && bestValue !== null && lineMax > bestValue)) {
      bestTier = tier;
      bestValue = lineMax;
    }
  }

  if (bestValue !== null) return bestValue;

  const allNumbers = lineCentsCandidates(text);
  if (allNumbers.length === 0) return null;
  return Math.max(...allNumbers);
}

const VARIANT_SYNONYMS: Record<string, string[]> = {
  veg: ["veg", "vegetable", "veggie"],
  chicken: ["chicken", "chkn", "chk"],
  egg: ["egg", "eggs"],
  prawns: ["prawn", "prawns", "shrimp"],
  fish: ["fish"],
};

interface MenuEntry {
  base: string;
  variantKey: string | null;
  fullName: string;
}

function parseMenuItem(fullName: string): MenuEntry {
  const match = fullName.match(/^(.*)\s\(([^)]+)\)\s*$/);
  if (!match) return { base: fullName.trim(), variantKey: null, fullName };
  return { base: match[1].trim(), variantKey: match[2].trim().toLowerCase(), fullName };
}

function detectVariant(window: string): string | null {
  const isNonVeg = /non[\s-]?veg/.test(window);
  for (const [key, words] of Object.entries(VARIANT_SYNONYMS)) {
    if (key === "veg" && isNonVeg) continue;
    for (const word of words) {
      if (new RegExp(`\\b${word}\\b`).test(window)) return key;
    }
  }
  return null;
}

// Line-item receipts are typically "Name  Rate  Qty  Amt" (3 numbers) or
// "Name  Rate  Amt" (2 numbers, no printed quantity). When exactly 3 numbers
// are present, the middle one is the quantity; otherwise assume 1.
function detectQuantity(line: string): number {
  const numbers = [...line.matchAll(NUMBER_REGEX)].map((m) => m[0]);
  if (numbers.length === 3) {
    const qty = Math.round(Number(numbers[1].replace(/,/g, "")));
    if (Number.isFinite(qty) && qty > 0 && qty < 100) return qty;
  }
  return 1;
}

export interface ScannedItem {
  name: string;
  quantity: number;
}

export function extractMenuItems(text: string, menuItems: string[]): ScannedItem[] {
  const entriesByBase = new Map<string, MenuEntry[]>();
  for (const item of menuItems) {
    const entry = parseMenuItem(item);
    const key = entry.base.toLowerCase();
    if (!entriesByBase.has(key)) entriesByBase.set(key, []);
    entriesByBase.get(key)!.push(entry);
  }

  const bases = [...entriesByBase.keys()].filter((base) => base.length >= 3);
  const results = new Map<string, number>();

  for (const rawLine of text.split("\n")) {
    const lowerLine = rawLine.toLowerCase();
    if (!lowerLine.trim()) continue;

    const found = bases.filter((base) => lowerLine.includes(base));
    if (found.length === 0) continue;

    // Drop matches that are just a substring of a longer match on the same
    // line (e.g. "Fried Rice" inside "Schezwan Fried Rice").
    const kept = found.filter((base) => !found.some((other) => other !== base && other.includes(base)));

    const quantity = detectQuantity(rawLine);

    for (const base of kept) {
      const entries = entriesByBase.get(base)!;

      let fullName: string | undefined;
      if (entries.length === 1) {
        fullName = entries[0].fullName;
      } else {
        const variantKey = detectVariant(lowerLine);
        fullName = variantKey ? entries.find((e) => e.variantKey === variantKey)?.fullName : undefined;
        // Ambiguous (multiple variants, no keyword match) — skip rather than guess wrong.
      }

      if (fullName) {
        results.set(fullName, (results.get(fullName) ?? 0) + quantity);
      }
    }
  }

  return [...results.entries()].map(([name, quantity]) => ({ name, quantity }));
}

export function parseBillText(text: string, menuItems: string[]) {
  return {
    amountCents: extractAmountCents(text),
    items: extractMenuItems(text, menuItems),
  };
}
