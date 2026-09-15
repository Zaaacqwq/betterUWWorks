import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { Packer } from "docx";
import { buildLetterDocx, buildLetterPdf, letterFileName, letterParagraphs, wrapLine } from "./cover-letter-export";

const LETTER = `Dear Hiring Manager,

I am applying for the Co-op Analyst role for Winter 2027 — my résumé shows the fit.

Thank you for your time.

Sincerely,
Jane Doe`;

const font = readFileSync(join(__dirname, "../../public/fonts/Tinos-Regular.ttf"));
// One unit a character: easy to reason about in the wrapping tests.
const byChars = (s: string) => s.length;

describe("letterParagraphs", () => {
  it("splits on blank lines and keeps a paragraph's own line breaks", () => {
    expect(letterParagraphs(LETTER)).toEqual([
      ["Dear Hiring Manager,"],
      ["I am applying for the Co-op Analyst role for Winter 2027 — my résumé shows the fit."],
      ["Thank you for your time."],
      ["Sincerely,", "Jane Doe"],
    ]);
  });

  it("tolerates Windows line endings and stray blank space", () => {
    expect(letterParagraphs("Hi,\r\n\r\n  \r\nBye\r\n")).toEqual([["Hi,"], ["Bye"]]);
  });
});

describe("wrapLine", () => {
  it("fills each line as far as the width allows", () => {
    expect(wrapLine("one two three four", 9, byChars)).toEqual(["one two", "three", "four"]);
  });

  it("cuts a word too long for any line", () => {
    expect(wrapLine("https://example.com/a-very-long-path", 12, byChars)).toEqual([
      "https://exam",
      "ple.com/a-ve",
      "ry-long-path",
    ]);
  });
});

describe("letterFileName", () => {
  it("names the file after the posting, without characters file systems refuse", () => {
    expect(letterFileName({ organization: "Toyota / TMMC", title: 'Analyst: "Facilities"' }, "pdf")).toBe(
      "Cover Letter - Toyota TMMC - Analyst Facilities.pdf"
    );
  });
});

describe("buildLetterPdf", () => {
  it("makes a one-page PDF with the font embedded", async () => {
    const bytes = await buildLetterPdf(LETTER, font, "Cover letter");
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("Cover letter");
  });

  it("runs onto another page when the letter is long", async () => {
    const long = Array.from({ length: 30 }, (_, i) => `Paragraph ${i} ${"word ".repeat(40)}`).join("\n\n");
    const doc = await PDFDocument.load(await buildLetterPdf(long, font, "Long"));
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });
});

describe("buildLetterDocx", () => {
  it("makes a Word document holding the letter's text", async () => {
    const buffer = await Packer.toBuffer(buildLetterDocx(LETTER, "Cover letter"));
    expect(buffer.subarray(0, 2).toString()).toBe("PK"); // a .docx is a zip
    expect(buffer.length).toBeGreaterThan(1000);
  });
});
