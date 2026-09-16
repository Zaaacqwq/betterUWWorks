import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  real,
  boolean,
  primaryKey,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { PostingDetails } from "../lib/job-details/types";
import type { LineGrade, LineImportance, LineKind, LineSection, ResumeLine } from "../lib/line-check/types";
import type { SkillLevel } from "../lib/resume/types";

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    jobId: text("job_id").notNull().unique(),
    title: text("title").notNull(),
    organization: text("organization").notNull(),
    division: text("division"),
    openings: integer("openings"),
    location: text("location"),
    level: text("level"),
    deadline: text("deadline"),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),

    workTerm: text("work_term"),
    jobType: text("job_type"),
    region: text("region"),
    address: text("address"),
    locationArrangement: text("location_arrangement"),
    workTermDuration: text("work_term_duration"),
    specialRequirements: text("special_requirements"),
    jobSummary: text("job_summary"),
    jobResponsibilities: text("job_responsibilities"),
    requiredSkills: text("required_skills"),
    compensation: text("compensation"),
    applicationDelivery: text("application_delivery"),
    applicationInfo: text("application_info"),
    serviceTeam: text("service_team"),

    parsedHourlyMin: real("parsed_hourly_min"),
    parsedHourlyMax: real("parsed_hourly_max"),
    employerRating: real("employer_rating"),
    employerRatingCount: integer("employer_rating_count"),
    totalHires: integer("total_hires"),

    rawDetail: jsonb("raw_detail"),
    workTermRatings: jsonb("work_term_ratings"),
    searchVector: text("search_vector"),

    aiSummary: text("ai_summary"),
    aiSummaryAt: timestamp("ai_summary_at", { withTimezone: true }),
    aiSkills: jsonb("ai_skills").$type<string[]>(),
    aiSkillsAt: timestamp("ai_skills_at", { withTimezone: true }),
    // Added by drizzle/0002_ai_details.sql.
    aiDetails: jsonb("ai_details").$type<PostingDetails>(),
    aiDetailsAt: timestamp("ai_details_at", { withTimezone: true }),
    // Added by drizzle/0004_line_check.sql: when the posting's lines were split
    // and tagged (job_lines).
    linesAt: timestamp("lines_at", { withTimezone: true }),

    importedAt: timestamp("imported_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    batchId: text("batch_id"),
  },
  (table) => [
    index("idx_jobs_job_id").on(table.jobId),
    index("idx_jobs_organization").on(table.organization),
    index("idx_jobs_deadline_at").on(table.deadlineAt),
    index("idx_jobs_level").on(table.level),
    index("idx_jobs_location").on(table.location),
  ]
);

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;

// Everyone who has signed in with Google (drizzle/0003_app_users.sql). Signing
// in proves who someone is; `status` is the owner's decision on whether they
// may see the postings.
export const USER_STATUSES = ["pending", "approved", "blocked"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const appUsers = pgTable("app_users", {
  email: text("email").primaryKey(),
  name: text("name"),
  image: text("image"),
  status: text("status").$type<UserStatus>().notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decidedBy: text("decided_by"),
});

export type AppUser = typeof appUsers.$inferSelect;

// Line-by-line matching (drizzle/0004_line_check.sql, lib/line-check).

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

export const jobLines = pgTable(
  "job_lines",
  {
    jobId: text("job_id").notNull(),
    lineNo: integer("line_no").notNull(),
    section: text("section").$type<LineSection>().notNull(),
    text: text("text").notNull(),
    kind: text("kind").$type<LineKind>().notNull(),
    importance: text("importance").$type<LineImportance>().notNull(),
    embedding: bytea("embedding"),
  },
  (table) => [primaryKey({ columns: [table.jobId, table.lineNo] })]
);

export const resumes = pgTable(
  "resumes",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    email: text("email").notNull(),
    label: text("label"),
    // One resume per student is in use: the one the site scores against and
    // checks in the background.
    active: boolean("active").notNull().default(true),
    text: text("text").notNull(),
    textHash: text("text_hash").notNull(),
    fileName: text("file_name"),
    profile: jsonb("profile"),
    userInfo: jsonb("user_info"),
    extraSkills: jsonb("extra_skills").$type<string[]>().notNull().default([]),
    skillLevels: jsonb("skill_levels").$type<Record<string, SkillLevel>>().notNull().default({}),
    version: integer("version").notNull().default(1),
    lines: jsonb("lines").$type<ResumeLine[]>().notNull().default([]),
    fullChecks: jsonb("full_checks").$type<{ day?: string; count?: number }>().notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_resumes_email").on(table.email)]
);

export type StoredResume = typeof resumes.$inferSelect;

export const lineGrades = pgTable(
  "line_grades",
  {
    resumeId: uuid("resume_id").notNull(),
    email: text("email").notNull(),
    jobId: text("job_id").notNull(),
    resumeVersion: integer("resume_version").notNull(),
    linesAt: timestamp("lines_at", { withTimezone: true }).notNull(),
    grades: jsonb("grades").$type<LineGrade[]>().notNull(),
    skills: real("skills").notNull(),
    staleLines: jsonb("stale_lines").$type<number[]>().notNull().default([]),
    gradedAt: timestamp("graded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.resumeId, table.jobId] }), index("idx_line_grades_email").on(table.email)]
);
