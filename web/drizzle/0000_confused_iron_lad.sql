CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" text NOT NULL,
	"title" text NOT NULL,
	"organization" text NOT NULL,
	"division" text,
	"openings" integer,
	"location" text,
	"level" text,
	"deadline" text,
	"deadline_at" timestamp with time zone,
	"work_term" text,
	"job_type" text,
	"region" text,
	"address" text,
	"location_arrangement" text,
	"work_term_duration" text,
	"special_requirements" text,
	"job_summary" text,
	"job_responsibilities" text,
	"required_skills" text,
	"compensation" text,
	"application_delivery" text,
	"application_info" text,
	"service_team" text,
	"raw_detail" jsonb,
	"search_vector" text,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"batch_id" text,
	CONSTRAINT "jobs_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE INDEX "idx_jobs_job_id" ON "jobs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_jobs_organization" ON "jobs" USING btree ("organization");--> statement-breakpoint
CREATE INDEX "idx_jobs_deadline_at" ON "jobs" USING btree ("deadline_at");--> statement-breakpoint
CREATE INDEX "idx_jobs_level" ON "jobs" USING btree ("level");--> statement-breakpoint
CREATE INDEX "idx_jobs_location" ON "jobs" USING btree ("location");