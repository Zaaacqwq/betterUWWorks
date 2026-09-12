import type { ListedDetails, ListedRequirement, PostingDetails, RequirementKind } from "./types";

// The job list sends every posting at once so it can be scored against the
// resume in the browser, and the sentences the details were read from are most
// of their size. The list shows and scores postings without them, except for a
// program requirement: whether the student's program is named is read from its
// sentence (programFit in lib/resume/requirement-checks.ts).

const QUOTE_KEPT: RequirementKind[] = ["program"];

function withoutQuote<T extends { quote?: string }>({ quote: _quote, ...rest }: T): Omit<T, "quote"> {
  void _quote;
  return rest;
}

export function listedDetails(details: PostingDetails | null): ListedDetails | null {
  if (!details) return null;
  return {
    pay: details.pay ? withoutQuote(details.pay) : null,
    requirements: (details.requirements ?? []).map(
      (r): ListedRequirement => (QUOTE_KEPT.includes(r.kind) ? r : withoutQuote(r))
    ),
  };
}
