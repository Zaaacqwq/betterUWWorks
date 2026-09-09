import { z } from "zod/v4";

const jobDetailSchema = z.record(z.string(), z.unknown()).nullish();

// The extension sends `null` for fields it could not scrape, so every optional
// field accepts null and normalizes it to the empty-ish default.
const optionalText = (fallback = "") =>
  z
    .string()
    .nullish()
    .transform((v) => v ?? fallback);

const jobItemSchema = z.object({
  jobId: z.string().min(1),
  title: z.string().min(1),
  organization: z.string().min(1),
  division: optionalText(),
  openings: z
    .union([z.number(), z.string()])
    .nullish()
    .transform((v) => {
      if (typeof v === "string") return parseInt(v, 10) || null;
      return v ?? null;
    }),
  location: optionalText(),
  level: optionalText(),
  deadline: optionalText(),
  detail: jobDetailSchema,
});

export const importPayloadSchema = z.object({
  jobs: z.array(jobItemSchema).min(1).max(5000),
  batchId: z.string().optional(),
});

export type ImportPayload = z.infer<typeof importPayloadSchema>;
export type JobItem = z.infer<typeof jobItemSchema>;
