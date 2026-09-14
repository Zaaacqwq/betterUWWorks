-- Everyone who has signed in with Google, and whether the owner has let them
-- see the postings (web/src/lib/auth/users.ts). Written by hand, like 0001 and
-- 0002: `db:push` would also try to drop the full-text index it doesn't know.
--   docker exec -i buw-postgres psql -U buw -d betteruwworks < drizzle/0003_app_users.sql
CREATE TABLE IF NOT EXISTS app_users (
  email text PRIMARY KEY,
  name text,
  image text,
  -- pending: signed in, waiting for the owner; approved: may see postings;
  -- blocked: turned away until the owner says otherwise.
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'blocked')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  decided_at timestamp with time zone,
  decided_by text
);
