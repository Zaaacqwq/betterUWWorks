-- Pay and application requirements the model read out of each posting and
-- the code checked against it (web/src/lib/job-details). Written by hand, like
-- 0001: `db:push` would also try to drop the full-text index it doesn't know.
--   docker exec -i buw-postgres psql -U buw -d betteruwworks < drizzle/0002_ai_details.sql
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ai_details jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ai_details_at timestamp with time zone;

-- Filtering by requirement ("hide postings that need citizenship") looks
-- inside ai_details->'requirements'.
CREATE INDEX IF NOT EXISTS idx_jobs_ai_details ON jobs USING GIN (ai_details jsonb_path_ops);
