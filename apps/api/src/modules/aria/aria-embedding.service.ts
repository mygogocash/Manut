import { logger } from "@/common/utils/logger";
import { getGeminiClient } from "@/infrastructure/ai/gemini";

// Gemini text-embedding-004 outputs 768-dim vectors. Match the column
// width on `aria_knowledge_articles.embedding`.
export const EMBEDDING_MODEL = "text-embedding-004";
export const EMBEDDING_DIMS = 768;

interface EmbedContentResponse {
  embeddings?: Array<{ values?: number[] }>;
  embedding?: { values?: number[] };
}

/**
 * Generate a single embedding vector for the supplied text. Returns
 * `null` on any failure (missing API key, transient network error,
 * malformed response) so callers can fall back to keyword retrieval
 * instead of failing the whole chat / write path.
 */
export async function generateEmbedding(
  text: string,
): Promise<number[] | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const client = getGeminiClient();
    // The @google/genai SDK exposes `embedContent` on `client.models`.
    const response = (await client.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: [{ role: "user", parts: [{ text: trimmed.slice(0, 8000) }] }],
    })) as EmbedContentResponse;

    const vec =
      response.embeddings?.[0]?.values ?? response.embedding?.values ?? null;
    if (!vec || vec.length === 0) {
      logger.warn("ARIA embedding response had no vector", {
        modelKeys: Object.keys(response).join(","),
      });
      return null;
    }
    if (vec.length !== EMBEDDING_DIMS) {
      logger.warn("ARIA embedding dim mismatch", {
        expected: EMBEDDING_DIMS,
        got: vec.length,
      });
      // Truncate / pad to keep DB writes consistent. Padding is a safety
      // net for the event the SDK starts returning a longer vector.
      if (vec.length > EMBEDDING_DIMS) return vec.slice(0, EMBEDDING_DIMS);
      return [...vec, ...new Array(EMBEDDING_DIMS - vec.length).fill(0)];
    }
    return vec;
  } catch (err) {
    logger.warn("ARIA embedding call failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Render the embedding payload from an article. We concatenate the
 * fields most likely to be meaningful for retrieval — title carries
 * heavy weight, body is the bulk, keywords are admin-curated hints.
 */
export function articleEmbeddingInput(args: {
  title: string;
  body: string;
  keywords: string[];
}): string {
  const kw = (args.keywords ?? []).filter(Boolean).join(", ");
  return `${args.title}\n\n${args.body}\n\nKeywords: ${kw}`;
}

/**
 * Format a number[] as the Postgres `vector` literal `[v1,v2,...]`. We
 * cast back to `vector` in the SQL `$1::vector` so this is just a
 * cheap way to bind without relying on Prisma's nonexistent vector
 * adapter.
 */
export function vectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
