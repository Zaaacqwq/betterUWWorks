// The gateway rejects response_format json_schema outright, and in json_object
// mode glm-5.3-flash still wraps its answer in a ``` fence, so structured
// output has to be recovered from free text rather than requested.
export class AiJsonError extends Error {
  constructor(
    message: string,
    readonly raw: string
  ) {
    super(message);
    this.name = "AiJsonError";
  }
}

function stripFences(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : raw).trim();
}

/**
 * Parses a model's reply as JSON, keeping the offending text on the error so a
 * failure says what came back instead of only that something went wrong.
 */
export function parseAiJson<T = unknown>(raw: string, context: string): T {
  const cleaned = stripFences(raw);
  if (!cleaned) {
    throw new AiJsonError(`${context}: model returned nothing`, raw);
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    const reason = err instanceof Error ? err.message : "invalid JSON";
    throw new AiJsonError(`${context}: ${reason}`, cleaned.slice(0, 300));
  }
}
