import { PDFDocument, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { Document, Paragraph, TextRun } from "docx";

// Turns a cover-letter draft into a file to attach: a PDF, or a Word document
// to keep editing. Built in the browser from the text on screen. Loaded only
// when a download is asked for (components/cover-letter.tsx), so the libraries
// stay out of the page's first load.

// US Letter, 1-inch margins: what a Canadian employer expects to print.
const PAGE = { width: 612, height: 792, margin: 72 };
const FONT_SIZE = 11.5;
const LEADING = 16;
const PARAGRAPH_GAP = 10;

/** Paragraphs split on blank lines; a paragraph keeps its own line breaks ("Sincerely,\nName"). */
export function letterParagraphs(text: string): string[][] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.split("\n").map((line) => line.trim()).filter(Boolean))
    .filter((p) => p.length > 0);
}

/** Breaks one line into lines no wider than maxWidth; a word too long for a line is cut. */
export function wrapLine(line: string, maxWidth: number, measure: (s: string) => number): string[] {
  const out: string[] = [];
  let current = "";
  for (const word of line.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) out.push(current);
    // A single word wider than the line (a long URL): cut it where it overflows.
    let rest = word;
    while (measure(rest) > maxWidth && rest.length > 1) {
      let cut = rest.length - 1;
      while (cut > 1 && measure(rest.slice(0, cut)) > maxWidth) cut--;
      out.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    current = rest;
  }
  if (current) out.push(current);
  return out;
}

/** "Cover Letter - Toyota - Co-op Analyst.pdf", safe on every file system. */
export function letterFileName(job: { organization: string; title: string }, ext: "pdf" | "docx"): string {
  const clean = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  const base = clean(`Cover Letter - ${job.organization} - ${job.title}`).slice(0, 120).trim();
  return `${base}.${ext}`;
}

export async function buildLetterPdf(text: string, fontBytes: ArrayBuffer | Uint8Array, title: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  // Embedded, so accents and dashes look the same on the reader's machine.
  const font: PDFFont = await pdf.embedFont(fontBytes, { subset: true });
  pdf.setTitle(title);
  pdf.setCreator("betterUWWorks");

  const width = PAGE.width - PAGE.margin * 2;
  const measure = (s: string) => font.widthOfTextAtSize(s, FONT_SIZE);
  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - PAGE.margin;

  letterParagraphs(text).forEach((paragraph, i) => {
    if (i > 0) y -= PARAGRAPH_GAP;
    for (const line of paragraph.flatMap((l) => wrapLine(l, width, measure))) {
      if (y - LEADING < PAGE.margin) {
        page = pdf.addPage([PAGE.width, PAGE.height]);
        y = PAGE.height - PAGE.margin;
      }
      y -= LEADING;
      page.drawText(line, { x: PAGE.margin, y, size: FONT_SIZE, font });
    }
  });

  return pdf.save();
}

export function buildLetterDocx(text: string, title: string): Document {
  return new Document({
    title,
    creator: "betterUWWorks",
    styles: {
      default: {
        // Sizes in half-points: 23 is 11.5pt.
        document: { run: { font: "Times New Roman", size: 23 } },
      },
    },
    sections: [
      {
        // Twips: 1440 is one inch.
        properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        children: letterParagraphs(text).map(
          (lines) =>
            new Paragraph({
              spacing: { after: 200, line: 300 },
              children: lines.map((line, i) => new TextRun({ text: line, break: i > 0 ? 1 : 0 })),
            })
        ),
      },
    ],
  });
}
