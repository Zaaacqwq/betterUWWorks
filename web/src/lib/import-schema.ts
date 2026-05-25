import { z } from "zod/v4";

const jobDetailSchema = z.record(z.string(), z.unknown()).optional();

const jobItemSchema = z.object({
  jobId: z.string().min(1),
  title: z.string().min(1),
  organization: z.string().min(1),
  division: z.string().optional().default(""),
  openings: z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === "string" ? parseInt(v, 10) || null : v))
    .optional(),
  location: z.string().optional().default(""),
  level: z.string().optional().default(""),
  deadline: z.string().optional().default(""),
  detail: jobDetailSchema,
});

export const importPayloadSchema = z.object({
  jobs: z.array(jobItemSchema).min(1).max(5000),
  batchId: z.string().optional(),
});

export type ImportPayload = z.infer<typeof importPayloadSchema>;
export type JobItem = z.infer<typeof jobItemSchema>;
