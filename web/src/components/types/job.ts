import type { ListedDetails, PostingDetails } from "@/lib/job-details/types";

export interface TableData {
  headers: string[];
  rows: string[][];
}

export interface ChartData {
  title: string;
  data: string[];
}

export interface WorkTermRatings {
  hiringHistory?: TableData | null;
  ratingsSummary?: TableData | null;
  hiresByFaculty?: Record<string, number> | null;
  hiresByWorkTermNumber?: Record<string, number> | null;
  mostHiredPrograms?: { program: string; hires: number }[] | null;
  charts?: ChartData[];
}

export interface JobSummary {
  jobId: string;
  title: string;
  organization: string;
  division: string | null;
  location: string | null;
  level: string | null;
  deadline: string | null;
  deadlineAt: string | null;
  openings: number | null;
  jobType: string | null;
  workTerm: string | null;
  locationArrangement: string | null;
  workTermDuration: string | null;
  parsedHourlyMin: number | null;
  parsedHourlyMax: number | null;
  employerRating: number | null;
  employerRatingCount: number | null;
  totalHires: number | null;
  aiSkills: string[] | null;
  // Without most of the posting's sentences; see lib/job-details/listed.ts.
  aiDetails: ListedDetails | null;
  hiresByWorkTermNumber: Record<string, number> | null;
}

export interface JobDetail {
  jobId: string;
  title: string;
  organization: string;
  division: string | null;
  location: string | null;
  level: string | null;
  deadline: string | null;
  deadlineAt: string | null;
  openings: number | null;
  workTerm: string | null;
  jobType: string | null;
  region: string | null;
  address: string | null;
  locationArrangement: string | null;
  workTermDuration: string | null;
  specialRequirements: string | null;
  jobSummary: string | null;
  jobResponsibilities: string | null;
  requiredSkills: string | null;
  compensation: string | null;
  applicationDelivery: string | null;
  applicationInfo: string | null;
  parsedHourlyMin: number | null;
  parsedHourlyMax: number | null;
  employerRating: number | null;
  employerRatingCount: number | null;
  totalHires: number | null;
  serviceTeam: string | null;
  rawDetail: Record<string, unknown> | null;
  workTermRatings: WorkTermRatings | null;
  // Read out of the posting by the model and checked against it; null until
  // the posting has been read. An empty summary means there was nothing to sum up.
  aiSummary: string | null;
  aiSkills: string[] | null;
  aiDetails: PostingDetails | null;
  aiSkillsAt: string | null;
  aiDetailsAt: string | null;
}

export interface Filters {
  location: string;
  level: string;
  arrangement: string;
  duration: string;
  workTerm: string;
  jobType: string;
  minPay: string;
  minRating: string;
  // Requirement kinds to hide postings for, comma-separated.
  hideRequirement: string;
  // "1" to bring back postings that have closed or left the board.
  closed: string;
  sort: string;
  order: "asc" | "desc";
}

export interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
