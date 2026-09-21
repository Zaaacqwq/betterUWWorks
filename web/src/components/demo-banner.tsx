import { SparklesIcon } from "./icons";

// The strip above the demo. It says what the postings are before anyone reads
// a score off them, and keeps the way in one click away.

export function DemoBanner() {
  return (
    <div className="shrink-0 bg-primary-tint border-b border-primary-line">
      <div className="px-4 sm:px-5 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-primary-deep">
          <SparklesIcon className="w-3.5 h-3.5" />
          Demo
        </span>
        <p className="text-[12.5px] text-charcoal">
          Eight made-up postings, scored against a made-up resume. Everything works except the data — nothing you do
          here is kept.
        </p>
        {/* A plain link on purpose: the demo keeps its resume and its saved
            postings apart from a signed-in student's, and a fresh load is what
            keeps them apart. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          className="ml-auto h-7 flex items-center px-2.5 rounded-md bg-primary text-on-primary text-[12.5px] font-semibold hover:bg-primary-pressed transition-colors"
        >
          Sign in to use your own resume
        </a>
      </div>
    </div>
  );
}
