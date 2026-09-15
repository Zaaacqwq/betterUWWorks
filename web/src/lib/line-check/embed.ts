// Vectors from the embedding model Ollama serves on the Mac mini. They only
// find which posting lines a change to a student's skills could touch
// (affected.ts); scores never depend on them, so when Ollama is away the
// checks go on and that search falls back to matching words.

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
export const EMBED_MODEL = process.env.EMBED_MODEL ?? "qwen3-embedding:8b";
// The model's vectors cut down to their first 512 numbers (it is trained so
// they still work): a quarter of the storage, with little lost for this.
export const EMBED_DIMS = 512;
const TIMEOUT_MS = 120_000;

// Posting lines are the queries and resume lines the documents; the model is
// told what it is searching for on the query side only.
const QUERY_INSTRUCTION =
  "Instruct: Given a job requirement, retrieve resume passages showing the candidate meets it\nQuery: ";

export class EmbedError extends Error {}

async function embed(inputs: string[]): Promise<Float32Array[]> {
  if (inputs.length === 0) return [];
  let res: Response;
  try {
    res = await fetch(`${OLLAMA_URL}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBED_MODEL, input: inputs, dimensions: EMBED_DIMS, truncate: true }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new EmbedError(`embedding model unreachable at ${OLLAMA_URL}: ${err instanceof Error ? err.message : err}`);
  }
  if (!res.ok) throw new EmbedError(`embedding model answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { embeddings?: number[][] };
  if (!Array.isArray(body.embeddings) || body.embeddings.length !== inputs.length) {
    throw new EmbedError("embedding model returned the wrong number of vectors");
  }
  return body.embeddings.map((v) => normalize(Float32Array.from(v)));
}

function normalize(v: Float32Array): Float32Array {
  let sum = 0;
  for (const x of v) sum += x * x;
  const norm = Math.sqrt(sum) || 1;
  return v.map((x) => x / norm);
}

export function embedPostingLines(texts: string[]): Promise<Float32Array[]> {
  return embed(texts.map((t) => QUERY_INSTRUCTION + t));
}

export function embedResumeLines(texts: string[]): Promise<Float32Array[]> {
  return embed(texts);
}

// Unit vectors, so the dot product is the cosine similarity.
export function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

export function toBytes(v: Float32Array): Buffer {
  return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
}

export function fromBytes(b: Buffer): Float32Array {
  // Copied out: a Buffer from the driver may sit at an offset Float32Array
  // can't start at.
  const copy = new Uint8Array(b.byteLength);
  copy.set(b);
  return new Float32Array(copy.buffer);
}
