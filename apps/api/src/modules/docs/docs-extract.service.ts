import {
  createPartFromBase64,
  createPartFromText,
  createUserContent,
  type Schema,
  Type,
} from "@google/genai";
import { z } from "zod";

import { BadRequestException } from "@/common/exceptions/http-exception";
import { logger } from "@/common/utils/logger";
import { GEMINI_MODELS, getGeminiClient } from "@/infrastructure/ai/gemini";

// ─── AI auto-fill from a wiki attachment ─────────────────
//
// Reads an uploaded file (image / PDF / plain text / markdown / CSV)
// and asks Gemini for a concise wiki-style title + body. The FE calls
// this immediately after `uploadFile` returns and patches the empty
// form fields with the result.
//
// Office formats (docx / xlsx / pptx) and binary types like video are
// rejected with a clear "manual edit required" message — extracting
// structured prose from those needs an additional parser, which we
// can layer in later.

const EXTRACT_MAX_BYTES = 12 * 1024 * 1024;

const NATIVE_MIMES = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

const TEXT_MIMES = new Set<string>(["text/plain", "text/markdown", "text/csv"]);

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    body: { type: Type.STRING },
  },
  required: ["title", "body"],
};

const extractedSchema = z.object({
  title: z.string().min(1).max(300),
  body: z.string().min(1).max(60_000),
});

export type WikiExtraction = z.infer<typeof extractedSchema>;

const SYSTEM_INSTRUCTION = [
  "You convert a single uploaded business document into a wiki page.",
  "Return JSON with two fields:",
  "- `title`: a concise (<= 80 chars) human-readable title that names the document.",
  "- `body`: clean HTML the user can drop into a rich-text editor.",
  "  Use <h2> / <h3> for sections, <p> for prose, <ul><li> for bullet",
  "  lists, <ol><li> for ordered lists. Avoid inline styles, scripts,",
  "  or external resources. Keep it under 60,000 characters.",
  "Preserve the document's information faithfully — do not invent",
  "facts, summarise away dates / numbers, or omit named entities.",
  "If the document is mostly tabular, render the relevant rows as a",
  "<table> with <thead> + <tbody>; use plain text otherwise.",
].join(" ");

const USER_INSTRUCTION =
  "Extract a wiki-style title and HTML body from this document. " +
  "Return valid JSON matching the requested schema.";

async function fetchBuffer(
  url: string,
): Promise<{ buffer: Buffer; size: number }> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new BadRequestException(
      `Failed to fetch attachment (${res.status} ${res.statusText})`,
    );
  }
  const ab = await res.arrayBuffer();
  if (ab.byteLength === 0) {
    throw new BadRequestException("Attachment is empty");
  }
  if (ab.byteLength > EXTRACT_MAX_BYTES) {
    throw new BadRequestException(
      `Attachment too large for AI extract (max ${Math.round(
        EXTRACT_MAX_BYTES / (1024 * 1024),
      )} MB)`,
    );
  }
  return { buffer: Buffer.from(ab), size: ab.byteLength };
}

export async function extractWikiFromAttachment(
  url: string,
  mimeType: string,
): Promise<WikiExtraction> {
  const mime = mimeType.toLowerCase().trim();
  const isNative = NATIVE_MIMES.has(mime);
  const isText = TEXT_MIMES.has(mime);
  if (!isNative && !isText) {
    throw new BadRequestException(
      `AI auto-fill is not supported for ${mimeType}. Try a PDF, image, or plain-text file, or fill the form manually.`,
    );
  }

  const { buffer } = await fetchBuffer(url);
  const gemini = getGeminiClient();

  const parts = isNative
    ? [
        createPartFromBase64(buffer.toString("base64"), mime),
        createPartFromText(USER_INSTRUCTION),
      ]
    : [
        createPartFromText(
          `${USER_INSTRUCTION}\n\nDocument contents:\n\n${buffer.toString(
            "utf-8",
          )}`,
        ),
      ];

  const response = await gemini.models.generateContent({
    model: GEMINI_MODELS.FLASH,
    contents: [createUserContent(parts)],
    config: {
      maxOutputTokens: 8192,
      temperature: 0.2,
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const raw = response.text ?? "";
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    logger.error("docs.extract: invalid JSON from model", {
      raw: raw.slice(0, 500),
    });
    throw new BadRequestException("Model returned invalid JSON");
  }

  const parsed = extractedSchema.safeParse(json);
  if (!parsed.success) {
    logger.error(
      "docs.extract: schema validation failed",
      parsed.error.flatten(),
    );
    throw new BadRequestException("Model output did not match expected schema");
  }
  return parsed.data;
}
