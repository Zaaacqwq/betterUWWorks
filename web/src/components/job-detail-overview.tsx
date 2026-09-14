"use client";

import { useState } from "react";
import type { JobDetail } from "./types/job";
import { PostingGlance } from "./posting-glance";
import { deadlineInfo, TONE_TEXT } from "@/lib/format";
import { buildOverview, type OverviewGroup, type OverviewRow, type OverviewSection } from "@/lib/job-overview";

// The posting, sorted: the checked summary first, then its facts in four
// groups (the role, the term, where, how to apply), then the employer's own
// words. lib/job-overview.ts decides what goes where.

// A long list (every targeted program, say) shows this many lines at first.
const ROW_LINES_SHOWN = 6;

export function JobDetailOverview({ job }: { job: JobDetail }) {
  const deadline = deadlineInfo(job.deadlineAt);
  const { groups, sections, more } = buildOverview(
    job,
    deadline ? { away: deadline.closed ? undefined : deadline.away, valueClass: `${TONE_TEXT[deadline.tone]} font-medium` } : {}
  );

  return (
    <div className="space-y-7">
      <PostingGlance job={job} />

      {groups.length > 0 && (
        // Two groups a row once the detail pane has room, whatever the window.
        <div className="@container">
          <div className="grid grid-cols-1 @2xl:grid-cols-2 gap-x-8 gap-y-6">
            {groups.map((group) => (
              <FactGroup key={group.id} group={group} />
            ))}
          </div>
        </div>
      )}

      {sections.length > 0 && (
        <div className="space-y-5 pt-6 border-t border-hairline-soft">
          {sections.map((section) => (
            <TextSection key={section.title} section={section} />
          ))}
        </div>
      )}

      {more.length > 0 && (
        <div className="space-y-5 pt-6 border-t border-hairline-soft">
          <GroupTitle>More from the posting</GroupTitle>
          {more.map((section) => (
            <TextSection key={section.title} section={section} />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupTitle({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h3 id={id} className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-steel">
      {children}
    </h3>
  );
}

function FactGroup({ group }: { group: OverviewGroup }) {
  const titleId = `facts-${group.id}`;
  return (
    <section aria-labelledby={titleId} className="min-w-0 space-y-1.5">
      <GroupTitle id={titleId}>{group.title}</GroupTitle>
      <dl className="divide-y divide-hairline-soft border-y border-hairline-soft">
        {group.rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[104px_minmax(0,1fr)] gap-3 py-2">
            <dt className="text-[12.5px] text-steel">{r.label}</dt>
            <dd className={`text-[13px] break-words ${r.valueClass ?? "text-ink"}`}>
              <RowValue row={r} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function RowValue({ row }: { row: OverviewRow }) {
  const [expanded, setExpanded] = useState(false);
  if (isUrl(row.value)) {
    return (
      <a href={row.value} target="_blank" rel="noopener noreferrer" className="text-link-blue hover:underline break-all">
        {row.value}
      </a>
    );
  }
  if (!row.multiline) return <Linkified text={row.value} />;

  const lines = row.value.split("\n").map((l) => l.trim()).filter(Boolean);
  const hidden = lines.length - ROW_LINES_SHOWN;
  const shown = expanded || hidden <= 0 ? lines : lines.slice(0, ROW_LINES_SHOWN);
  return (
    <>
      <span className="whitespace-pre-line">
        <Linkified text={shown.join("\n")} />
      </span>
      {hidden > 0 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="block mt-1 text-[12.5px] text-steel hover:text-ink transition-colors"
        >
          {expanded ? "Show less" : `Show all ${lines.length}`}
        </button>
      )}
    </>
  );
}

function TextSection({ section }: { section: OverviewSection }) {
  const { title, content } = section;
  if (isUrl(content)) {
    return (
      <div>
        <h4 className="text-[13.5px] font-semibold text-ink mb-1.5">{title}</h4>
        <a href={content} target="_blank" rel="noopener noreferrer" className="text-[13.5px] text-link-blue hover:underline break-all">
          {content}
        </a>
      </div>
    );
  }

  const lines = parseBulletPoints(content);

  return (
    <div>
      <h4 className="text-[13.5px] font-semibold text-ink mb-1.5">{title}</h4>
      {lines.length > 1 ? (
        <ul className="space-y-1 ml-4 max-w-[72ch]">
          {lines.map((line, i) => (
            <li key={i} className="text-[13.5px] text-charcoal leading-relaxed list-disc marker:text-stone">
              <Linkified text={line} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13.5px] text-charcoal leading-relaxed whitespace-pre-line max-w-[72ch]">
          <Linkified text={content} />
        </p>
      )}
    </div>
  );
}

// Links inside the posting's text ("apply at https://…") made clickable. A
// trailing full stop or bracket is the sentence's, not the link's.
const URL_IN_TEXT = /(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]])/g;

function Linkified({ text }: { text: string }) {
  const parts = text.split(URL_IN_TEXT);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-link-blue hover:underline break-all">
            {part}
          </a>
        ) : (
          part
        )
      )}
    </>
  );
}

function parseBulletPoints(text: string): string[] {
  const lines = text
    .split(/\n/)
    .map((l) => l.replace(/^[\s]*[-•*]\s*/, "").trim())
    .filter(Boolean);
  if (lines.length <= 1) return [text.trim()];
  return lines;
}

function isUrl(text: string): boolean {
  return /^https?:\/\/\S+$/.test(text.trim());
}
