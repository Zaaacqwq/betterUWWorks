import type { SamplePosting } from "../posting";

// Data and research postings, including the two the demo leaves unchecked so the
// list also shows a score that is still an estimate.

export const DATA_POSTINGS: SamplePosting[] = [
  {
    jobId: "461244",
    title: "Machine Learning Engineering Intern",
    organization: "Kestrel Health Data",
    location: "Vancouver, BC",
    arrangement: "Remote",
    workTerm: "2027 - Winter",
    duration: "8 month consecutive work term required",
    level: "Intermediate, Senior",
    openings: 1,
    closesInDays: 3,
    pay: { min: 34, max: 40, hours: 40, quote: "$34.00 to $40.00 per hour" },
    rating: { score: 9.1, count: 23 },
    totalHires: 31,
    hiresByTerm: { "Third": 18, "Fourth": 34, "Fifth": 28, "Sixth +": 20 },
    summary:
      "Train and evaluate models that flag charting errors in hospital records, and ship the winning one behind an API the clinical team can call.",
    skills: ["Python", "PyTorch", "Machine learning", "pandas", "Statistics", "MLOps", "AWS", "SQL"],
    requirements: [
      {
        kind: "min_work_term",
        summary: "Fourth work term or later",
        value: 4,
        required: true,
        quote: "We hire this role at fourth work term and above.",
      },
      {
        kind: "gpa",
        summary: "80% cumulative average",
        value: 80,
        required: true,
        quote: "A cumulative average of 80% or higher is required.",
      },
    ],
    employerSummary:
      "Kestrel Health Data works with six hospital networks on the quality of their clinical records. The ML team builds the models that flag a chart worth a second look.",
    responsibilities:
      "- Prepare training sets from de-identified records with pandas and SQL\n- Train and compare models in PyTorch, and defend your evaluation to the team\n- Package the chosen model behind a FastAPI endpoint deployed on AWS\n- Write the model card that goes to our clinical reviewers",
    requiredSkills:
      "- Strong Python and pandas\n- Deep learning in PyTorch or TensorFlow, beyond coursework\n- Statistics: sampling, class imbalance, calibration\n- Experience deploying a model, not only training one\n- AWS (SageMaker, S3, Lambda) is an asset",
    lines: [
      {
        section: "req",
        kind: "skill",
        text: "Strong Python and pandas",
        grade: 2,
        evidence: "Built four REST endpoints in Python and FastAPI over PostgreSQL, serving 2.1M requests a month.",
        from: "work",
      },
      {
        section: "req",
        kind: "skill",
        text: "Deep learning in PyTorch or TensorFlow, beyond coursework",
        grade: 1,
        evidence: "Trained a PyTorch convolutional model on 40,000 labelled segments; 91% accuracy on a held-out set.",
        from: "project",
      },
      {
        section: "req",
        kind: "skill",
        text: "Statistics: sampling, class imbalance, calibration",
        grade: 1,
        evidence: "Coursework: Probability and Statistics",
        from: "education",
      },
      {
        section: "req",
        kind: "experience",
        text: "Experience deploying a model, not only training one",
        grade: 0,
      },
      { section: "req", kind: "skill", importance: "preferred", text: "AWS (SageMaker, S3, Lambda) is an asset", grade: 0 },
      { section: "req", kind: "eligibility", text: "A cumulative average of 80% or higher is required." },
      {
        section: "duty",
        kind: "duty",
        text: "Prepare training sets from de-identified records with pandas and SQL",
        grade: 1,
        evidence: "Python, pandas, SQL",
        from: "skills",
      },
      {
        section: "duty",
        kind: "duty",
        text: "Train and compare models in PyTorch, and defend your evaluation to the team",
        grade: 2,
        evidence: "Trained a PyTorch convolutional model on 40,000 labelled segments; 91% accuracy on a held-out set.",
        from: "project",
      },
      {
        section: "duty",
        kind: "duty",
        text: "Package the chosen model behind a FastAPI endpoint deployed on AWS",
        grade: 1,
        evidence: "Built four REST endpoints in Python and FastAPI over PostgreSQL",
        from: "work",
      },
    ],
    letter:
      "Dear Kestrel Health Data,\n\nI'm applying for the Machine Learning Engineering internship. For a course project I trained a PyTorch convolutional model on 40,000 labelled ECG segments and reached 91% on a held-out set, and most of that work was the unglamorous part your posting describes: sampling a set that wasn't badly imbalanced, and being able to say why the number was honest.\n\nThe deployment half I have from the other side. At Cedar Systems I built Python and FastAPI services on PostgreSQL and containerised them with Docker, so putting a model behind an endpoint is familiar ground even though the model wasn't mine.\n\nI haven't used SageMaker. I'd be glad to learn it here.\n\nJordan Lee",
    advice: {
      score: 64,
      strengths: [
        "The ECG classifier is real training work with a held-out number attached — that is what they mean by 'beyond coursework'.",
        "Your FastAPI and Docker experience covers the serving half of the job.",
      ],
      gaps: [
        "You have never deployed a model you trained. That is a required line and the check scored it not shown.",
        "They hire at work term four and above; you are going into three.",
        "No AWS anywhere on the resume.",
      ],
      suggestions: [
        "Put the ECG project above your skills list on the resume you send here.",
        "If you have two weeks, put the classifier behind a small endpoint and add that line — it closes the biggest gap.",
      ],
    },
  },
  {
    jobId: "455310",
    title: "Data Engineering Co-op",
    organization: "Riverbend Analytics",
    division: "Data Platform",
    location: "Ottawa, ON",
    arrangement: "On-site",
    workTerm: "2027 - Winter",
    duration: "4 month work term",
    level: "Junior",
    openings: 2,
    closesInDays: 22,
    pay: { min: 27, max: 31, hours: 37.5, quote: "$27 - $31 an hour" },
    rating: { score: 6.4, count: 57 },
    totalHires: 72,
    hiresByTerm: { "First": 26, "Second": 28, "Third": 24, "Fourth": 14, "Fifth": 8 },
    summary:
      "Move data between the warehouses Riverbend's analysts live in, and make the pipelines fail loudly instead of quietly.",
    skills: ["Python", "SQL", "Airflow", "dbt", "PostgreSQL", "pandas", "Git"],
    requirements: [],
    employerSummary:
      "Riverbend Analytics reports on programme spending for public sector clients. The data platform team owns the pipelines behind every report that leaves the building.",
    responsibilities:
      "- Write and maintain Airflow DAGs that load client data on a schedule\n- Model tables in dbt and document what each column means\n- Add the checks that catch a bad load before an analyst finds it\n- Pair with an analyst for a day each month to see how the data is used",
    requiredSkills:
      "- Python and SQL\n- Some experience with a data warehouse or a serious database\n- Care about data quality: nulls, duplicates, late arrivals\n- Airflow or dbt is an asset, not an expectation",
    compensation: "$27 - $31 an hour, 37.5 hours per week. On-site in Ottawa.",
    letter:
      "Dear Riverbend Analytics,\n\nI'd like to apply for the Data Engineering co-op. The work I did at Cedar Systems was mostly this job under another name: a nightly reconciliation job that took forty minutes and silently skipped rows, which I brought to six minutes and made noisy when a load was short. Python and PostgreSQL are where I'm strongest, and pandas is how I check a suspicious table.\n\nI haven't used Airflow or dbt. Your posting says that's fine, so I'll say it plainly and add that the DAG concept is familiar from the scheduling I did by hand.\n\nJordan Lee",
    advice: {
      score: 74,
      strengths: [
        "Your reconciliation work is data engineering, and the before-and-after number makes it legible.",
        "Python and SQL are the two required lines, and both sit in paid work.",
      ],
      gaps: [
        "No Airflow or dbt, though the posting calls them assets rather than requirements.",
        "This posting hasn't been checked line by line yet, so its score here is still an estimate.",
      ],
      suggestions: [
        "Describe the silent row-skipping bug: data quality is the trait they are actually hiring for.",
        "Skim the dbt tutorial the night before the interview so the vocabulary lands.",
      ],
    },
  },
  {
    jobId: "458771",
    title: "Bioinformatics Software Co-op",
    organization: "Tallgrass Bio",
    location: "Toronto, ON",
    arrangement: "On-site",
    workTerm: "2027 - Winter",
    duration: "4 month work term",
    level: "Junior",
    openings: 1,
    closesInDays: 24,
    pay: { min: 26, max: 30, hours: 40, quote: "$26.00 - $30.00 per hour" },
    summary:
      "Write the tooling that turns sequencing runs into something Tallgrass's biologists can read, mostly in Python on a Linux cluster.",
    skills: ["Python", "Linux", "Bioinformatics", "Statistics", "Git", "R", "Nextflow"],
    requirements: [
      {
        kind: "program",
        summary: "Bioinformatics, Computational Science or Biology with programming",
        value: null,
        required: true,
        quote:
          "Open to students in Bioinformatics, Computational Science, or Biology programs with strong programming coursework.",
      },
    ],
    employerSummary:
      "Tallgrass Bio sequences plant genomes for seed developers. The software team keeps the analysis pipelines that every result passes through.",
    responsibilities:
      "- Maintain Nextflow pipelines that run on our Linux cluster\n- Write Python tools that summarise a run for the biologists\n- Keep the reference data tidy and versioned\n- Explain a result to someone who does not write code",
    requiredSkills:
      "- Python, comfortably\n- Linux and shell scripting\n- Genomics vocabulary: reads, alignment, variants\n- R or Nextflow is an asset",
    compensation: "$26.00 - $30.00 per hour.",
    letter:
      "Dear Tallgrass Bio,\n\nI'm applying for the Bioinformatics Software co-op. My strongest language is Python — at Cedar Systems I wrote the services and the test suite behind a reconciliation pipeline — and I'm at home on Linux from the telemetry work I did on a Raspberry Pi for our Formula Electric team.\n\nI should be straight with you: I'm in Computer Engineering, not a life sciences program, and the genomics vocabulary is new to me. What I can offer is the software half done carefully, and a habit of explaining results to people who don't write code, from two terms of peer tutoring.\n\nJordan Lee",
    advice: {
      score: 48,
      strengths: [
        "Python and Linux, the two software requirements, are both well shown.",
        "Small team, single opening: a careful cover letter is read here.",
      ],
      gaps: [
        "The posting asks for Bioinformatics, Computational Science or Biology. Computer Engineering isn't among them, which costs most of the program points.",
        "No genomics vocabulary anywhere on the resume, and it is a required line.",
      ],
      suggestions: [
        "Apply only if you actually want the domain — the program mismatch means the letter has to carry it.",
        "Read one primer on read alignment so the interview isn't the first time you use the words.",
      ],
    },
  },
];
