import { handleExtractionRequest } from "@/lib/extraction/route";
import { skillExtractor } from "@/lib/job-skills/run";

// Extracts one batch of postings still waiting for their skills.
export async function POST(request: Request) {
  return handleExtractionRequest(request, skillExtractor);
}
