const SYNONYMS: Record<string, string[]> = {
  javascript: ["js", "ecmascript", "es6", "es2015"],
  typescript: ["typescript"],
  python: ["python3"],
  "c++": ["cpp", "c plus plus"],
  "c#": ["csharp", "c sharp"],
  react: ["reactjs", "react.js"],
  "react native": ["react native"],
  "next.js": ["nextjs", "next"],
  "node.js": ["nodejs", "node"],
  "vue.js": ["vuejs", "vue"],
  angular: ["angularjs"],
  express: ["expressjs", "express.js"],
  postgresql: ["postgres", "psql"],
  mongodb: ["mongo"],
  mysql: ["mariadb"],
  redis: ["redis cache"],
  docker: ["containerization", "containers"],
  kubernetes: ["k8s"],
  aws: ["amazon web services"],
  gcp: ["google cloud", "google cloud platform"],
  azure: ["microsoft azure"],
  git: ["github", "gitlab", "version control"],
  linux: ["unix", "ubuntu", "debian", "centos"],
  "machine learning": ["ml"],
  "deep learning": ["dl"],
  "artificial intelligence": ["ai"],
  "natural language processing": ["nlp"],
  "computer vision": ["computer vision"],
  html: ["html5"],
  css: ["css3", "stylesheet"],
  sass: ["scss"],
  tailwind: ["tailwindcss", "tailwind css"],
  graphql: ["gql"],
  "rest api": ["restful", "rest apis", "restful api"],
  sql: ["structured query language"],
  nosql: ["no-sql"],
  agile: ["scrum", "kanban"],
  "ci/cd": ["cicd", "continuous integration", "continuous deployment", "continuous delivery"],
  terraform: ["infrastructure as code"],
  figma: ["ui design"],
  java: ["jdk", "jvm"],
  kotlin: ["kotlin"],
  swift: ["swiftui"],
  rust: ["rustlang"],
  golang: ["go", "go lang"],
  ruby: ["ruby on rails", "rails"],
  php: ["laravel", "symfony"],
  pandas: ["pandas"],
  numpy: ["numpy"],
  pytorch: ["torch"],
  tensorflow: ["tensorflow"],
  flutter: ["dart"],
  spring: ["spring boot", "springboot"],
  convex: ["convex"],
  supabase: ["supabase"],
  firebase: ["firebase"],
  shadcn: ["shadcn"],
  posthog: ["posthog"],
};

const normalMap = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(SYNONYMS)) {
  normalMap.set(canonical.toLowerCase(), canonical.toLowerCase());
  for (const alias of aliases) {
    normalMap.set(alias.toLowerCase(), canonical.toLowerCase());
  }
}

export function normalizeSkill(raw: string): string {
  const lower = raw.toLowerCase().trim();
  return normalMap.get(lower) ?? lower;
}

const EXTRACT_SKIP = new Set(["go"]);

const SKILL_PATTERN = new RegExp(
  [...normalMap.keys()]
    .filter((s) => !EXTRACT_SKIP.has(s))
    .sort((a, b) => b.length - a.length)
    .map((s) => {
      const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return `(?<![a-zA-Z])${escaped}(?![a-zA-Z])`;
    })
    .join("|"),
  "gi"
);

export function extractSkillsFromText(text: string): string[] {
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  SKILL_PATTERN.lastIndex = 0;
  while ((match = SKILL_PATTERN.exec(text)) !== null) {
    found.add(normalizeSkill(match[0]));
  }
  return [...found];
}

export interface SkillOverlapResult {
  overlap: number;
  matched: string[];
  missing: string[];
}

export function expandSkill(skill: string): string[] {
  const results: string[] = [skill];

  if (skill.includes("/")) {
    results.push(...skill.split("/").map((s) => s.trim()).filter(Boolean));
  }
  if (skill.includes(" & ")) {
    results.push(...skill.split(" & ").map((s) => s.trim()).filter(Boolean));
  }

  const stripped = skill
    .replace(/\s+(pipelines?|development|programming|frameworks?|languages?|tools?|experience|skills?|knowledge|applications?|services?|systems?)\s*$/i, "")
    .trim();
  if (stripped && stripped.toLowerCase() !== skill.toLowerCase()) {
    results.push(stripped);
  }

  return results;
}

export function computeSkillOverlap(
  resumeSkills: { name: string; proficiency: string }[],
  jobSkills: string[]
): SkillOverlapResult {
  if (jobSkills.length === 0) return { overlap: 1, matched: [], missing: [] };

  const resumeMap = new Map<string, number>();
  for (const s of resumeSkills) {
    for (const expanded of expandSkill(s.name)) {
      const weight = s.proficiency === "advanced" ? 1.5 : s.proficiency === "intermediate" ? 1.0 : 0.5;
      const key = normalizeSkill(expanded);
      resumeMap.set(key, Math.max(resumeMap.get(key) ?? 0, weight));
    }
  }

  let matchedScore = 0;
  const matched: string[] = [];
  const missing: string[] = [];

  for (const js of jobSkills) {
    const expanded = expandSkill(js);
    let found = false;

    for (const part of expanded) {
      const key = normalizeSkill(part);
      const weight = resumeMap.get(key);
      if (weight != null) {
        matchedScore += Math.min(weight, 1);
        matched.push(js);
        found = true;
        break;
      }
    }

    if (!found) {
      missing.push(js);
    }
  }

  return {
    overlap: Math.min(1, matchedScore / jobSkills.length),
    matched,
    missing,
  };
}
