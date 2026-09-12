"use client";

import type { WorkTermRatings, TableData } from "./types/job";

interface JobDetailRatingsProps {
  ratings: WorkTermRatings;
}

export function JobDetailRatings({ ratings }: JobDetailRatingsProps) {
  const hasData =
    ratings.hiringHistory != null ||
    ratings.ratingsSummary != null ||
    ratings.hiresByFaculty != null ||
    ratings.hiresByWorkTermNumber != null ||
    ratings.mostHiredPrograms != null ||
    (ratings.charts != null && ratings.charts.length > 0);

  if (!hasData) {
    return (
      <p className="text-sm text-stone text-center py-8">
        No work term ratings data available.
      </p>
    );
  }

  const satisfactionChart = ratings.charts?.find((c) => c.title.includes("Overall Work Term Satisfaction"));
  const ratingByQuestionChart = ratings.charts?.find((c) => c.title.includes("Average Rating by Question"));

  return (
    <div className="space-y-8">
      {ratings.ratingsSummary && (
        <RatingsSection title="Work Term Ratings Summary">
          <DataTable data={ratings.ratingsSummary} highlight={2} />
        </RatingsSection>
      )}

      {ratings.hiringHistory && (
        <RatingsSection title="Hiring History">
          <DataTable data={ratings.hiringHistory} />
        </RatingsSection>
      )}

      {(ratings.hiresByFaculty || ratings.hiresByWorkTermNumber) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {ratings.hiresByFaculty && Object.keys(ratings.hiresByFaculty).length > 0 && (
            <RatingsSection title="Hires by Faculty">
              <PieChart data={ratings.hiresByFaculty} />
            </RatingsSection>
          )}
          {ratings.hiresByWorkTermNumber && Object.keys(ratings.hiresByWorkTermNumber).length > 0 && (
            <RatingsSection title="Hires by Work Term Number">
              <PieChart data={ratings.hiresByWorkTermNumber} />
            </RatingsSection>
          )}
        </div>
      )}

      {ratings.mostHiredPrograms && ratings.mostHiredPrograms.length > 0 && (
        <RatingsSection title="Most Frequently Hired Programs">
          <HorizontalBars items={ratings.mostHiredPrograms} />
        </RatingsSection>
      )}

      {satisfactionChart && (
        <RatingsSection title={satisfactionChart.title}>
          <SatisfactionChart data={satisfactionChart.data} />
        </RatingsSection>
      )}

      {ratingByQuestionChart && (
        <RatingsSection title="Average Rating by Question (1–5 scale)">
          <RatingByQuestionChart data={ratingByQuestionChart.data} />
        </RatingsSection>
      )}
    </div>
  );
}

function RatingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[13.5px] font-semibold text-ink mb-3">{title}</h4>
      {children}
    </div>
  );
}

// --- Pie Chart ---

const PIE_HEX = Array.from({ length: 8 }, (_, i) => `var(--chart-${i + 1})`);

function PieChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return null;

  const slices: { offset: number; pct: number; color: string }[] = [];
  let cumulative = 0;
  entries.forEach(([, pct], i) => {
    slices.push({ offset: cumulative, pct, color: PIE_HEX[i % PIE_HEX.length] });
    cumulative += pct;
  });

  const gradientStops = slices.map((s) =>
    `${s.color} ${s.offset}% ${s.offset + s.pct}%`
  ).join(", ");

  return (
    <div className="flex items-center gap-5">
      <div
        className="w-28 h-28 rounded-full shrink-0"
        style={{ background: `conic-gradient(${gradientStops})` }}
      />
      <div className="space-y-1 min-w-0">
        {entries.map(([label, pct], i) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: PIE_HEX[i % PIE_HEX.length] }} />
            <span className="text-xs text-charcoal truncate">{label}</span>
            <span className="text-xs font-semibold text-slate ml-auto shrink-0">{pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Overall Work Term Satisfaction (grouped bar chart) ---

// Series arrive as division, organization, then (when present) the
// all-students average, which stays grey so it reads as the baseline.
const BAR_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--hairline-strong)"];
const BAR_HEIGHT_PX = 120;

function SatisfactionChart({ data }: { data: string[] }) {
  const parsed = parseSatisfactionData(data);
  if (!parsed) return <p className="text-xs text-stone">Unable to parse chart data.</p>;

  const maxVal = Math.max(...parsed.series.flatMap((s) => s.values), 1);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 mb-3">
        {parsed.series.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }} />
            <span className="text-[11px] text-slate truncate max-w-[200px]">{s.name}</span>
          </div>
        ))}
      </div>
      <div className="flex items-end gap-1" style={{ height: `${BAR_HEIGHT_PX + 40}px` }}>
        {parsed.labels.map((label, li) => (
          <div key={li} className="flex-1 flex flex-col items-center justify-end" style={{ height: "100%" }}>
            <div className="flex items-end gap-px justify-center w-full" style={{ height: `${BAR_HEIGHT_PX}px` }}>
              {parsed.series.map((s, si) => {
                const val = s.values[li] ?? 0;
                const h = maxVal > 0 ? Math.round((val / maxVal) * BAR_HEIGHT_PX) : 0;
                return (
                  <div key={si} className="flex flex-col items-center flex-1 max-w-[18px] self-end">
                    {val > 0 && (
                      <span className="text-[8px] font-semibold text-slate mb-0.5 whitespace-nowrap">{val}%</span>
                    )}
                    <div
                      className="w-full rounded-t-sm"
                      style={{
                        height: `${Math.max(h, val > 0 ? 2 : 0)}px`,
                        backgroundColor: BAR_COLORS[si % BAR_COLORS.length],
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <span className="text-[10px] text-stone font-medium mt-1">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function parseSatisfactionData(data: string[]): { labels: string[]; series: { name: string; values: number[] }[] } | null {
  const pctValues: number[] = [];
  let i = 0;
  while (i < data.length && data[i].endsWith("%")) {
    pctValues.push(parseFloat(data[i]));
    i++;
  }

  if (pctValues.length < 10) return null;

  const seriesNames: string[] = [];
  while (i < data.length && !/^\d+$/.test(data[i])) {
    seriesNames.push(data[i]);
    i++;
  }

  if (seriesNames.length === 0) return null;

  const perSeries = pctValues.length / seriesNames.length;
  if (!Number.isInteger(perSeries) || perSeries < 1) return null;

  const labels = Array.from({ length: perSeries }, (_, idx) => String(idx + 1));

  const series = seriesNames.map((name, si) => ({
    name,
    values: pctValues.slice(si * perSeries, (si + 1) * perSeries),
  }));

  return { labels, series };
}

// --- Average Rating by Question (grouped bar chart) ---

function RatingByQuestionChart({ data }: { data: string[] }) {
  const parsed = parseRatingByQuestionData(data);
  if (!parsed) return <p className="text-xs text-stone">Unable to parse chart data.</p>;

  const maxVal = Math.max(...parsed.series.flatMap((s) => s.values), 5);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        {parsed.series.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }} />
            <span className="text-[11px] text-slate truncate max-w-[200px]">{s.name}</span>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {parsed.questions.map((q, qi) => (
          <div key={qi}>
            <p className="text-[11px] text-slate mb-1 leading-tight">{q}</p>
            <div className="space-y-1">
              {parsed.series.map((s, si) => {
                const val = s.values[qi] ?? 0;
                const width = maxVal > 0 ? (val / maxVal) * 100 : 0;
                return (
                  <div key={si} className="flex items-center gap-2">
                    <div className="flex-1 h-4 bg-surface-soft border border-hairline-soft rounded overflow-hidden">
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${width}%`,
                          backgroundColor: BAR_COLORS[si % BAR_COLORS.length],
                        }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-charcoal w-6 text-right">{val.toFixed(1)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function parseRatingByQuestionData(data: string[]): { questions: string[]; series: { name: string; values: number[] }[] } | null {
  const numericValues: number[] = [];
  let i = 0;
  while (i < data.length && /^\d+(\.\d+)?$/.test(data[i])) {
    numericValues.push(parseFloat(data[i]));
    i++;
  }

  if (numericValues.length < 7) return null;

  const seriesNames: string[] = [];
  while (i < data.length && !data[i].startsWith("Q")) {
    seriesNames.push(data[i]);
    i++;
  }

  if (seriesNames.length === 0) return null;

  const questions: string[] = [];
  while (i < data.length && data[i].startsWith("Q")) {
    const raw = data[i];
    const match = raw.match(/^(Q\d+)\.\s*([\s\S]+?)(?:\1\.|$)/);
    if (match) {
      questions.push(`${match[1]}. ${match[2].trim()}`);
    } else {
      questions.push(raw);
    }
    i++;
  }

  if (questions.length === 0) return null;

  const numQuestions = questions.length;
  const numSeries = Math.min(seriesNames.length, Math.floor(numericValues.length / numQuestions));
  if (numSeries === 0) return null;

  const series = Array.from({ length: numSeries }, (_, si) => ({
    name: seriesNames[si],
    values: numericValues.slice(si * numQuestions, (si + 1) * numQuestions),
  }));

  return { questions, series };
}

// --- Shared components ---

function DataTable({ data, highlight }: { data: TableData; highlight?: number }) {
  return (
    <div className="overflow-x-auto -mx-6 px-6">
      <table className="w-full text-xs border-collapse">
        {data.headers.length > 0 && (
          <thead>
            <tr className="border-b border-hairline">
              {data.headers.map((h, i) => (
                <th key={i} className="text-left py-2 px-2 font-semibold text-slate whitespace-nowrap first:pl-0">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {data.rows.map((row, ri) => (
            <tr key={ri} className="border-b border-hairline-soft">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`py-2 px-2 first:pl-0 whitespace-nowrap ${
                    ci === 0
                      ? "font-medium text-charcoal"
                      : highlight !== undefined && ci === highlight
                        ? "font-bold text-primary"
                        : "text-slate"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HorizontalBars({ items }: { items: { program: string; hires: number }[] }) {
  const maxHires = Math.max(...items.map((p) => p.hires));
  return (
    <div className="space-y-2">
      {items.map((p) => (
        <div key={p.program} className="flex items-center gap-3">
          <span className="text-xs text-slate w-44 text-right shrink-0 truncate">{p.program}</span>
          <div className="flex-1 h-5 bg-surface-soft border border-hairline-soft rounded overflow-hidden">
            <div
              className="h-full bg-primary/70 rounded"
              style={{ width: `${Math.min(100, (p.hires / maxHires) * 100)}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-charcoal w-6 text-right">{p.hires}</span>
        </div>
      ))}
    </div>
  );
}
