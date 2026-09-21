import type { Metadata } from "next";
import { JobListPage } from "@/components/job-list-page";

// The site as a stranger can see it: the same list, the same detail panel and
// the same scoring, over sample postings and a sample resume that the page
// answers for itself in the browser (src/lib/demo). Nothing here reaches the
// database, so it needs no sign-in and no approval.

export const metadata: Metadata = {
  title: "betterUWWorks demo",
  description: "Sample co-op postings, scored against a sample resume line by line.",
};

export default function DemoPage() {
  return <JobListPage demo />;
}
