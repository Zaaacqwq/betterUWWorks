import { describe, expect, it } from "vitest";
import { WW_JOBS_URL, postingUrl } from "./waterlooworks";

describe("postingUrl", () => {
  it("points at the co-op jobs page with the id in the hash the extension reads", () => {
    expect(postingUrl("488392")).toBe(`${WW_JOBS_URL}#buw-open=488392`);
  });

  it("keeps the id out of the query, which WaterlooWorks' server would see", () => {
    expect(new URL(postingUrl("488392")).search).toBe("");
  });

  it("escapes an id that isn't plain digits rather than breaking the URL", () => {
    expect(postingUrl("48 83#92")).toBe(`${WW_JOBS_URL}#buw-open=48%2083%2392`);
  });
});
