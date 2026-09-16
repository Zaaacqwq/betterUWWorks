-- Several resumes per student, one of them in use. Checks are kept per resume,
-- so switching back to one already checked shows its scores at once.
--   docker exec -i buw-postgres psql -U buw -d betteruwworks < drizzle/0005_multi_resume.sql

ALTER TABLE resumes ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();
-- What the student calls it ("With the robotics project"); the file name by default.
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

ALTER TABLE resumes DROP CONSTRAINT IF EXISTS resumes_pkey;
ALTER TABLE resumes ADD PRIMARY KEY (id);
CREATE INDEX IF NOT EXISTS idx_resumes_email ON resumes (email);
-- Exactly one in use per student.
CREATE UNIQUE INDEX IF NOT EXISTS idx_resumes_active ON resumes (email) WHERE active;

ALTER TABLE line_grades ADD COLUMN IF NOT EXISTS resume_id uuid;
UPDATE line_grades g SET resume_id = r.id FROM resumes r WHERE r.email = g.email AND g.resume_id IS NULL;
DELETE FROM line_grades WHERE resume_id IS NULL;
ALTER TABLE line_grades ALTER COLUMN resume_id SET NOT NULL;
ALTER TABLE line_grades DROP CONSTRAINT IF EXISTS line_grades_pkey;
ALTER TABLE line_grades ADD PRIMARY KEY (resume_id, job_id);
-- Kept alongside the resume id so everything of one student's can be removed.
CREATE INDEX IF NOT EXISTS idx_line_grades_email ON line_grades (email);
