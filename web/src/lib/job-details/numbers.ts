// Every figure a posting writes, as plain numbers, in each way it could be
// meant: "$3,500.00" is 3500, "$7.5k" is 7.5 and 7500, and in "$12-16K" the K
// belongs to both ends, so 12000 is there too.

// Thousands are grouped with commas only: a space would read the table row
// "1 3500.00" as 1350.
const NUMBER = /(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?\s*([kK]\b)?/g;
const SHARED_K = /(\d+(?:\.\d+)?)\s*(?:-|–|—|~|to)\s*\$?\s*(\d+(?:\.\d+)?)\s*[kK]\b/g;

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function toNumber(whole: string, fraction: string | undefined): number {
  return parseFloat(`${whole.replace(/,/g, "")}${fraction ? `.${fraction}` : ""}`);
}

export function numbersIn(text: string): Set<number> {
  const found = new Set<number>();
  for (const m of text.matchAll(NUMBER)) {
    const value = toNumber(m[1], m[2]);
    if (Number.isNaN(value)) continue;
    found.add(round(value));
    if (m[3]) found.add(round(value * 1000));
  }
  for (const m of text.matchAll(SHARED_K)) {
    found.add(round(parseFloat(m[1]) * 1000));
  }
  return found;
}

export function containsNumber(found: Set<number>, value: number): boolean {
  const target = round(value);
  for (const n of found) if (Math.abs(n - target) < 0.005) return true;
  return false;
}
