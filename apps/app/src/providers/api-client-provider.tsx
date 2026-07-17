import { type ApiClient } from "@manut/app-core";
import { createContext, type PropsWithChildren, use, useState } from "react";

import { getPlatformApiClient } from "@/platform/api-client";

const ApiClientContext = createContext<ApiClient | null>(null);

export function ApiClientProvider({ children }: PropsWithChildren) {
  const [client] = useState(getPlatformApiClient);
  return <ApiClientContext value={client}>{children}</ApiClientContext>;
}

export function useApiClient(): ApiClient {
  const client = use(ApiClientContext);
  if (!client) {
    throw new Error("useApiClient must be used inside ApiClientProvider");
  }
  return client;
}
