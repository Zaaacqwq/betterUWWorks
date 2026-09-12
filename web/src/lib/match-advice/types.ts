// Advice on applying to one posting, for one student. What to lead with and
// how to handle gaps come from the model, each tied back to the student's own
// experience and the posting's checked skills; what to check first comes from
// the posting's checked requirements alone.

export interface AdviceHighlight {
  // As the student's resume names it: "Software Developer · Acme".
  experience: string;
  skills: string[];
  why: string;
}

export interface AdviceGap {
  skill: string;
  suggestion: string;
}

export interface ApplicationAdvice {
  highlights: AdviceHighlight[];
  gaps: AdviceGap[];
  // Eligibility the student should confirm before applying.
  checks: string[];
}
