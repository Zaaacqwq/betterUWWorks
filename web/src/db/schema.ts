import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  real,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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
