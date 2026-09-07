/** Accept `{ data: T[] }` envelopes or a bare array. */
export function unwrapList<T>(body: unknown): T[] {
  if (Array.isArray(body)) return body as T[];
  if (body && typeof body === "object" && "data" in body) {
    const data = (body as { data: unknown }).data;
    if (Array.isArray(data)) return data as T[];
  }
  return [];
}
