import type { AriaAiEnv } from "./aria-ai.js";

/** Placeholder runtime — replace with provider wiring when keys are present. */
export async function streamChat(_input: unknown, _env: AriaAiEnv): Promise<Response> {
  return new Response(JSON.stringify({ error: { code: "NOT_IMPLEMENTED", message: "AI runtime not wired on edge" } }), {
    status: 501,
    headers: { "Content-Type": "application/json" },
  });
}
