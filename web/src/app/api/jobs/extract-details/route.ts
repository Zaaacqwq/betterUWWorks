import { handleExtractionRequest } from "@/lib/extraction/route";
import { detailExtractor } from "@/lib/job-details/run";

// Extracts one batch of postings still waiting for their pay and requirements.
export async function POST(request: Request) {
  return handleExtractionRequest(request, detailExtractor);
}
