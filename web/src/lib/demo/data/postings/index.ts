import type { SamplePosting } from "../posting";
import { EMBEDDED_POSTINGS } from "./embedded";
import { SOFTWARE_POSTINGS } from "./software";
import { DATA_POSTINGS } from "./data";

// The demo's postings: made up, written the way WaterlooWorks postings read,
// and already checked line by line against the demo resume — except two, left
// unchecked on purpose so the list also shows the ~estimate a posting carries
// until the checking reaches it.

export const DEMO_POSTINGS: SamplePosting[] = [...EMBEDDED_POSTINGS, ...SOFTWARE_POSTINGS, ...DATA_POSTINGS];
