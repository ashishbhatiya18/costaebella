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

export function extractMenuItems(text: string, menuItems: string[]): string[] {
  const lowerText = text.toLowerCase();

  const entriesByBase = new Map<string, MenuEntry[]>();
  for (const item of menuItems) {
    const entry = parseMenuItem(item);
    const key = entry.base.toLowerCase();
    if (!entriesByBase.has(key)) entriesByBase.set(key, []);
    entriesByBase.get(key)!.push(entry);
  }

  const bases = [...entriesByBase.keys()].filter((base) => base.length >= 3);

  // Find bases actually present in the text, keeping the match position.
  const found: { base: string; index: number }[] = [];
  for (const base of bases) {
    const index = lowerText.indexOf(base);
    if (index !== -1) found.push({ base, index });
  }

  // Drop matches that are just a substring of a longer match (e.g. "Fried
  // Rice" matching inside "Schezwan Fried Rice") so we don't double-count.
  const longerBases = found.map((f) => f.base).sort((a, b) => b.length - a.length);
  const kept = found.filter(
    (f) => !longerBases.some((other) => other !== f.base && other.includes(f.base)),
  );

  const matched: string[] = [];
  for (const { base, index } of kept) {
    const entries = entriesByBase.get(base)!;

    if (entries.length === 1) {
      matched.push(entries[0].fullName);
      continue;
    }

    const windowStart = Math.max(0, index - 15);
    const windowEnd = Math.min(lowerText.length, index + base.length + 15);
    const window = lowerText.slice(windowStart, windowEnd);
    const variantKey = detectVariant(window);

    const entry = variantKey ? entries.find((e) => e.variantKey === variantKey) : undefined;
    if (entry) matched.push(entry.fullName);
    // Ambiguous (multiple variants, no keyword match) — skip rather than guess wrong.
  }

  return matched;
}

export function parseBillText(text: string, menuItems: string[]) {
  return {
    amountCents: extractAmountCents(text),
    itemNames: extractMenuItems(text, menuItems),
  };
}
