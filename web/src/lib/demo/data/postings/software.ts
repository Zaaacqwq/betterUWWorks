import type { SamplePosting } from "../posting";

// The postings a backend or full-stack student applies to, from the one with the
// best work term ratings to the one with the worst.

export const SOFTWARE_POSTINGS: SamplePosting[] = [
  {
    jobId: "448903",
    title: "Backend Developer, Payments",
    organization: "Quayside Payments",
    division: "Merchant Platform",
    location: "Toronto, ON",
    address: "250 Front St W, Toronto, ON M5V 3G5",
    arrangement: "Hybrid",
    workTerm: "2027 - Winter",
    duration: "4 month work term",
    level: "Intermediate",
    openings: 3,
    closesInDays: 15,
    pay: { min: 29, max: 34, hours: 37.5, quote: "$29 - $34 / hour, 37.5 hours per week" },
    rating: { score: 7.9, count: 118 },
    totalHires: 210,
    hiresByTerm: { "First": 12, "Second": 24, "Third": 31, "Fourth": 21, "Fifth": 12 },
    summary:
      "Build and test the internal APIs that move a merchant's payouts, in Python and PostgreSQL, with a mentor who reviews every pull request.",
    skills: ["Python", "PostgreSQL", "REST APIs", "Docker", "Testing", "Git", "Kubernetes", "SQL"],
    requirements: [
      {
        kind: "min_work_term",
        summary: "Second work term or later",
        value: 2,
        required: true,
        quote: "Suited to students in their second co-op term or beyond.",
      },
      {
        kind: "citizenship",
        summary: "Eligible to work in Canada for the full term",
        value: null,
        required: true,
        quote: "Applicants must be eligible to work in Canada for the duration of the work term.",
      },
    ],
    employerSummary:
      "Quayside Payments settles card payments for about 9,000 Canadian merchants. The merchant platform team owns the services behind payouts, refunds and reporting.",
    responsibilities:
      "- Add endpoints to our payouts service in Python, with tests, behind a feature flag\n- Write the SQL that backs new reporting views and check the query plans\n- Take a small on-call shadow rotation with your mentor to see what breaks in production\n- Write the release notes for what you ship",
    requiredSkills:
      "- Python and a web framework such as FastAPI, Flask or Django\n- Relational databases: schema design, joins, indexes\n- Writing automated tests as part of normal work\n- Containers (Docker) for local development\n- Exposure to Kubernetes is an asset",
    compensation: "$29 - $34 / hour, 37.5 hours per week. Three paid volunteer days per term.",
    ratings: {
      ratingsSummary: {
        headers: ["Question", "Responses", "Average"],
        rows: [
          ["Overall work term satisfaction", "118", "7.9 / 10"],
          ["Quality of supervision", "118", "8.1 / 10"],
          ["Would recommend to another student", "118", "7.6 / 10"],
        ],
      },
      hiringHistory: {
        headers: ["Term", "Hires", "Returning"],
        rows: [
          ["2026 - Spring", "14", "5"],
          ["2026 - Winter", "11", "4"],
          ["2025 - Fall", "9", "2"],
        ],
      },
      hiresByFaculty: { Mathematics: 54, Engineering: 38, Science: 8 },
      mostHiredPrograms: [
        { program: "Computer Science", hires: 48 },
        { program: "Computer Engineering", hires: 19 },
        { program: "Software Engineering", hires: 15 },
      ],
    },
    lines: [
      {
        section: "req",
        kind: "skill",
        text: "Python and a web framework such as FastAPI, Flask or Django",
        grade: 2,
        evidence: "Built four REST endpoints in Python and FastAPI over PostgreSQL, serving 2.1M requests a month.",
        from: "work",
      },
      {
        section: "req",
        kind: "skill",
        text: "Relational databases: schema design, joins, indexes",
        grade: 2,
        evidence: "Cut a nightly reconciliation job from 40 minutes to 6 by batching queries and adding two indexes.",
        from: "work",
      },
      {
        section: "req",
        kind: "skill",
        text: "Writing automated tests as part of normal work",
        grade: 2,
        evidence: "Wrote integration tests with pytest and wired them into GitHub Actions, taking the suite to 78% coverage.",
        from: "work",
      },
      {
        section: "req",
        kind: "skill",
        text: "Containers (Docker) for local development",
        grade: 2,
        evidence: "Containerised the service with Docker and handed the on-call runbook to the platform team.",
        from: "work",
      },
      {
        section: "req",
        kind: "skill",
        importance: "preferred",
        text: "Exposure to Kubernetes is an asset",
        grade: 0,
      },
      {
        section: "req",
        kind: "eligibility",
        text: "Applicants must be eligible to work in Canada for the duration of the work term.",
      },
      {
        section: "duty",
        kind: "duty",
        text: "Add endpoints to our payouts service in Python, with tests, behind a feature flag",
        grade: 2,
        evidence: "Built four REST endpoints in Python and FastAPI over PostgreSQL, serving 2.1M requests a month.",
        from: "work",
      },
      {
        section: "duty",
        kind: "duty",
        text: "Write the SQL that backs new reporting views and check the query plans",
        grade: 1,
        evidence: "Batching queries and adding two indexes on PostgreSQL",
        from: "work",
      },
      {
        section: "duty",
        kind: "duty",
        text: "Take a small on-call shadow rotation with your mentor to see what breaks in production",
        grade: 1,
        evidence: "Handed the on-call runbook to the platform team.",
        from: "work",
      },
      { section: "duty", kind: "outcome", text: "You will leave knowing how card settlement actually works." },
    ],
    letter:
      "Dear Quayside Payments team,\n\nI'm applying for the Backend Developer co-op on the merchant platform. At Cedar Systems I built four REST endpoints in Python and FastAPI over PostgreSQL that now serve about 2.1 million requests a month, and I brought a nightly reconciliation job from forty minutes to six by batching its queries and adding two indexes — reconciliation is close enough to payouts that I know why the query plan matters.\n\nTesting is part of how I work rather than a step at the end: my integration suite in pytest runs in GitHub Actions and took coverage to 78%. I develop against Docker daily. Kubernetes I have only read about, and I'd like to learn it properly on a team that runs it.\n\nJordan Lee",
    advice: {
      score: 82,
      strengths: [
        "Your FastAPI and PostgreSQL work answers the first two required lines directly — lead with the reconciliation job.",
        "Tests and Docker are both required here and both sit in your work experience, not your skills list.",
      ],
      gaps: [
        "Kubernetes is the one asset you can't show. Say plainly that you haven't used it rather than implying otherwise.",
        "Nothing on your resume touches payments or money movement; expect a question about correctness under retries.",
      ],
      suggestions: [
        "Name the request volume — 2.1M a month is the number that makes a co-op resume land here.",
        "Read up on idempotency keys before the interview; it is the first thing a payouts team asks about.",
      ],
    },
  },
  {
    jobId: "449876",
    title: "Full-Stack Developer (Winter 2027)",
    organization: "Lumen Grid Energy",
    division: "Customer Tools",
    location: "Waterloo, ON",
    address: "305 King St W, Kitchener, ON N2G 1B9",
    arrangement: "Hybrid",
    workTerm: "2027 - Winter",
    duration: "4 month work term",
    level: "Junior",
    openings: 4,
    closesInDays: 12,
    pay: { min: 30, hours: 40, quote: "$30.00 per hour" },
    rating: { score: 8.2, count: 64 },
    totalHires: 88,
    hiresByTerm: { "First": 22, "Second": 30, "Third": 26, "Fourth": 14, "Fifth": 8 },
    summary:
      "Build screens and endpoints for the portal where Lumen's electricity customers read their usage, in TypeScript, React and Node.",
    skills: ["TypeScript", "React", "Node.js", "PostgreSQL", "REST APIs", "Git", "Testing", "CSS"],
    requirements: [
      {
        kind: "program",
        summary: "Any engineering, mathematics or computing program",
        value: null,
        required: false,
        quote: "We welcome students from any engineering, mathematics or computing program.",
      },
    ],
    employerSummary:
      "Lumen Grid Energy is a retail electricity provider in southwestern Ontario. The customer tools team builds the portal and the mobile web app that about 140,000 households use to read their bills.",
    responsibilities:
      "- Build screens in React and TypeScript from designs the team reviews with you\n- Write the Node endpoints behind them and the PostgreSQL queries they need\n- Add tests for what you build and keep the pipeline green\n- Join the weekly call where we read customer support tickets together",
    requiredSkills:
      "- JavaScript or TypeScript, and React\n- Some backend experience: Node, Python, Java, anything server-side\n- SQL and a relational database\n- Careful CSS: our portal is used on phones more than laptops\n- Curiosity about how people actually read an electricity bill",
    compensation: "$30.00 per hour. Hybrid: two days a week in the Kitchener office.",
    ratings: {
      ratingsSummary: {
        headers: ["Question", "Responses", "Average"],
        rows: [
          ["Overall work term satisfaction", "64", "8.2 / 10"],
          ["Quality of supervision", "64", "8.4 / 10"],
          ["Work was related to my program", "64", "7.7 / 10"],
        ],
      },
      hiringHistory: {
        headers: ["Term", "Hires", "Returning"],
        rows: [
          ["2026 - Spring", "8", "3"],
          ["2026 - Winter", "7", "2"],
          ["2025 - Fall", "6", "2"],
        ],
      },
      hiresByFaculty: { Engineering: 46, Mathematics: 44, Arts: 6, Science: 4 },
    },
    lines: [
      {
        section: "req",
        kind: "skill",
        text: "JavaScript or TypeScript, and React",
        grade: 2,
        evidence: "Served live lap data to a React dashboard used by the whole team at test days.",
        from: "project",
      },
      {
        section: "req",
        kind: "experience",
        text: "Some backend experience: Node, Python, Java, anything server-side",
        grade: 2,
        evidence: "Built four REST endpoints in Python and FastAPI over PostgreSQL, serving 2.1M requests a month.",
        from: "work",
      },
      {
        section: "req",
        kind: "skill",
        text: "SQL and a relational database",
        grade: 2,
        evidence: "Cut a nightly reconciliation job from 40 minutes to 6 by batching queries and adding two indexes.",
        from: "work",
      },
      {
        section: "req",
        kind: "skill",
        text: "Careful CSS: our portal is used on phones more than laptops",
        grade: 1,
        evidence: "React dashboard for kart telemetry",
        from: "project",
      },
      {
        section: "req",
        kind: "trait",
        text: "Curiosity about how people actually read an electricity bill",
        grade: 1,
        evidence: "Peer tutor for first-year programming.",
        from: "other",
      },
      {
        section: "duty",
        kind: "duty",
        text: "Build screens in React and TypeScript from designs the team reviews with you",
        grade: 2,
        evidence: "Served live lap data to a React dashboard used by the whole team at test days.",
        from: "project",
      },
      {
        section: "duty",
        kind: "duty",
        text: "Write the Node endpoints behind them and the PostgreSQL queries they need",
        grade: 1,
        evidence: "Built four REST endpoints in Python and FastAPI over PostgreSQL",
        from: "work",
      },
      {
        section: "duty",
        kind: "duty",
        text: "Add tests for what you build and keep the pipeline green",
        grade: 2,
        evidence: "Wrote integration tests with pytest and wired them into GitHub Actions, taking the suite to 78% coverage.",
        from: "work",
      },
    ],
    letter:
      "Dear Lumen Grid Energy,\n\nI'd like to apply for the Full-Stack Developer role on customer tools. On UW Formula Electric I built the React and TypeScript dashboard our team read at test days — live lap data off the CAN bus, on a laptop screen in the sun, which taught me more about readable interfaces than any tutorial. At Cedar Systems I wrote the server half: Python and FastAPI endpoints on PostgreSQL, with the integration tests to keep them honest.\n\nYour posting says the portal is used on phones more than laptops. That constraint is the interesting part of the job to me, and it is the part I'd want to be measured on.\n\nJordan Lee",
    advice: {
      score: 85,
      strengths: [
        "React and a real backend term cover the first two required lines outright.",
        "They hire heavily at work terms two and three, which is exactly where you are.",
      ],
      gaps: [
        "Your React work is a project, not a paid term — worth half credit in the check, so make it concrete.",
        "Node itself is missing; your server work is Python. Say so plainly, the posting allows it.",
      ],
      suggestions: [
        "Mention the phone-first constraint in the first paragraph; nobody else will.",
        "Bring a screenshot of the telemetry dashboard to the interview.",
      ],
    },
  },
  {
    jobId: "441502",
    title: "Platform Reliability Co-op",
    organization: "Helix Freight Systems",
    location: "Toronto, ON",
    arrangement: "Hybrid",
    workTerm: "2027 - Winter",
    duration: "4 month work term",
    level: "Intermediate",
    openings: 2,
    closesInDays: 6,
    pay: { min: 28, max: 33, hours: 40, quote: "$28.00 - $33.00 per hour" },
    rating: { score: 5.8, count: 89 },
    totalHires: 140,
    hiresByTerm: { "Second": 18, "Third": 29, "Fourth": 27, "Fifth": 16, "Sixth +": 10 },
    summary:
      "Keep the services behind Helix's freight tracking running: dashboards, alerts, and the runbooks that go with them.",
    skills: ["Linux", "Docker", "Kubernetes", "Python", "Terraform", "Monitoring", "Git", "AWS"],
    requirements: [
      {
        kind: "min_work_term",
        summary: "Third work term or later",
        value: 3,
        required: true,
        quote: "Third co-op term or later, please.",
      },
    ],
    employerSummary:
      "Helix Freight Systems tracks shipments for carriers across North America. The platform team keeps about sixty services and their alerts in working order.",
    responsibilities:
      "- Add dashboards and alerts for services that don't have them yet\n- Write runbooks for the alerts you add, and test them against a real incident\n- Automate a piece of our cloud setup in Terraform\n- Shadow the on-call engineer one week in four",
    requiredSkills:
      "- Linux and the command line, comfortably\n- Docker, and some idea of what Kubernetes does\n- A scripting language, Python preferred\n- Infrastructure as code (Terraform, Pulumi) is an asset\n- Willingness to write documentation nobody asked for",
    compensation: "$28.00 - $33.00 per hour.",
    ratings: {
      ratingsSummary: {
        headers: ["Question", "Responses", "Average"],
        rows: [
          ["Overall work term satisfaction", "89", "5.8 / 10"],
          ["Quality of supervision", "89", "5.2 / 10"],
          ["Would recommend to another student", "89", "5.5 / 10"],
        ],
      },
      hiringHistory: {
        headers: ["Term", "Hires", "Returning"],
        rows: [
          ["2026 - Spring", "12", "1"],
          ["2026 - Winter", "10", "2"],
          ["2025 - Fall", "11", "1"],
        ],
      },
      hiresByFaculty: { Mathematics: 51, Engineering: 41, Science: 8 },
    },
    lines: [
      {
        section: "req",
        kind: "skill",
        text: "Linux and the command line, comfortably",
        grade: 2,
        evidence: "Logged CAN bus frames on a Raspberry Pi",
        from: "project",
      },
      {
        section: "req",
        kind: "skill",
        text: "Docker, and some idea of what Kubernetes does",
        grade: 1,
        evidence: "Containerised the service with Docker and handed the on-call runbook to the platform team.",
        from: "work",
      },
      {
        section: "req",
        kind: "skill",
        text: "A scripting language, Python preferred",
        grade: 2,
        evidence: "Automated a board bring-up checklist in Python, saving the test bench about 3 hours a week.",
        from: "work",
      },
      {
        section: "req",
        kind: "skill",
        importance: "preferred",
        text: "Infrastructure as code (Terraform, Pulumi) is an asset",
        grade: 0,
      },
      {
        section: "req",
        kind: "trait",
        text: "Willingness to write documentation nobody asked for",
        grade: 2,
        evidence: "Handed the on-call runbook to the platform team.",
        from: "work",
      },
      {
        section: "duty",
        kind: "duty",
        text: "Add dashboards and alerts for services that don't have them yet",
        grade: 0,
      },
      {
        section: "duty",
        kind: "duty",
        text: "Write runbooks for the alerts you add, and test them against a real incident",
        grade: 1,
        evidence: "Handed the on-call runbook to the platform team.",
        from: "work",
      },
      { section: "duty", kind: "duty", text: "Automate a piece of our cloud setup in Terraform", grade: 0 },
    ],
    letter:
      "Dear Helix Freight Systems,\n\nI'm applying for the Platform Reliability co-op. At Cedar Systems I containerised our service with Docker and wrote the on-call runbook the platform team now uses, which is the part of your posting I recognise: the work is only finished when the next person can follow it at 3am.\n\nI'm comfortable on Linux from the telemetry work I did on a Raspberry Pi, and Python is my strongest language. Terraform and alerting I have not done, so I would be starting there, and I'd like the first thing I add to be a dashboard for a service that has none.\n\nJordan Lee",
    advice: {
      score: 70,
      strengths: [
        "The runbook you wrote answers their documentation line better than any claim could.",
        "Linux and Python are both required and both on solid evidence.",
      ],
      gaps: [
        "No Terraform, no alerting or dashboard work — two duties scored not shown.",
        "Their work term ratings are the weakest on this list: 5.2 for supervision across 89 responses.",
      ],
      suggestions: [
        "Ask in the interview who you would report to and how often you'd meet — those ratings are a real signal.",
        "Spend a weekend standing up Prometheus and Grafana on a toy service; it closes the visible gap.",
      ],
    },
  },
];
