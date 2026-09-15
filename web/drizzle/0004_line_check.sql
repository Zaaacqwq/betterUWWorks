-- Line-by-line matching (web/src/lib/line-check). A posting is split into its
-- lines and each line tagged once, for everyone; each student's resume is then
-- checked against every line, and the result stored so the list and the
-- detail read the same thing. Written by hand, like 0001-0003:
--   docker exec -i buw-postgres psql -U buw -d betteruwworks < drizzle/0004_line_check.sql

-- When the posting was last split and tagged; empty means it is waiting. The
-- import empties it whenever the posting's text changes.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS lines_at timestamp with time zone;
-- A clear's snapshot is restored with `select *`, so it keeps the same columns.
ALTER TABLE IF EXISTS jobs_snapshot ADD COLUMN IF NOT EXISTS lines_at timestamp with time zone;

-- No foreign key to jobs: a clear and a restore then leave the lines alone,
-- and lines_at on the restored row still says which tagging they are.
CREATE TABLE IF NOT EXISTS job_lines (
  job_id text NOT NULL,
  line_no integer NOT NULL,
  -- req: Required skills; duty: Responsibilities; summary: the job summary,
  -- read only when a posting has neither of the others.
  section text NOT NULL CHECK (section IN ('req', 'duty', 'summary')),
  text text NOT NULL,
  kind text NOT NULL,
  importance text NOT NULL CHECK (importance IN ('required', 'preferred')),
  -- float32 vector from the Mac mini's embedding model; empty until embedded.
  embedding bytea,
  PRIMARY KEY (job_id, line_no)
);

-- One resume per signed-in student, kept so their postings can be checked
-- while they are away and follow them to another browser.
CREATE TABLE IF NOT EXISTS resumes (
  email text PRIMARY KEY,
  text text NOT NULL,
  text_hash text NOT NULL,
  file_name text,
  profile jsonb,
  user_info jsonb,
  extra_skills jsonb NOT NULL DEFAULT '[]',
  skill_levels jsonb NOT NULL DEFAULT '{}',
  -- Bumped when the resume text changes: every check made against an older
  -- version is out of date.
  version integer NOT NULL DEFAULT 1,
  -- The numbered lines the checks cite, [{ n, text, source, active }]. Only
  -- ever appended to within a version, so a cited number keeps its line.
  lines jsonb NOT NULL DEFAULT '[]',
  -- Versions uploaded today, { day, count }; past the daily cap a new version
  -- waits until tomorrow to be checked.
  full_checks jsonb NOT NULL DEFAULT '{}',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS line_grades (
  email text NOT NULL,
  job_id text NOT NULL,
  -- What was checked: this resume version against this tagging of the posting.
  resume_version integer NOT NULL,
  lines_at timestamp with time zone NOT NULL,
  -- [[line_no, grade, evidence]]: grade 2 met, 1 partly, 0 not shown, -1 not
  -- something a resume can show; evidence is the resume line number, or 0.
  grades jsonb NOT NULL,
  -- Out of 70, worked out from the grades and the lines' tags.
  skills real NOT NULL,
  -- Lines to check again after the student changed a skill.
  stale_lines jsonb NOT NULL DEFAULT '[]',
  graded_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (email, job_id)
);
