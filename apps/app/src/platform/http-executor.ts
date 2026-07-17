import type { HttpExecutor, TransportResponse } from "@manut/app-core";

function parseBody(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return { error: { code: "PARSE_ERROR", message: trimmed } };
  }
}

export const fetchExecutor: HttpExecutor = async (
  request,
): Promise<TransportResponse> => {
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    ...(request.credentials ? { credentials: request.credentials } : {}),
    ...(request.signal ? { signal: request.signal as AbortSignal } : {}),
    ...(request.body === undefined
      ? {}
      : { body: JSON.stringify(request.body) }),
  });
  return {
    status: response.status,
    body: parseBody(await response.text()),
  };
};
