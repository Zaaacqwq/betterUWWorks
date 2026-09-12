import { describe, expect, it } from "vitest";
import { mergeVendorVariants } from "./vendor";

describe("mergeVendorVariants", () => {
  it("keeps one name for a product named with and without its maker", () => {
    expect(mergeVendorVariants(["Python", "SQS", "Amazon SQS", "React"])).toEqual(["Python", "Amazon SQS", "React"]);
    expect(mergeVendorVariants(["AWS Bedrock", "Bedrock", "Amazon Bedrock"])).toEqual(["AWS Bedrock"]);
    expect(mergeVendorVariants(["Microsoft Teams", "Teams"])).toEqual(["Microsoft Teams"]);
  });

  it("does not merge a field with a product named after it", () => {
    expect(mergeVendorVariants(["Analytics", "Google Analytics"])).toEqual(["Analytics", "Google Analytics"]);
    expect(mergeVendorVariants(["Machine Learning", "Azure Machine Learning"])).toEqual([
      "Machine Learning",
      "Azure Machine Learning",
    ]);
    expect(mergeVendorVariants(["Cloud", "Google Cloud"])).toEqual(["Cloud", "Google Cloud"]);
  });

  it("leaves different products alone", () => {
    expect(mergeVendorVariants(["AWS", "AWS Lambda", "Amazon S3"])).toEqual(["AWS", "AWS Lambda", "Amazon S3"]);
  });
});
