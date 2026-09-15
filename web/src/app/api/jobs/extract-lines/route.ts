import { handleExtractionRequest } from "@/lib/extraction/route";
import { lineExtractor } from "@/lib/line-check/tag-run";

// Splits and tags one batch of postings still waiting for their lines.
export async function POST(request: Request) {
  return handleExtractionRequest(request, lineExtractor);
}
