import { normalizeSkill } from "@/lib/resume/skill-utils";

// One posting's list often names the same product twice, with and without its
// maker: "SQS" and "Amazon SQS", "AWS Bedrock" and "Amazon Bedrock". Each
// duplicate is one more skill a student is scored as missing, so within a
// list, names that differ only by a maker's name become one — the one that
// says the maker, being the more specific.

const VENDORS = ["amazon web services", "amazon", "aws", "microsoft", "ms", "google", "apache", "adobe", "autodesk", "atlassian", "oracle", "ibm"];

// What is left after the maker's name that is a field in its own right, not a
// product: "Analytics" on its own is data analysis, not Google Analytics.
const GENERIC = new Set([
  "analytics", "cloud", "cloud platform", "data", "security", "search", "design", "ads", "ai",
  "machine learning", "storage", "database", "databases", "computing", "maps", "platform",
  "services", "suite", "tools", "development", "testing", "networking", "platforms", "products",
  "technologies", "applications", "systems", "solutions", "apis", "infrastructure",
]);

function withoutVendor(key: string): { product: string; hadVendor: boolean } {
  for (const vendor of VENDORS) {
    if (key.startsWith(`${vendor} `)) {
      const product = key.slice(vendor.length + 1).trim();
      if (product.length >= 2 && !GENERIC.has(product)) return { product, hadVendor: true };
    }
  }
  return { product: key, hadVendor: false };
}

export function mergeVendorVariants(skills: string[]): string[] {
  const groups = new Map<string, { index: number; name: string; hadVendor: boolean }>();
  skills.forEach((name, index) => {
    const { product, hadVendor } = withoutVendor(normalizeSkill(name));
    const existing = groups.get(product);
    if (!existing) groups.set(product, { index, name, hadVendor });
    // Keep the place of the first mention, and the name that says the maker.
    else if (hadVendor && !existing.hadVendor) groups.set(product, { index: existing.index, name, hadVendor });
  });
  return [...groups.values()].sort((a, b) => a.index - b.index).map((g) => g.name);
}
