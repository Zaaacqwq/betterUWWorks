import { containsMention, foldText } from "@/lib/job-skills/verify";
import { containsNumber, numbersIn } from "@/lib/job-details/numbers";

// A summary is a rewording, so it can't be checked word for word the way a
// skill or a figure can. What can be checked: that it is short, that the
// sentences it says it rests on are all really in the posting, and that it
// states no number those sentences don't — a made-up team size, pay or date.

export const MAX_SUMMARY_WORDS = 60;

export type SummaryVerdict = { summary: string } | { rejected: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function verifySummary(raw: unknown, source: string, title = ""): SummaryVerdict {
  const record = asRecord(raw);
  if (!record) return { rejected: "not an object" };

  const summary = typeof record.summary === "string" ? record.summary.replace(/\s+/g, " ").trim() : "";
  if (!summary) return { rejected: "empty summary" };
  if (summary.split(" ").length > MAX_SUMMARY_WORDS) return { rejected: "summary too long" };

  const folded = foldText(source);
  const basis = Array.isArray(record.basis)
    ? record.basis.filter((b): b is string => typeof b === "string").map((b) => b.trim()).filter(Boolean)
    : [];
  if (basis.length === 0) return { rejected: "no sentences given to rest on" };
  const madeUp = basis.find((sentence) => !containsMention(folded, sentence));
  if (madeUp !== undefined) return { rejected: `rests on a sentence not in the posting: ${madeUp.slice(0, 60)}` };

  // Any number has to come from the sentences it rests on, or the job title
  // ("CS 106 Instructional Support"), so a pay figure elsewhere in the posting
  // can't turn into "a team of 3,500".
  const cited = numbersIn(`${basis.join(" ")} ${title}`);
  const invented = [...numbersIn(summary)].find((n) => !containsNumber(cited, n));
  if (invented !== undefined) return { rejected: `states ${invented}, which the sentences it rests on don't` };

  return { summary };
}
