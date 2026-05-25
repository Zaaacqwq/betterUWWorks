interface ParsedPay {
  hourlyMin: number | null;
  hourlyMax: number | null;
}

const USD_TO_CAD = 1.38;

const US_LOCATION_KEYWORDS = [
  "san ", "new york", "california", "seattle", "austin", "chicago",
  "boston", "los angeles", "houston", "dallas", "denver", "atlanta",
  "portland", "phoenix", "philadelphia", "pittsburgh", "detroit",
  "minneapolis", "charlotte", "nashville", "raleigh", "tampa",
  "miami", "orlando", "salt lake", "washington", "virginia",
  "maryland", "new jersey", "connecticut", "massachusetts",
  "illinois", "texas", "florida", "georgia", "colorado",
  "ohio", "michigan", "indiana", "arizona", "nevada",
  "north carolina", "south carolina", "tennessee", "pennsylvania",
  "united states", "usa", " us", ", us",
];

export function parseCompensation(raw: string | null, location?: string | null): ParsedPay {
  if (!raw) return { hourlyMin: null, hourlyMax: null };

  const text = raw.replace(/,/g, "").toLowerCase();

  const isCAD = /cad/i.test(raw);
  const isUSD = !isCAD && isLikelyUSD(raw, location);
  const multiplier = isUSD ? USD_TO_CAD : 1;

  const hourlyPatterns = [
    /\$\s*([\d.]+)\s*(?:to|-)\s*\$?\s*([\d.]+)\s*(?:per hour|\/\s*h|hourly|\/ hour)/i,
    /\$\s*([\d.]+)\s*(?:to|-)\s*\$?\s*([\d.]+)\s*(?:per hour|hourly|\/ hour)/i,
    /(?:range|salary|pay|compensation|wage)[^$]*\$\s*([\d.]+)\s*(?:to|-)\s*\$?\s*([\d.]+)/i,
    /\$\s*([\d.]+)\s*(?:per hour|\/\s*h(?:our)?|hourly)/i,
    /(?:hourly\s*(?:wage|rate|pay))[^$]*\$\s*([\d.]+)/i,
    /([\d.]+)\s*\$\s*\/?\s*hour/i,
  ];

  for (const pat of hourlyPatterns) {
    const m = text.match(pat);
    if (m) {
      const a = parseFloat(m[1]);
      const b = m[2] ? parseFloat(m[2]) : null;
      if (a > 0 && a < 200) {
        return {
          hourlyMin: round2(a * multiplier),
          hourlyMax: round2((b && b > 0 && b < 200 ? b : a) * multiplier),
        };
      }
    }
  }

  const weeklyMatch = text.match(/\$\s*([\d.]+)\s*(?:per week|\/\s*week)/i);
  if (weeklyMatch) {
    const weekly = parseFloat(weeklyMatch[1]);
    if (weekly > 100 && weekly < 10000) {
      const hourly = (weekly / 40) * multiplier;
      return { hourlyMin: round2(hourly), hourlyMax: round2(hourly) };
    }
  }

  const monthlyMatch = text.match(/(?:CAD|cad|\$)\s*([\d.]+)\s*(?:to|-)\s*(?:CAD|cad|\$)?\s*([\d.]+)\s*(?:\/\s*month|per month|monthly)/i)
    || text.match(/(?:CAD|cad|\$)\s*([\d.]+)\s*\/?\s*month/i);
  if (monthlyMatch) {
    const a = parseFloat(monthlyMatch[1]);
    const b = monthlyMatch[2] ? parseFloat(monthlyMatch[2]) : null;
    if (a > 500 && a < 50000) {
      const hMin = (a / 173) * multiplier;
      const hMax = (b && b > 500 ? b / 173 : a / 173) * multiplier;
      return { hourlyMin: round2(hMin), hourlyMax: round2(hMax) };
    }
  }

  const yearlyPatterns = [
    /\$\s*([\d.]+)\s*(?:to|-)\s*\$?\s*([\d.]+)\s*(?:CAD\s*)?(?:per year|\/\s*y|annually|per annum)/i,
    /(?:salary range|hiring range|range)[^$]*\$\s*([\d.]+)\s*(?:to|-)\s*\$?\s*([\d.]+)/i,
    /(?:CAD|cad)\s*\$?\s*([\d.]+)\s*(?:to|-)\s*(?:CAD|cad)?\s*\$?\s*([\d.]+)\s*(?:per year|\/\s*y)/i,
    /(?:target min)[^$]*\$?\s*([\d.]+)[\s\S]*?(?:target max)[^$]*\$?\s*([\d.]+)/i,
  ];

  for (const pat of yearlyPatterns) {
    const m = text.match(pat);
    if (m) {
      const a = parseFloat(m[1]);
      const b = m[2] ? parseFloat(m[2]) : null;
      if (a > 15000 && a < 500000) {
        const hMin = (a / 2080) * multiplier;
        const hMax = (b && b > 15000 ? b / 2080 : a / 2080) * multiplier;
        return { hourlyMin: round2(hMin), hourlyMax: round2(hMax) };
      }
    }
  }

  return { hourlyMin: null, hourlyMax: null };
}

function isLikelyUSD(raw: string, location?: string | null): boolean {
  if (/\busd\b/i.test(raw) || /\bus\s*dollar/i.test(raw)) return true;
  if (!location) return false;
  const loc = location.toLowerCase();
  return US_LOCATION_KEYWORDS.some((kw) => loc.includes(kw));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
