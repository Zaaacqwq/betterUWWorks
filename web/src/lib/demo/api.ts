import { inDemo } from "./mode";
import { demoAnswer } from "./server";

/**
 * Every call a page makes to /api goes through here: the real server, or the
 * demo answering for itself. The demo's answers are ordinary Responses, so a
 * caller reads them exactly as it reads the server's.
 */
export function api(input: string, init?: RequestInit): Promise<Response> {
  return inDemo() ? demoAnswer(input, init) : fetch(input, init);
}
