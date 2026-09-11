import { generateText } from "ai";
import { models, FAST_OPTIONS } from "@/lib/ai/provider";
import { JOB_DETAILS_SYSTEM, jobDetailsPrompt } from "@/lib/ai/prompts";
import { AiJsonError, parseAiJson } from "@/lib/ai/json";
import { buildDetailSource, type DetailSource } from "./source";
import { verifyPay } from "./verify-pay";
import { mergeRequirements, verifyRequirements } from "./verify-requirements";
import type { PayInfo, PostingDetails } from "./types";

export interface PostingForDetails {
  jobId: string;
  title: string;
  location: string | null;
  rawDetail: unknown;
}

export interface DetailReading {
  details: PostingDetails;
  // What verification dropped, for checking extractions by hand.
  notes: string[];
}

// Two separate readings, and a third only when they disagree about pay. On 40
// postings two readings agreed on pay 39 times. Requirements are pooled across
// readings, since each was already checked against the posting's own sentence.
export const DETAIL_READINGS = 2;
const TIEBREAK_READINGS = 1;

// Now and then the model answers in broken JSON; asking again almost always
// gets a clean answer.
const ATTEMPTS = 2;

export async function readDetails(jobId: string, source: DetailSource): Promise<DetailReading> {
  for (let attempt = 1; ; attempt++) {
    const { text } = await generateText({
      model: models.fast,
      providerOptions: FAST_OPTIONS,
      system: JOB_DETAILS_SYSTEM,
      prompt: jobDetailsPrompt(source.text),
    });
    try {
      const parsed = parseAiJson(text, `job ${jobId}`);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new AiJsonError(`job ${jobId}: expected an object with pay and requirements`, text.slice(0, 300));
      }
      const reply = parsed as Record<string, unknown>;
      const pay = verifyPay(reply.pay, { source: source.text, country: source.country });
      const requirements = verifyRequirements(reply.requirements, source.text);
      return {
        details: { pay: pay.pay, requirements: requirements.requirements },
        notes: [...pay.notes, ...requirements.notes],
      };
    } catch (err) {
      if (!(err instanceof AiJsonError) || attempt >= ATTEMPTS) throw err;
    }
  }
}

const NO_FIGURES = "none";

function payFigures(pay: PayInfo | null): string {
  if (!pay?.stated) return NO_FIGURES;
  const { currency, period, min, max, byTerm, hoursPerWeek } = pay;
  return JSON.stringify({ currency, period, min, max, byTerm, hoursPerWeek });
}

// Pay at least two readings agree on — including agreeing that the posting
// gives no figure. A reading that alone found figures the others didn't, say a
// bonus taken for pay, is outvoted. With no majority there is no agreement:
// "unsettled" while a tiebreaking reading can still be had, otherwise the
// figures are kept for what they are but get no hourly rate to filter by.
export function agreedPay(pays: (PayInfo | null)[]): { pay: PayInfo | null; settled: boolean } {
  const votes = new Map<string, number>();
  for (const pay of pays) votes.set(payFigures(pay), (votes.get(payFigures(pay)) ?? 0) + 1);
  const winner = [...votes.entries()].find(([, count]) => count >= 2)?.[0];

  if (winner === NO_FIGURES) return { pay: pays.find((p) => p !== null && !p.stated) ?? null, settled: true };
  if (winner) return { pay: pays.find((p) => payFigures(p) === winner) ?? null, settled: true };
  if (pays.length < DETAIL_READINGS + TIEBREAK_READINGS) return { pay: null, settled: false };

  const first = pays.find((p) => p?.stated) ?? null;
  return { pay: first && { ...first, hourlyCad: null }, settled: true };
}

export function mergeDetailReadings(readings: DetailReading[]): DetailReading {
  return {
    details: {
      pay: agreedPay(readings.map((r) => r.details.pay)).pay,
      requirements: mergeRequirements(readings.map((r) => r.details.requirements)),
    },
    notes: readings.flatMap((r) => r.notes),
  };
}

async function readAll(jobId: string, source: DetailSource, count: number): Promise<DetailReading[]> {
  const settled = await Promise.allSettled(Array.from({ length: count }, () => readDetails(jobId, source)));
  // With a reading lost there is nothing to check the pay against, so it
  // counts as a failure and the posting is tried again later.
  const failure = settled.find((s) => s.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
  return settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
}

export type DetailExtraction = { kind: "extracted"; reading: DetailReading } | { kind: "no-source" };

export async function extractPostingDetails(job: PostingForDetails): Promise<DetailExtraction> {
  const source = buildDetailSource(job);
  if (!source) return { kind: "no-source" };

  const readings = await readAll(job.jobId, source, DETAIL_READINGS);
  if (!agreedPay(readings.map((r) => r.details.pay)).settled) {
    readings.push(...(await readAll(job.jobId, source, TIEBREAK_READINGS)));
  }
  return { kind: "extracted", reading: mergeDetailReadings(readings) };
}
