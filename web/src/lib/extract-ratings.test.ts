import { describe, expect, it } from "vitest";
import { extractRatingsData } from "./extract-ratings";

// The shape WaterlooWorks' "Work Term Ratings" charts come in, as scraped.
const charts = {
  ratingsSummary: {
    headers: ["", "Work Term Ratings - Fall 2023 to Spring 2026", "Average Work Term Satisfaction Rating", "Number Of Ratings"],
    rows: [
      ["Employer Organization", "Acme", "8.6", "120"],
      ["Employer Division", "Acme - Divisional Office", "9.0", "43"],
      ["All Co-op Students Average", "Average Work Term Satisfaction - All Co-op Students", "8.5", "45728"],
    ],
  },
  hiringHistory: {
    headers: ["", "Students Hired", "2023 - Fall", "2024 - Winter", "2024 - Spring"],
    rows: [
      ["Employer Organization", "Acme", "20", "15", "10"],
      ["Employer Division", "Acme - Divisional Office", "14", "13", "0"],
    ],
  },
};

describe("extractRatingsData", () => {
  it("prefers the division's rating and hires over the whole organization's", () => {
    expect(extractRatingsData(charts)).toEqual({
      employerRating: 9,
      employerRatingCount: 43,
      totalHires: 27,
    });
  });

  it("never takes the all-students average as the employer's rating", () => {
    const onlyAverage = {
      ratingsSummary: { headers: [], rows: [charts.ratingsSummary.rows[2]] },
    };
    expect(extractRatingsData(onlyAverage).employerRating).toBeNull();
  });

  it("falls back to the organization when there is no division row", () => {
    const orgOnly = {
      ratingsSummary: { headers: [], rows: [charts.ratingsSummary.rows[0]] },
      hiringHistory: { headers: [], rows: [charts.hiringHistory.rows[0]] },
    };
    expect(extractRatingsData(orgOnly)).toEqual({ employerRating: 8.6, employerRatingCount: 120, totalHires: 45 });
  });

  it("returns nothing for a posting without charts", () => {
    expect(extractRatingsData(null)).toEqual({ employerRating: null, employerRatingCount: null, totalHires: null });
    expect(extractRatingsData({ ratingsSummary: null })).toEqual({
      employerRating: null,
      employerRatingCount: null,
      totalHires: null,
    });
  });
});
