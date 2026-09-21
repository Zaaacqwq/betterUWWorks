import type { SamplePosting } from "../posting";

// Two postings where the work is firmware on a bench: the strongest match on the
// list and one the demo resume is turned down by on eligibility.

export const EMBEDDED_POSTINGS: SamplePosting[] = [
  {
    jobId: "452117",
    title: "Embedded Software Developer (Co-op)",
    organization: "Northgate Robotics",
    division: "Motion Control",
    location: "Kitchener, ON",
    address: "120 Breithaupt St, Kitchener, ON N2H 5R5",
    arrangement: "Hybrid",
    workTerm: "2027 - Winter",
    duration: "8 month consecutive work term required",
    level: "Junior, Intermediate",
    openings: 2,
    closesInDays: 8,
    pay: { min: 32, max: 38, hours: 40, quote: "$32.00 - $38.00 per hour depending on work term" },
    rating: { score: 8.6, count: 41 },
    totalHires: 64,
    hiresByTerm: { "First": 8, "Second": 19, "Third": 34, "Fourth": 25, "Fifth": 14 },
    summary:
      "Write and test C firmware for the motor controllers on Northgate's warehouse robots, on a team of four, with a hardware bench two metres away.",
    skills: ["C", "Embedded systems", "Debugging", "Python", "Git", "Linux", "RTOS", "CAN bus"],
    requirements: [
      {
        kind: "min_work_term",
        summary: "Third work term or later",
        value: 3,
        required: true,
        quote: "This role suits students entering their third co-op term or later.",
      },
      {
        kind: "program",
        summary: "Computer, Electrical, Mechatronics or Software Engineering",
        value: null,
        required: true,
        quote:
          "Open to students in Computer Engineering, Electrical Engineering, Mechatronics Engineering or Software Engineering.",
      },
    ],
    employerSummary:
      "Northgate Robotics builds autonomous pallet movers for cold-storage warehouses. The motion control team owns the firmware that turns a route into wheel torque, and the bench hardware it runs on.",
    responsibilities:
      "- Write and review C firmware for our motor controller boards under FreeRTOS\n- Bring up new controller revisions with the hardware team and log the faults you find\n- Extend our Python test harness so regressions are caught on the bench before a fleet update\n- Sit in on design reviews and write up the decisions that come out of them",
    requiredSkills:
      "- Confident C, including pointers, interrupts and reading a datasheet\n- Some exposure to embedded hardware: a microcontroller project, a car team, a course lab\n- Comfortable debugging with a logic analyser or an oscilloscope\n- Python for test tooling is an asset\n- Familiarity with CAN or another automotive bus is an asset",
    compensation: "$32.00 - $38.00 per hour depending on work term. Four weeks of transit pass reimbursement.",
    application: "Apply with a resume and a transcript. No cover letter needed.",
    ratings: {
      ratingsSummary: {
        headers: ["Question", "Responses", "Average"],
        rows: [
          ["Overall work term satisfaction", "41", "8.6 / 10"],
          ["Quality of supervision", "41", "8.9 / 10"],
          ["Work was related to my program", "41", "9.2 / 10"],
        ],
      },
      hiringHistory: {
        headers: ["Term", "Hires", "Returning"],
        rows: [
          ["2026 - Spring", "6", "2"],
          ["2026 - Winter", "5", "3"],
          ["2025 - Fall", "6", "1"],
        ],
      },
      hiresByFaculty: { Engineering: 78, Mathematics: 18, Science: 4 },
      hiresByWorkTermNumber: { "First": 8, "Second": 19, "Third": 34, "Fourth": 25, "Fifth": 14 },
      mostHiredPrograms: [
        { program: "Computer Engineering", hires: 21 },
        { program: "Mechatronics Engineering", hires: 17 },
        { program: "Electrical Engineering", hires: 12 },
      ],
    },
    lines: [
      {
        section: "req",
        kind: "skill",
        text: "Confident C, including pointers, interrupts and reading a datasheet",
        grade: 2,
        evidence: "Wrote a C driver for an STM32 sensor board, dropping sample latency 40%.",
        from: "work",
      },
      {
        section: "req",
        kind: "experience",
        text: "Some exposure to embedded hardware: a microcontroller project, a car team, a course lab",
        grade: 2,
        evidence: "Kart telemetry (UW Formula Electric) — logged CAN bus frames on a Raspberry Pi",
        from: "project",
      },
      {
        section: "req",
        kind: "skill",
        text: "Comfortable debugging with a logic analyser or an oscilloscope",
        grade: 2,
        evidence: "Debugged an I2C timing fault with a logic analyser and shipped the fix in a field update.",
        from: "work",
      },
      {
        section: "req",
        kind: "skill",
        importance: "preferred",
        text: "Python for test tooling is an asset",
        grade: 2,
        evidence: "Automated a board bring-up checklist in Python, saving the test bench about 3 hours a week.",
        from: "work",
      },
      {
        section: "req",
        kind: "skill",
        importance: "preferred",
        text: "Familiarity with CAN or another automotive bus is an asset",
        grade: 2,
        evidence: "Logged CAN bus frames on a Raspberry Pi and served live lap data to a React dashboard",
        from: "project",
      },
      {
        section: "req",
        kind: "eligibility",
        text: "This role suits students entering their third co-op term or later.",
      },
      {
        section: "duty",
        kind: "duty",
        text: "Write and review C firmware for our motor controller boards under FreeRTOS",
        grade: 1,
        evidence: "Wrote a C driver for an STM32 sensor board, dropping sample latency 40%.",
        from: "work",
      },
      {
        section: "duty",
        kind: "duty",
        text: "Bring up new controller revisions with the hardware team and log the faults you find",
        grade: 2,
        evidence: "Automated a board bring-up checklist in Python, saving the test bench about 3 hours a week.",
        from: "work",
      },
      {
        section: "duty",
        kind: "duty",
        text: "Extend our Python test harness so regressions are caught on the bench before a fleet update",
        grade: 2,
        evidence: "Wrote integration tests with pytest and wired them into GitHub Actions, taking the suite to 78% coverage.",
        from: "work",
      },
      {
        section: "duty",
        kind: "trait",
        text: "Sit in on design reviews and write up the decisions that come out of them",
        grade: 1,
        evidence: "Wrote up the results for the course's poster session.",
        from: "project",
      },
    ],
    letter:
      "Dear Northgate Robotics hiring team,\n\nI'd like to apply for the Embedded Software Developer co-op role. Last summer at Northwind Controls I wrote the C driver for an STM32 sensor board and brought sample latency down 40%, then tracked an intermittent I2C fault to a timing window with a logic analyser and shipped the fix as a field update. Bench work is the part of the job I look forward to.\n\nYour posting asks for Python on the test side. At Cedar Systems I wrote the integration suite in pytest and put it in GitHub Actions, and on Formula Electric I logged CAN frames on a Raspberry Pi for our telemetry dashboard — both close to the harness you describe.\n\nI'm entering my third co-op term in Computer Engineering and would be glad to talk.\n\nJordan Lee",
    advice: {
      score: 88,
      strengths: [
        "Lead with the STM32 driver: it answers the first required line almost word for word.",
        "The I2C fault you found with a logic analyser covers their debugging requirement with a story, not a claim.",
        "CAN on Formula Electric matches an asset they name — say the bus by name in the first paragraph.",
      ],
      gaps: [
        "Nothing on your resume names an RTOS. FreeRTOS is the one thing here you would be learning on the job.",
        "Your firmware experience is one term; they hire mostly at term 3 and later, so keep the depth concrete.",
      ],
      suggestions: [
        "Add one line about reading a datasheet end to end — they ask for it and you have done it.",
        "Ask in the interview which controller revision you'd start on; it shows you read the bring-up duty.",
      ],
    },
  },
  {
    jobId: "463020",
    title: "Firmware Test Engineer (Co-op)",
    organization: "Sable Aerospace",
    division: "Avionics Integration",
    location: "Montréal, QC",
    address: "9500 Boul Cavendish, Saint-Laurent, QC H4M 2V1",
    arrangement: "On-site",
    workTerm: "2027 - Winter",
    duration: "8 month consecutive work term required",
    level: "Intermediate",
    openings: 1,
    closesInDays: 18,
    pay: { min: 33, max: 36, hours: 40, quote: "$33 - $36 hourly" },
    rating: { score: 7.1, count: 12 },
    totalHires: 19,
    hiresByTerm: { "Third": 26, "Fourth": 32, "Fifth": 26, "Sixth +": 16 },
    summary:
      "Run and extend the test rigs that qualify avionics firmware before it flies, and write the reports that go with each run.",
    skills: ["C", "Python", "Embedded systems", "Testing", "Debugging", "Linux", "DO-178C"],
    requirements: [
      {
        kind: "citizenship",
        summary: "Canadian citizen or permanent resident",
        value: null,
        required: true,
        quote: "Because of export control rules, applicants must be Canadian citizens or permanent residents.",
      },
      {
        kind: "drivers_licence",
        summary: "Valid driver's licence",
        value: null,
        required: true,
        quote: "A valid driver's licence is required; the test site is a 20 minute drive from the main office.",
      },
      {
        kind: "language",
        summary: "French an asset",
        value: null,
        required: false,
        quote: "Working French is an asset but not required; the team works in English and French.",
      },
    ],
    employerSummary:
      "Sable Aerospace builds flight control computers for regional aircraft. Avionics integration owns the rigs that every firmware build has to pass before it leaves the building.",
    responsibilities:
      "- Run qualification test campaigns on the hardware rigs and record every deviation\n- Extend the Python harness that drives the rigs and collects their traces\n- Reproduce field reports on the bench with the firmware team\n- Write the qualification report for each build",
    requiredSkills:
      "- C, enough to read firmware you did not write\n- Python for test automation\n- Patience with hardware: rigs, harnesses, traces\n- Familiarity with DO-178C or another safety standard is an asset\n- Valid driver's licence",
    compensation: "$33 - $36 hourly. Site access requires a security briefing in your first week.",
    lines: [
      {
        section: "req",
        kind: "skill",
        text: "C, enough to read firmware you did not write",
        grade: 2,
        evidence: "Wrote a C driver for an STM32 sensor board, dropping sample latency 40%.",
        from: "work",
      },
      {
        section: "req",
        kind: "skill",
        text: "Python for test automation",
        grade: 2,
        evidence: "Automated a board bring-up checklist in Python, saving the test bench about 3 hours a week.",
        from: "work",
      },
      {
        section: "req",
        kind: "trait",
        text: "Patience with hardware: rigs, harnesses, traces",
        grade: 2,
        evidence: "Debugged an I2C timing fault with a logic analyser and shipped the fix in a field update.",
        from: "work",
      },
      {
        section: "req",
        kind: "skill",
        importance: "preferred",
        text: "Familiarity with DO-178C or another safety standard is an asset",
        grade: 0,
      },
      { section: "req", kind: "eligibility", text: "A valid driver's licence is required." },
      {
        section: "req",
        kind: "eligibility",
        text: "Because of export control rules, applicants must be Canadian citizens or permanent residents.",
      },
      {
        section: "duty",
        kind: "duty",
        text: "Run qualification test campaigns on the hardware rigs and record every deviation",
        grade: 1,
        evidence: "Automated a board bring-up checklist in Python",
        from: "work",
      },
      {
        section: "duty",
        kind: "duty",
        text: "Extend the Python harness that drives the rigs and collects their traces",
        grade: 2,
        evidence: "Wrote integration tests with pytest and wired them into GitHub Actions",
        from: "work",
      },
      {
        section: "duty",
        kind: "duty",
        text: "Write the qualification report for each build",
        grade: 1,
        evidence: "Wrote up the results for the course's poster session.",
        from: "project",
      },
    ],
    letter:
      "Dear Sable Aerospace,\n\nI'm applying for the Firmware Test Engineer co-op. At Northwind Controls I sat on the bench side of firmware: I wrote the C driver for an STM32 board, then spent a week with a logic analyser tracking an I2C fault that only appeared warm, and automated the bring-up checklist in Python so the next person spent three hours less a week on it.\n\nThat is the shape of the work you describe — rigs, traces, and a written record of what happened. I have not worked to DO-178C and would be learning the standard from the start, which I would rather say now than in week three.\n\nJordan Lee",
    advice: {
      score: 62,
      strengths: [
        "Bench firmware and Python automation are both required lines you answer from paid work.",
        "A small team taking one co-op means your bring-up checklist story will be read closely.",
      ],
      gaps: [
        "You have no driver's licence and the posting requires one — that warning is on the posting for a reason.",
        "No safety-standard exposure at all; DO-178C shapes how every test is written here.",
      ],
      suggestions: [
        "Sort the licence out before the interview or be ready to explain how you'd reach the test site.",
        "Read the first twenty pages of a DO-178C overview so the vocabulary isn't new.",
      ],
    },
  },
];
