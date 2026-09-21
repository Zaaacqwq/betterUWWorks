import type { Capability, ResumeProfile, Skill, UserInfo } from "@/lib/resume/types";

// The demo's student: made up, but shaped like a real second-year Waterloo
// resume, since everything on the demo is scored against it for real by
// lib/resume and lib/line-check. Her evidence is what the line-by-line check
// quotes back on each posting.

export const DEMO_RESUME_ID = "demo-resume";
export const DEMO_RESUME_FILE = "jordan-lee-resume.pdf";

export const DEMO_RESUME_TEXT = `JORDAN LEE
Waterloo, ON · jordan.lee@uwaterloo.ca · github.com/jordanlee

EDUCATION
University of Waterloo — BASc Candidate, Computer Engineering (2028)
Cumulative average 84% (3.7/4.0). Coursework: Data Structures and Algorithms,
Operating Systems, Digital Hardware, Probability and Statistics, Embedded Systems.

EXPERIENCE
Backend Developer Intern — Cedar Systems, Toronto ON (Jan 2026 – Apr 2026)
- Built four REST endpoints in Python and FastAPI over PostgreSQL, serving 2.1M requests a month.
- Cut a nightly reconciliation job from 40 minutes to 6 by batching queries and adding two indexes.
- Wrote integration tests with pytest and wired them into GitHub Actions, taking the suite to 78% coverage.
- Containerised the service with Docker and handed the on-call runbook to the platform team.

Firmware Intern — Northwind Controls, Kitchener ON (May 2025 – Aug 2025)
- Wrote a C driver for an STM32 sensor board, dropping sample latency 40%.
- Debugged an I2C timing fault with a logic analyser and shipped the fix in a field update.
- Automated a board bring-up checklist in Python, saving the test bench about 3 hours a week.

PROJECTS
Kart telemetry (UW Formula Electric) — Logged CAN bus frames on a Raspberry Pi and served live
lap data to a React dashboard used by the whole team at test days.
ECG classifier — Trained a PyTorch convolutional model on 40,000 labelled segments; 91% accuracy
on a held-out set. Wrote up the results for the course's poster session.

SKILLS
Python, C, C++, TypeScript, JavaScript, React, Next.js, SQL, PostgreSQL, Docker, Git, Linux,
pytest, GitHub Actions, PyTorch, pandas.

ACTIVITIES
UW Formula Electric — embedded team member, two seasons. Peer tutor for first-year programming.`;

const skills: Skill[] = [
  { name: "Python", category: "programming_language", proficiency: "advanced" },
  { name: "C", category: "programming_language", proficiency: "intermediate" },
  { name: "C++", category: "programming_language", proficiency: "beginner" },
  { name: "TypeScript", category: "programming_language", proficiency: "intermediate" },
  { name: "JavaScript", category: "programming_language", proficiency: "intermediate" },
  { name: "SQL", category: "programming_language", proficiency: "intermediate" },
  { name: "React", category: "framework", proficiency: "intermediate" },
  { name: "Next.js", category: "framework", proficiency: "beginner" },
  { name: "FastAPI", category: "framework", proficiency: "intermediate" },
  { name: "PyTorch", category: "framework", proficiency: "beginner" },
  { name: "PostgreSQL", category: "database", proficiency: "intermediate" },
  { name: "Docker", category: "tool", proficiency: "intermediate" },
  { name: "Git", category: "tool", proficiency: "advanced" },
  { name: "Linux", category: "tool", proficiency: "intermediate" },
  { name: "GitHub Actions", category: "tool", proficiency: "intermediate" },
  { name: "pytest", category: "tool", proficiency: "intermediate" },
  { name: "pandas", category: "tool", proficiency: "intermediate" },
];

