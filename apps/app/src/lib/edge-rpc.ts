import { hc } from "hono/client";
import { getAppUrl } from "./env";

/**
 * Hono RPC client for the Cloudflare Worker (`${getAppUrl()}/api`).
 * Keep this generic — do not import `@nexora/edge/rpc` here or Expo tsc pulls the Worker.
 * Edge tests type `hc<ApiType>` against the Worker route tree.
 */
export function createEdgeClient(baseUrl = `${getAppUrl()}/api`) {
  return hc(baseUrl.replace(/\/$/, ""));
}
