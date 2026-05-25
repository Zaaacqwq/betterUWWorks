import { extractText } from "unpdf";
import mammoth from "mammoth";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return Response.json(
      { success: false, error: "No file provided" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return Response.json(
      { success: false, error: "File too large (max 5MB)" },
      { status: 400 }
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const buffer = Buffer.from(await file.arrayBuffer());

  let text: string;

  try {
    switch (ext) {
      case "pdf": {
        const result = await extractText(new Uint8Array(buffer), { mergePages: true });
        text = result.text;
        break;
      }
      case "docx":
      case "doc": {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
        break;
      }
      case "txt":
      case "md": {
        text = buffer.toString("utf-8");
        break;
      }
      default:
        return Response.json(
          { success: false, error: `Unsupported file type: .${ext}` },
          { status: 400 }
        );
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json(
      { success: false, error: `Failed to parse file: ${msg}` },
      { status: 422 }
    );
  }

  text = text.replace(/\n{3,}/g, "\n\n").trim();

  if (text.length < 50) {
    return Response.json(
      { success: false, error: "Could not extract enough text from file" },
      { status: 422 }
    );
  }

  return Response.json({
    success: true,
    data: { text, fileName: file.name },
  });
}
