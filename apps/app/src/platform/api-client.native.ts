import { ApiClient, type SessionTransport } from "@manut/app-core";

import { getApiBaseUrl } from "./api-config";
import { fetchExecutor } from "./http-executor";
import { createSessionTransport } from "./session-transport.native";

interface PlatformApiRuntime {
  client: ApiClient;
  session: SessionTransport;
}

let runtime: PlatformApiRuntime | null = null;

function getPlatformApiRuntime(): PlatformApiRuntime {
  if (runtime) return runtime;
  const baseUrl = getApiBaseUrl();
  const session = createSessionTransport(baseUrl);
  runtime = {
    session,
    client: new ApiClient({
      baseUrl,
      execute: fetchExecutor,
      session,
    }),
  };
  return runtime;
}

export function getPlatformApiClient(): ApiClient {
  return getPlatformApiRuntime().client;
}

export function getPlatformSessionTransport(): SessionTransport {
  return getPlatformApiRuntime().session;
}
