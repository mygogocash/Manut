export class HttpError extends Error {
  constructor(
    readonly status:
      400 | 401 | 403 | 404 | 409 | 413 | 422 | 429 | 500 | 501 | 502 | 503,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export async function readBoundedJson(
  request: Request,
  maximumBytes = 16 * 1024,
): Promise<unknown> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength) {
    const parsedLength = Number(declaredLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength > maximumBytes) {
      throw new HttpError(
        413,
        "PAYLOAD_TOO_LARGE",
        "Request body is too large.",
      );
    }
  }

  if (!request.body) {
    throw new HttpError(
      400,
      "MISSING_BODY",
      "A JSON request body is required.",
    );
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const result = await reader.read();
    if (result.done) break;

    total += result.value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel("payload too large");
      throw new HttpError(
        413,
        "PAYLOAD_TOO_LARGE",
        "Request body is too large.",
      );
    }
    chunks.push(result.value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new HttpError(
      400,
      "INVALID_JSON",
      "Request body must be valid JSON.",
    );
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
