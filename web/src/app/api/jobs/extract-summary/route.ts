import { handleExtractionRequest } from "@/lib/extraction/route";
import { summaryExtractor } from "@/lib/job-summary/run";

// Summarizes one batch of postings still waiting for their one-line summary.
export async function POST(request: Request) {
  return handleExtractionRequest(request, summaryExtractor);
}
