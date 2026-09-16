-- Settings the owner can change while the site runs, without a deploy: the
-- daily AI allowances to begin with (web/src/lib/settings.ts).
--   docker exec -i buw-postgres psql -U buw -d betteruwworks < drizzle/0006_settings.sql
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by text
);
