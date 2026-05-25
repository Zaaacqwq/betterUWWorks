-- Add tsvector column and GIN index for full-text search
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_jobs_search ON jobs USING GIN (search_vector);

-- Trigger function to auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION jobs_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.organization, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.job_summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.required_skills, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.job_responsibilities, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.location, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.division, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jobs_search_vector ON jobs;
CREATE TRIGGER trg_jobs_search_vector
  BEFORE INSERT OR UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION jobs_search_vector_update();
