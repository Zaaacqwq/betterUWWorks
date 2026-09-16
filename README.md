# betterUWWorks

A private site for a handful of University of Waterloo students. It holds the co-op postings from
WaterlooWorks, makes them searchable the way the real site isn't, and scores each one against your
resume — line by line, with the line of your resume that earned each point.

Self-hosted on one Mac mini at `jobs.zaaac.vip`: sign in with Google, and the owner decides who gets in.
Nothing is public, and there is no second tenant — one board, one set of postings, a few students.

## How a posting becomes a score

```
WaterlooWorks
  │
  ├─ extension/           the owner's Chrome, once a day: list pages, then each posting's detail
  │                       (you sign in to WaterlooWorks yourself; it never handles your password)
  ▼
POST /api/jobs/import     one row per posting; text that changed marks its readings stale
  │
  ├─ lib/job-skills       the skills the posting names, verified against its own words
  ├─ lib/job-details      pay, work term, GPA, citizenship, licence
  ├─ lib/job-summary      one paragraph of what the job is
  └─ lib/line-check       the posting split into its lines, each tagged once for everyone:
                          skill · experience · duty · trait · eligibility · outcome · heading,
                          required or nice to have
  │
  ▼
Your resume (kept on the server under your email, one of up to five)
  │
  └─ lib/line-check/grader  every open posting checked against the whole resume, 12 calls at a
                            time, best estimate first; a posting you open jumps the queue
  ▼
Score out of 100  =  skills 70  +  level 15  +  program 15
      skills   each line's grade (met / partly / not shown), weighted by what kind of line it is,
               whether the posting requires it, and where on the resume the evidence came from
               (work 1 · project 0.85 · education 0.7 · a skills list or a skill you added 0.5)
      level    the terms this employer has hired before, or the posting's junior/intermediate/senior
      program  whether the posting asks for programs and whether yours is among them
```

GPA, work term, year, citizenship and licence never move the score — they are shown as warnings on the
posting instead. Until a posting has been checked its score shows as `~68`, an estimate from matching
skill names; the list and the detail always read the same stored check.

## Layout

```
extension/            MV3 extension: scrapes the boards, syncs to the web app, runs itself daily
  autorun.js          the daily run as a state machine; ntfy when it needs a WaterlooWorks sign-in
  content/            reads a list page and a posting's detail out of the DOM
web/
  src/app/            pages and /api routes (Next.js App Router)
  src/proxy.ts        the one trust boundary: every /api request is a signed-in, approved student
  src/components/     the list, the detail panel, the resume dialog, /admin
  src/lib/line-check/ splitting and tagging postings, checking resumes, scoring, the scheduler
  src/lib/resume/     the older name-matching engine, still used for the estimate and as a fallback
  src/db/schema.ts    jobs · job_lines · app_users · resumes · line_grades · settings
  drizzle/*.sql       migrations, applied by hand in order
ops/                  deploy script, launchd agents, health check
```

## Running it locally

Node 22+ and Docker.

```bash
docker compose up -d                                   # Postgres on 127.0.0.1:5432
cd web && npm install
for f in drizzle/*.sql; do                             # migrations, in order
  docker exec -i buw-postgres psql -U buw -d betteruwworks < "$f"
done
npm run dev                                            # http://localhost:3000
```

`web/.env.local`:

| Variable | What it is |
| --- | --- |
| `DATABASE_URL` | `postgres://buw:buw_dev_password@127.0.0.1:5432/betteruwworks` |
| `OPENCODE_API_KEY` | the gateway key for every model call |
| `API_KEY` | what the extension and the scripts on the server present instead of signing in |
| `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_URL` | Google sign-in; without them `next dev` runs open for you and production refuses everyone |
| `ADMIN_EMAILS` | who may approve students, import, and read the settings |
| `NTFY_TOPIC` | where the extension and the health check send alerts |
| `OLLAMA_URL`, `EMBED_MODEL` | the embedding model, only for finding which lines a skill change touches |
| `LINE_CHECK_CONCURRENCY` | how many checks run at once (12) |

Load `extension/` unpacked at `chrome://extensions`, set the web app URL and the API key in its popup,
open a WaterlooWorks board and press Run now.

## Checks

```bash
cd web
npm test                 # 366 unit tests
npx tsc --noEmit
npm run lint
npm run lint:extension
```

## Deploying

```bash
ops/bin/deploy.sh        # git pull --ff-only, npm ci, build, restart, wait for the site to answer
```

The server is a `next start` under launchd (`ops/launchd/`), behind a Cloudflare tunnel. Two more agents
back the database up nightly and check hourly that the site is up, that postings are still arriving, and
that the embedding model is loaded — each alerts over ntfy. Migrations are applied by hand:

```bash
ssh mac 'docker exec -i buw-postgres psql -U buw -d betteruwworks' < web/drizzle/000N_thing.sql
```

Model spend is the thing to watch: tagging a posting's lines is paid once and shared by everyone, but
checking a resume against every open posting is about 2M tokens per student per new resume. The daily
allowances (cover letters, advice, summaries, resume readings, full re-checks) are set from `/admin` and
take effect within seconds.
