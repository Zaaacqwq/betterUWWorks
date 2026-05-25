interface RatingsSummary {
  headers: string[];
  rows: string[][];
}

interface HiringHistory {
  headers: string[];
  rows: string[][];
}

interface WorkTermRatings {
  ratingsSummary?: RatingsSummary | null;
  hiringHistory?: HiringHistory | null;
}

interface ExtractedRatings {
  employerRating: number | null;
  employerRatingCount: number | null;
  totalHires: number | null;
}

export function extractRatingsData(raw: unknown): ExtractedRatings {
  const result: ExtractedRatings = {
    employerRating: null,
    employerRatingCount: null,
    totalHires: null,
  };

  if (!raw || typeof raw !== "object") return result;
  const data = raw as WorkTermRatings;

  if (data.ratingsSummary?.rows?.length) {
    for (const row of data.ratingsSummary.rows) {
      if (row[0]?.includes("Organization") || row[0]?.includes("Division")) {
        const rating = parseFloat(row[2]);
        const count = parseInt(row[3], 10);
        if (!isNaN(rating) && rating > 0) {
          if (result.employerRating === null || row[0].includes("Division")) {
            result.employerRating = rating;
            result.employerRatingCount = isNaN(count) ? null : count;
          }
        }
      }
    }
  }

  if (data.hiringHistory?.rows?.length) {
    for (const row of data.hiringHistory.rows) {
      if (row[0]?.includes("Division") || row[0]?.includes("Organization")) {
        let total = 0;
        for (let i = 2; i < row.length; i++) {
          const n = parseInt(row[i], 10);
          if (!isNaN(n)) total += n;
        }
        if (total > 0 && (result.totalHires === null || row[0].includes("Division"))) {
          result.totalHires = total;
        }
      }
    }
  }

  return result;
}
