export type HandbookChunk = {
  id: string;
  sourceType: "policy" | "article" | "doc";
  sourceId: string;
  title: string;
  excerpt: string;
  vectorId?: string | null;
};

const MAX_CHUNK = 800;

/** Split handbook text into embeddable passages. Pure so tests don't need Vectorize. */
export function chunkHandbookText(text: string, max = MAX_CHUNK): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const paragraphs = normalized.split(/(?<=\.)\s+/);
  const chunks: string[] = [];
  let current = "";
  for (const part of paragraphs) {
    const next = current ? `${current} ${part}` : part;
    if (next.length > max && current) {
      chunks.push(current);
      current = part;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function scoreChunk(query: string, chunk: HandbookChunk): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const hay = `${chunk.title} ${chunk.excerpt}`.toLowerCase();
  if (hay.includes(q)) return q.length + (hay.startsWith(q) ? 10 : 0);
  return q.split(/\s+/).filter((w) => w.length > 2 && hay.includes(w)).length;
}

export function rankHandbookChunks(query: string, chunks: HandbookChunk[], limit = 8): HandbookChunk[] {
  return chunks
    .map((chunk) => ({ chunk, score: scoreChunk(query, chunk) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.chunk);
}
