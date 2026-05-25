export const JOB_SUMMARY_SYSTEM = `You are a concise career advisor helping University of Waterloo co-op students quickly understand job postings. Respond in the same language as the job posting (English or French).`;

export function jobSummaryPrompt(job: {
  title: string;
  organization: string;
  jobSummary: string | null;
  jobResponsibilities: string | null;
  requiredSkills: string | null;
  specialRequirements: string | null;
  compensation: string | null;
  level: string | null;
  location: string | null;
}): string {
  const sections = [
    `Title: ${job.title}`,
    `Company: ${job.organization}`,
    job.level && `Level: ${job.level}`,
    job.location && `Location: ${job.location}`,
    job.jobSummary && `Job Summary:\n${job.jobSummary}`,
    job.jobResponsibilities && `Responsibilities:\n${job.jobResponsibilities}`,
    job.requiredSkills && `Required Skills:\n${job.requiredSkills}`,
    job.specialRequirements && `Special Requirements:\n${job.specialRequirements}`,
    job.compensation && `Compensation:\n${job.compensation}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return `Summarize this co-op job posting. Output format:

**TLDR**: 1-2 sentences describing what you'd actually be doing day-to-day.

**Key Skills**: comma-separated list of the most important skills/technologies (max 8).

**Good Fit If You**: 2-3 bullet points describing what kind of student would thrive here.

**Watch Out**: 1-2 bullet points about things to be aware of (demanding requirements, niche skills, relocation, etc). If nothing notable, omit this section.

Be direct and practical. No fluff. Students are scanning dozens of postings — help them decide in 10 seconds.

---

${sections}`;
}

export const RESUME_EXTRACT_SYSTEM = `You are a resume parser for University of Waterloo co-op students. Extract structured data from resumes with evidence-based capability analysis. Output ONLY valid JSON, no markdown fences, no explanation.`;

export function resumeExtractPrompt(resumeText: string): string {
  return `Parse this resume and extract structured data with evidence-based capabilities. You MUST extract EVERY skill, technology, tool, and language mentioned anywhere in the resume.

Output a single JSON object with this schema:

{
  "capabilities": [
    {
      "name": "React",
      "category": "framework",
      "evidence_source": "Experience: Frontend Developer @ Shopify",
      "evidence_type": "work_used",
      "confidence": 1.0,
      "reasoning": "Used React to build merchant dashboard"
    },
    {
      "name": "Pandas",
      "category": "framework",
      "evidence_source": "Inferred from Python data analysis work",
      "evidence_type": "inferred",
      "confidence": 0.6,
      "reasoning": "Python data analysis strongly implies pandas usage"
    }
  ],
  "education": [{"institution": "University of Waterloo", "program": "Computer Science", "degree": "Bachelor's", "yearLevel": 3}],
  "experience": [{"title": "Software Developer", "company": "Acme", "duration": "4 months", "skills": ["Python", "React"], "type": "coop"}],
  "coopTermCount": 2,
  "programs": ["Computer Science"],
  "preferredLocations": [],
  "preferredArrangement": null,
  "preferredDuration": null,
  "summary": "3rd year CS student with 2 co-op terms, strong in Python and web dev"
}

CRITICAL capability rules:
- You MUST extract EVERY SINGLE skill/technology/tool/language from ALL sections. Do NOT skip any.
- Split compound entries into separate capabilities: "C/C++" → two entries: "C" and "C++"
- Split grouped lists: "HTML, CSS" → two entries: "HTML" and "CSS"
- Include niche/hardware skills: Verilog, VHDL, FPGA, embedded, etc.
- Include tools: VS Code, IntelliJ, PyCharm, Xcode, Jira, SVN, etc.
- Include scripting: Bash, shell scripting, etc.

Confidence rules (IMPORTANT):
- Any skill EXPLICITLY MENTIONED on the resume gets confidence: 1.0 — regardless of which section it's in
- Only skills NOT mentioned by name but INFERRED from context get lower confidence:
  - "inferred": strongly implied (e.g. "Built React app" → JavaScript). confidence: 0.5-0.7
  - "weak_inferred": loosely implied (e.g. "Python data analysis" → pandas). confidence: 0.2-0.4

Evidence type rules:
- "work_used": Mentioned in a work/co-op experience bullet. confidence: 1.0
- "project_used": Mentioned in a project description. confidence: 1.0
- "explicit": Listed in Skills section. confidence: 1.0
- "inferred": NOT mentioned by name, but strongly implied by context. confidence: 0.5-0.7
- "weak_inferred": NOT mentioned by name, loosely adjacent. confidence: 0.2-0.4
- DEDUPLICATION: If a skill appears in multiple sections, produce ONE entry with the STRONGEST evidence_type (work_used > project_used > explicit)
- "evidence_source": brief label (e.g. "Experience: SWE @ Google", "Project: Blog Platform", "Skills section")
- "category": programming_language, framework, tool, database, cloud, domain, other
- Normalize names (e.g. "JS" → "JavaScript", "ML" → "Machine Learning")
- Do NOT include soft skills or natural languages (communication, teamwork, English, Mandarin)

Other field rules:
- "type" must be one of: coop, internship, fulltime, project, other
- "coopTermCount": count co-op/internship experiences
- "preferredLocations", "preferredArrangement", "preferredDuration": extract if mentioned, otherwise empty/null
- "summary": one sentence overview of the candidate

Resume:
${resumeText}`;
}

export const JOB_SKILLS_SYSTEM = `You are a technical recruiter parsing job postings. Extract skills and technologies. Output ONLY a valid JSON array of strings, nothing else.`;

export function jobSkillsPrompt(job: {
  title: string;
  requiredSkills: string | null;
  jobSummary: string | null;
  jobResponsibilities: string | null;
  extraText: string;
}): string {
  const sections = [
    `Title: ${job.title}`,
    job.requiredSkills && `Required Skills:\n${job.requiredSkills}`,
    job.jobSummary && `Job Summary:\n${job.jobSummary}`,
    job.jobResponsibilities && `Responsibilities:\n${job.jobResponsibilities}`,
    job.extraText && `Additional Details:\n${job.extraText}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return `Extract all technical skills, tools, frameworks, and technologies from this job posting.

Rules:
- Include programming languages, frameworks, libraries, tools, databases, cloud services, methodologies
- Use standard/full names (e.g., "JavaScript" not "JS", "Kubernetes" not "k8s", "React Native" not "RN")
- Include both explicitly stated AND clearly implied technologies
- Do NOT include soft skills (communication, teamwork, leadership, etc.)
- Do NOT include generic terms (e.g., "full stack", "software engineering", "mobile development")
- Maximum 15 skills, ordered by importance
- Return ONLY a JSON array like: ["React", "TypeScript", "PostgreSQL"]

---

${sections}`;
}

export const MATCH_ANALYSIS_SYSTEM = `You are a career advisor analyzing job fit for University of Waterloo co-op students. Be specific and actionable.`;

export function matchAnalysisPrompt(
  profile: { skills: { name: string; proficiency: string }[]; education: { program: string; degree: string }[]; experience: { title: string; company: string; type: string }[]; coopTermCount: number; summary: string },
  job: { title: string; organization: string; requiredSkills: string | null; jobSummary: string | null; jobResponsibilities: string | null; level: string | null; location: string | null }
): string {
  return `Analyze how well this candidate matches this job. Output format:

**Score**: X/100

**Strengths**:
- (2-3 specific strengths based on skill/experience overlap)

**Gaps**:
- (1-2 specific gaps or missing qualifications)

**Tips**:
- (1-2 actionable suggestions for the application)

Be concise and specific. Reference actual skills and requirements.

---

CANDIDATE:
${JSON.stringify(profile, null, 2)}

JOB:
Title: ${job.title}
Company: ${job.organization}
Level: ${job.level ?? "Not specified"}
Location: ${job.location ?? "Not specified"}
${job.requiredSkills ? `Required Skills: ${job.requiredSkills}` : ""}
${job.jobSummary ? `Summary: ${job.jobSummary}` : ""}
${job.jobResponsibilities ? `Responsibilities: ${job.jobResponsibilities}` : ""}`;
}
