import { skillExtractor } from "@/lib/job-skills/run";
import { detailExtractor } from "@/lib/job-details/run";
import { summaryExtractor } from "@/lib/job-summary/run";
import type { Extractor } from "./runner";

// Every kind of reading done on a posting, in the order they're shown.
export const EXTRACTIONS: { kind: string; label: string; extractor: Extractor<{ jobId: string }> }[] = [
  { kind: "skills", label: "Skills", extractor: skillExtractor as Extractor<{ jobId: string }> },
  { kind: "details", label: "Pay & requirements", extractor: detailExtractor as Extractor<{ jobId: string }> },
  { kind: "summary", label: "Summaries", extractor: summaryExtractor as Extractor<{ jobId: string }> },
];
