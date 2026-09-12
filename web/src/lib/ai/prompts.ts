export const JOB_GLANCE_SYSTEM = `You tell co-op students, in plain words, what a job is actually about. You only restate what the posting says. Output ONLY valid JSON, nothing else.`;

// The one thing about a posting only a model can give: what the work is, in a
// sentence. Skills, pay and requirements are shown from their own checked
// readings, so this leaves them out. Checked in lib/job-summary/verify.ts.
export function jobGlancePrompt(postingText: string): string {
  return `In ONE or TWO short sentences (at most 35 words), say what the student would actually do day to day in this job, and on what — the product, team or field. Start with a verb ("Build…", "Prepare…", "Test…"); don't open with "The student" or "You". Plain words: no hype, no "join our exciting team". Leave out pay, requirements, skills lists, location and how to apply; those are shown separately. Write in the posting's own language (English or French).

Then copy, character for character, the one to three sentences of the posting your summary is based on. Any number in your summary must appear in one of those sentences — include the sentence it comes from, or leave the number out.

Return ONLY this JSON: {"summary": "...", "basis": ["exact sentence from the posting", ...]}

---

${postingText}`;
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

export const JOB_SKILLS_SYSTEM = `You list the skills a co-op job posting names, for matching postings against student resumes. You never guess: every skill you return is one the posting names, and you quote where. Output ONLY a valid JSON array, nothing else.`;

// Each skill comes back with the posting's own words for it, and those words
// are checked against the posting before anything is stored (see
// lib/job-skills/verify.ts). The prompt asks for no inference at all because
// the check would throw an inferred skill away anyway.
export function jobSkillsPrompt(postingText: string): string {
  return `List EVERY skill this job posting names. Read every section to the end — skills are often in the summary, the responsibilities and the "assets" or "nice to have" lines, not just the required skills. There is no maximum.

A skill is anything the student would need to know, learn or use to do this job, in any field:
- programming languages, frameworks, libraries, databases, cloud services, developer tools
- software and platforms of any kind: e.g. Excel, Power BI, SAP, Salesforce, AutoCAD, SolidWorks, MATLAB, Figma, Jira
- engineering and science knowledge and techniques: e.g. heat transfer, thermodynamics, fluid mechanics, injection molding, GD&T, statistical process control, design of experiments, root cause analysis, P&IDs, PLC programming, PCB design, FPGA, PCR
- business, finance and other professional knowledge and methods: e.g. financial modelling, accounting, GAAP, SOX, auditing, project management, Agile, Six Sigma, user research
- both required skills and ones listed as an asset or as something the student will learn

What does not count:
- soft skills and personal traits (communication, teamwork, leadership, problem solving, attention to detail)
- natural languages (English, French)
- degrees, programs, year of study, licences, clearances
- vague words that are not a particular skill (computer skills, technical skills, programming, coding, software, technology, data)
- names that only describe the company, its products, its customers or its culture ("meet the team on Google Meet"), not something the student would do the work with

Never infer. Only list what the posting names:
- "web development" does NOT mean HTML, CSS or JavaScript
- "Microsoft Office" does NOT mean Excel or Word unless they are named
- "Python" does NOT mean Django or pandas

For each skill give:
- "skill": its usual standard name, e.g. "JavaScript" for "JS", "Kubernetes" for "k8s", "PostgreSQL" for "Postgres", "Excel" for "MS Excel". No version numbers, no parentheses. Keep English names for English skills even in a French posting.
- "mention": the exact words in the posting that name it, copied character for character in the posting's own spelling and case. Just the name, not the sentence around it.

If one phrase names several skills, give one entry each: "C/C++" → {"skill":"C","mention":"C"} and {"skill":"C++","mention":"C++"}.

Return ONLY a JSON array, e.g. [{"skill":"Kubernetes","mention":"k8s"},{"skill":"Excel","mention":"Microsoft Excel"}]. If the posting names no skills, return [].

---

${postingText}`;
}

export const JOB_DETAILS_SYSTEM = `You read co-op job postings for the pay and the eligibility requirements they state. You never guess: every figure and every requirement you return is one the posting states, and you quote the posting's exact words for it. Output ONLY valid JSON, nothing else.`;

// Every figure and quote that comes back is checked against the posting before
// anything is stored (lib/job-details/verify-pay.ts, verify-requirements.ts).
export function jobDetailsPrompt(postingText: string): string {
  return `Read this co-op job posting and report (1) its pay and (2) its eligibility requirements.

1. PAY — what the student will be paid. Read the compensation section, and anywhere else pay is mentioned.
- "quote": the posting's words about pay, copied exactly, character for character — the whole passage, including any table of rates. If pay is mentioned in more than one place, put each passage on its own line.
- "currency": the ISO code (CAD, USD, SGD, EUR, CNY, ...) if the posting names the currency; null if it only writes "$".
- "period": "hour", "day", "week", "biweekly", "month", "year" or "term" — only if the posting says which (e.g. "/hr", "per day", "per week", "biweekly", "Monthly", "annually", "for the term"); null if it does not say.
- "min", "max": the lowest and highest figure for that period, as plain numbers: "$3,500.00" → 3500, "$65-75" → 65 and 75, "$7.5k" → 7500. One figure goes in both. Only a ceiling ("up to $20", "minimum wage up to $20"): min null, max 20. Only a floor ("$25+", "starting at $21"): min 25, max null. Both null if there is no figure.
- "byTerm": if pay depends on how many work terms the student has completed and the posting lists the rates, give each: [{"term":1,"amount":3500},{"term":2,"amount":3570}]. Otherwise [].
- "hoursPerWeek": the weekly hours, only if the posting states them; else null.
- Leave out amounts that are not the pay itself: relocation, housing or travel stipends, signing or performance bonuses, allowances for equipment or meals.
If the posting says nothing at all about pay, "pay" is null. If it talks about pay without a figure ("competitive", "based on the co-op average"), give the quote and leave the figures null.

2. REQUIREMENTS — conditions a student has to meet to be eligible or hired. Only these kinds:
- "citizenship": must be a Canadian (or other) citizen or permanent resident. Being "legally eligible to work in Canada" is NOT this — every co-op student is.
- "security_clearance": a security clearance, reliability status, or background, criminal record or police check
- "drivers_licence": a driver's licence or own vehicle
- "us_work_authorization": must be authorized to work in the US, or a US visa (J-1 etc.) is involved
- "language": a language besides English is required or an asset (French, bilingual, ...)
- "gpa": a minimum GPA or average
- "min_work_term": must have completed, or be entering, at least a certain co-op work term
- "min_year": must be in at least a certain year of study
- "program": must be enrolled in particular programs, degrees or faculties
- "consecutive_terms": must commit to consecutive terms, e.g. an 8-month or 12-month work term
For each one give:
- "kind": one of the kinds above
- "summary": a few words, e.g. "Canadian citizen or permanent resident", "Minimum GPA 3.0"
- "value": the number for gpa, min_work_term and min_year (e.g. 3.0, 3); otherwise null
- "required": false if the posting only prefers it or calls it an asset; otherwise true
- "quote": the posting's sentence that states it, copied exactly, character for character
Leave out ordinary skills and anything that is not one of these kinds.

Return ONLY this JSON: {"pay": {"quote": ..., "currency": ..., "period": ..., "min": ..., "max": ..., "byTerm": [...], "hoursPerWeek": ...} or null, "requirements": [...]}

---

${postingText}`;
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