// Where each skill was shown, as the reader of a resume would put it: what the
// student did with it beats a line in a skills list, and the weights follow.
const capabilities: Capability[] = [
  cap("Python", "programming_language", "Built four REST endpoints in Python and FastAPI over PostgreSQL", "work_used", 0.95),
  cap("FastAPI", "framework", "Built four REST endpoints in Python and FastAPI", "work_used", 0.9),
  cap("PostgreSQL", "database", "Cut a nightly reconciliation job from 40 minutes to 6 by batching queries and adding two indexes", "work_used", 0.9),
  cap("SQL", "programming_language", "Batching queries and adding two indexes on PostgreSQL", "work_used", 0.85),
  cap("REST APIs", "domain", "Built four REST endpoints serving 2.1M requests a month", "work_used", 0.9),
  cap("Docker", "tool", "Containerised the service with Docker", "work_used", 0.85),
  cap("pytest", "tool", "Wrote integration tests with pytest", "work_used", 0.85),
  cap("Testing", "domain", "Wrote integration tests and took the suite to 78% coverage", "work_used", 0.85),
  cap("CI/CD", "domain", "Wired the test suite into GitHub Actions", "work_used", 0.8),
  cap("GitHub Actions", "tool", "Wired them into GitHub Actions", "work_used", 0.8),
  cap("C", "programming_language", "Wrote a C driver for an STM32 sensor board", "work_used", 0.9),
  cap("Embedded systems", "domain", "C driver for an STM32 sensor board; I2C timing fault fixed in a field update", "work_used", 0.85),
  cap("Debugging", "domain", "Debugged an I2C timing fault with a logic analyser", "work_used", 0.85),
  cap("React", "framework", "Served live lap data to a React dashboard used at test days", "project_used", 0.75),
  cap("TypeScript", "programming_language", "React dashboard for kart telemetry", "project_used", 0.7),
  cap("PyTorch", "framework", "Trained a PyTorch convolutional model on 40,000 labelled segments", "project_used", 0.7),
  cap("Machine learning", "domain", "Trained a convolutional model; 91% accuracy on a held-out set", "project_used", 0.65),
  cap("Linux", "tool", "Logged CAN bus frames on a Raspberry Pi", "project_used", 0.65),
  cap("Git", "tool", "Listed under skills and used throughout", "explicit", 0.6),
  cap("C++", "programming_language", "Listed under skills", "explicit", 0.5),
  cap("Next.js", "framework", "Listed under skills", "explicit", 0.5),
  cap("pandas", "tool", "Listed under skills", "explicit", 0.5),
  cap("Data analysis", "domain", "pandas listed under skills; statistics coursework", "inferred", 0.45),
  cap("Teamwork", "soft_skill", "UW Formula Electric embedded team member, two seasons", "project_used", 0.7),
  cap("Communication", "soft_skill", "Wrote up results for the course's poster session; peer tutor", "project_used", 0.65),
];

function cap(
  name: string,
  category: Capability["category"],
  evidenceSource: string,
  evidenceType: Capability["evidenceType"],
  confidence: number
): Capability {
  return { name, category, evidenceSource, evidenceType, confidence, reasoning: evidenceSource };
}

export const DEMO_PROFILE: ResumeProfile = {
  skills,
  capabilities,
  profileSchema: 2,
  education: [
    { institution: "University of Waterloo", program: "Computer Engineering", degree: "BASc", yearLevel: 2 },
  ],
  experience: [
    {
      title: "Backend Developer Intern",
      company: "Cedar Systems",
      duration: "Jan 2026 – Apr 2026",
      skills: ["Python", "FastAPI", "PostgreSQL", "Docker", "pytest"],
      type: "coop",
    },
    {
      title: "Firmware Intern",
      company: "Northwind Controls",
      duration: "May 2025 – Aug 2025",
      skills: ["C", "STM32", "I2C", "Python"],
      type: "coop",
    },
    {
      title: "Kart telemetry",
      company: "UW Formula Electric",
      duration: "2025 – 2026",
      skills: ["React", "TypeScript", "CAN bus", "Linux"],
      type: "project",
    },
    {
      title: "ECG classifier",
      company: "Course project",
      duration: "Winter 2026",
      skills: ["PyTorch", "pandas", "Machine learning"],
      type: "project",
    },
  ],
  coopTermCount: 2,
  programs: ["Computer Engineering"],
  preferredLocations: ["Toronto, ON", "Waterloo, ON"],
  preferredArrangement: "Hybrid",
  preferredDuration: "4 months",
  summary:
    "Second-year Computer Engineering student with two co-op terms: backend services in Python and PostgreSQL, and firmware in C on STM32 boards.",
  extractedAt: "2026-08-30T15:20:00.000Z",
};

export const DEMO_USER_INFO: UserInfo = {
  coopTermNumber: 3,
  gpa: 3.7,
  yearLevel: 2,
  program: "Computer Engineering",
  citizenOrPermanentResident: true,
  // Left as no on purpose: it is what raises the licence warning on the
  // aerospace posting, which is the point of showing warnings at all.
  hasDriversLicence: false,
};
