// Different names for the same skill, so that a resume and a posting written
// by different people still line up. Only true equivalents belong here: an
// entry makes the two names interchangeable in both directions, so "Laravel"
// under PHP would let a PHP resume satisfy a Laravel posting. Finding skills in
// text is the model's job (lib/job-skills); this table only reconciles names.
const SYNONYMS: Record<string, string[]> = {
  javascript: ["js", "ecmascript", "es6", "es2015"],
  typescript: ["ts"],
  python: ["python3", "python 3"],
  "c++": ["cpp", "c plus plus"],
  "c#": ["csharp", "c sharp"],
  "objective-c": ["objective c", "objc"],
  react: ["reactjs", "react.js"],
  "react native": ["react-native"],
  "next.js": ["nextjs", "next"],
  "node.js": ["nodejs", "node"],
  "vue.js": ["vuejs", "vue"],
  express: ["expressjs", "express.js"],
  ".net": ["dotnet", "microsoft .net"],
  postgresql: ["postgres", "psql"],
  mongodb: ["mongo"],
  "sql server": ["microsoft sql server", "mssql", "ms sql server"],
  redis: ["redis cache"],
  kubernetes: ["k8s"],
  aws: ["amazon web services"],
  gcp: ["google cloud", "google cloud platform"],
  azure: ["microsoft azure"],
  kafka: ["apache kafka"],
  spark: ["apache spark"],
  airflow: ["apache airflow"],
  "machine learning": ["ml"],
  "deep learning": ["dl"],
  "artificial intelligence": ["ai"],
  "natural language processing": ["nlp"],
  "large language models": ["llm", "llms", "large language model"],
  "computer vision": ["cv"],
  html: ["html5"],
  css: ["css3"],
  sass: ["scss"],
  tailwind: ["tailwindcss", "tailwind css"],
  graphql: ["gql"],
  "rest api": ["rest", "restful", "rest apis", "restful api", "restful apis"],
  sql: ["structured query language"],
  nosql: ["no-sql"],
  "ci/cd": ["cicd", "ci-cd", "ci / cd"],
  golang: ["go", "go lang"],
  "ruby on rails": ["rails", "ror"],
  pytorch: ["torch"],
  "scikit-learn": ["sklearn", "scikit learn"],
  "spring boot": ["springboot"],
  "object-oriented programming": ["oop", "object oriented programming"],
  excel: ["microsoft excel", "ms excel"],
  word: ["microsoft word", "ms word"],
  powerpoint: ["microsoft powerpoint", "ms powerpoint"],
  outlook: ["microsoft outlook", "ms outlook"],
  "microsoft access": ["ms access", "access"],
  "microsoft office": ["ms office", "office 365", "microsoft 365", "m365", "ms office suite", "microsoft office suite"],
  "power bi": ["powerbi", "microsoft power bi"],
  "power automate": ["microsoft power automate"],
  sharepoint: ["microsoft sharepoint", "ms sharepoint"],
  vba: ["excel vba", "microsoft vba", "visual basic for applications"],
  solidworks: ["solid works"],
  autocad: ["auto cad", "autodesk autocad"],
  revit: ["autodesk revit"],
  labview: ["lab view"],
  "gd&t": ["geometric dimensioning and tolerancing", "gdt"],
  "plc programming": ["plc", "plcs"],
  "finite element analysis": ["fea"],
  "computer-aided design": ["cad"],
  "pl/sql": ["plsql"],
  "tcp/ip": ["tcp ip"],
  "a/b testing": ["ab testing", "a/b tests"],
  "ui/ux": ["ux/ui", "ui ux", "ux ui"],
  jira: ["atlassian jira"],
  confluence: ["atlassian confluence"],
  photoshop: ["adobe photoshop"],
  illustrator: ["adobe illustrator"],
};

const normalMap = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(SYNONYMS)) {
  normalMap.set(canonical.toLowerCase(), canonical.toLowerCase());
  for (const alias of aliases) {
    normalMap.set(alias.toLowerCase(), canonical.toLowerCase());
  }
}

// Names whose trailing number is a version. Dropping the number anywhere else
// would be wrong: "Dynamics 365" is not the Dynamics course on a resume.
const VERSIONED = new Set([
  ...normalMap.keys(),
  "java", "php", "perl", "angular", "android", "ios", "windows", "macos",
  "ubuntu", "bootstrap", "django", "unity", "unreal engine", "matlab",
]);

export function normalizeSkill(raw: string): string {
  const lower = raw.toLowerCase().replace(/\s+/g, " ").trim();
  const known = normalMap.get(lower);
  if (known) return known;

  const unversioned = lower.replace(/\s+v?\d+(?:\.\d+)*(?:\.x)?\+?$/, "");
  if (unversioned !== lower && VERSIONED.has(unversioned)) {
    return normalMap.get(unversioned) ?? unversioned;
  }
  return lower;
}

export interface SkillOverlapResult {
  overlap: number;
  matched: string[];
  missing: string[];
}

// What is left of "Web Services" or "Data Pipelines" once the generic ending
// goes is too broad to stand for the skill: kept, "Web Services" would match
// "Web Development" on a resume because both came down to "web".
const TOO_BROAD_TO_STAND_ALONE = new Set([
  "web", "data", "mobile", "software", "financial", "information", "operating",
  "control", "distributed", "cloud", "network", "game", "business", "management",
  "testing", "database", "security", "quality", "manufacturing", "power",
  "computer", "digital", "enterprise", "backend", "back-end", "frontend",
  "front-end", "full stack", "full-stack", "api", "design", "embedded",
]);

export function expandSkill(skill: string): string[] {
  const results: string[] = [skill];

  // A name that is itself a skill is not a list: CI/CD, PL/SQL, A/B testing.
  if (normalMap.has(normalizeSkill(skill))) return results;

  if (skill.includes("/")) {
    results.push(...skill.split("/").map((s) => s.trim()).filter(Boolean));
  }
  if (skill.includes(" & ")) {
    results.push(...skill.split(" & ").map((s) => s.trim()).filter(Boolean));
  }

  const stripped = skill
    .replace(/\s+(pipelines?|development|programming|frameworks?|languages?|tools?|experience|skills?|knowledge|applications?|services?|systems?)\s*$/i, "")
    .trim();
  if (
    stripped &&
    stripped.toLowerCase() !== skill.toLowerCase() &&
    !TOO_BROAD_TO_STAND_ALONE.has(stripped.toLowerCase())
  ) {
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
