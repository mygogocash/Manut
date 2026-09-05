import {
  createPartFromBase64,
  createPartFromText,
  createUserContent,
  type Schema,
} from "@google/genai";
import { z } from "zod";

import {
  PARSE_INVOICE_SCHEMA,
  PARSE_INVOICE_SYSTEM,
  PARSE_RECEIPT_SCHEMA,
  PARSE_RECEIPT_SYSTEM,
  PARSE_VISA_SCHEMA,
  PARSE_VISA_SYSTEM,
} from "@/common/constants/ai-prompts";
import {
  BadRequestException,
  InternalServerErrorException,
} from "@/common/exceptions/http-exception";
import { logger } from "@/common/utils/logger";
import { GEMINI_MODELS, getGeminiClient } from "@/infrastructure/ai/gemini";

export const PARSE_DOCUMENT_MAX_BYTES = 12 * 1024 * 1024;

export const PARSE_DOCUMENT_ALLOWED_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export type ParseDocumentMime = (typeof PARSE_DOCUMENT_ALLOWED_MIMES)[number];

const receiptLineSchema = z.object({
  description: z.string(),
  amount: z.number().optional(),
  quantity: z.number().optional(),
});

export const parsedReceiptSchema = z.object({
  merchantName: z.string(),
  transactionDate: z.string(),
  currency: z.string(),
  totalAmount: z.number(),
  taxAmount: z.number(),
  subtotal: z.number().optional(),
  paymentMethod: z.string(),
  lineItems: z.array(receiptLineSchema),
  suggestedDescription: z.string(),
  parsingNotes: z.string(),
});

export type ParsedReceipt = z.infer<typeof parsedReceiptSchema>;

const invoiceLineSchema = z.object({
  description: z.string(),
  amount: z.number().optional(),
  quantity: z.number().optional(),
});

export const parsedInvoiceSchema = z.object({
  vendorName: z.string(),
  vendorTaxId: z.string(),
  invoiceNumber: z.string(),
  issueDate: z.string(),
  dueDate: z.string(),
  currency: z.string(),
  totalAmount: z.number(),
  taxAmount: z.number(),
  lineItems: z.array(invoiceLineSchema),
  suggestedMemo: z.string(),
  parsingNotes: z.string(),
});

export type ParsedInvoice = z.infer<typeof parsedInvoiceSchema>;

export const parsedVisaDocSchema = z.object({
  holderName: z.string(),
  visaType: z.string(),
  country: z.string(),
  nationality: z.string(),
  issueDate: z.string(),
  expiryDate: z.string(),
  workPermitNumber: z.string(),
  workPermitIssueDate: z.string(),
  workPermitExpiryDate: z.string(),
  parsingNotes: z.string(),
});

export type ParsedVisaDoc = z.infer<typeof parsedVisaDocSchema>;

function normalizeMimeType(mime: string): ParseDocumentMime {
  const m = mime.toLowerCase().trim();
  if (m === "image/jpg") return "image/jpeg";
  if ((PARSE_DOCUMENT_ALLOWED_MIMES as readonly string[]).includes(m)) {
    return m as ParseDocumentMime;
  }
  throw new BadRequestException(
    `Unsupported file type: ${mime}. Allowed: JPEG, PNG, WebP, PDF.`,
  );
}

async function runVisionJsonParse<T>(
  buffer: Buffer,
  mimeType: string,
  systemInstruction: string,
  userInstruction: string,
  responseSchema: Schema,
  schema: z.ZodType<T>,
  label: string,
): Promise<T> {
  const normalizedMime = normalizeMimeType(mimeType);

  if (buffer.length === 0) {
    throw new BadRequestException("Empty file");
  }
  if (buffer.length > PARSE_DOCUMENT_MAX_BYTES) {
    throw new BadRequestException(
      `File too large (max ${Math.round(PARSE_DOCUMENT_MAX_BYTES / (1024 * 1024))} MB)`,
    );
  }

  const gemini = getGeminiClient();
  const b64 = buffer.toString("base64");

  const response = await gemini.models.generateContent({
    model: GEMINI_MODELS.FLASH,
    contents: [
      createUserContent([
        createPartFromBase64(b64, normalizedMime),
        createPartFromText(userInstruction),
      ]),
    ],
    config: {
      maxOutputTokens: 4096,
      temperature: 0.2,
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema,
    },
  });

  const raw = response.text ?? "";
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    logger.error(`${label}: invalid JSON from model`, {
      raw: raw.slice(0, 500),
    });
    throw new InternalServerErrorException("Model returned invalid JSON");
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    logger.error(`${label}: schema validation failed`, parsed.error.flatten());
    throw new InternalServerErrorException(
      "Model output did not match expected schema",
    );
  }
  return parsed.data;
}

const RECEIPT_USER =
  "Extract structured data from this receipt image or PDF. " +
  "Use only information visible in the document. If a field is not present, use an empty string for strings, 0 for taxAmount when unknown, and an empty array for lineItems when none are listed.";

const INVOICE_USER =
  "Extract structured data from this invoice image or PDF. " +
  "Use only information visible in the document. If a field is not present, use an empty string for strings, 0 for taxAmount when unknown, and an empty array for lineItems when none are listed.";

const VISA_USER =
  "Extract structured fields from this visa, passport, or work-permit scan. " +
  "Use only information visible in the document. Dates must be ISO YYYY-MM-DD; " +
  "leave any field empty if it is not present or not clearly legible, and note that in parsingNotes.";

export const ariaDocumentParseService = {
  async parseReceipt(buffer: Buffer, mimeType: string): Promise<ParsedReceipt> {
    try {
      return await runVisionJsonParse(
        buffer,
        mimeType,
        PARSE_RECEIPT_SYSTEM,
        RECEIPT_USER,
        PARSE_RECEIPT_SCHEMA,
        parsedReceiptSchema,
        "parseReceipt",
      );
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      logger.error("parseReceipt failed", err);
      const isConfig =
        err instanceof Error && err.message.includes("API key not configured");
      if (isConfig) {
        throw new BadRequestException(
          "AI is not configured. Ask an administrator to set GEMINI_API_KEY.",
        );
      }
      throw new BadRequestException(
        "Could not parse receipt. Try a clearer photo or PDF.",
      );
    }
  },

  async parseInvoice(buffer: Buffer, mimeType: string): Promise<ParsedInvoice> {
    try {
      return await runVisionJsonParse(
        buffer,
        mimeType,
        PARSE_INVOICE_SYSTEM,
        INVOICE_USER,
        PARSE_INVOICE_SCHEMA,
        parsedInvoiceSchema,
        "parseInvoice",
      );
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      logger.error("parseInvoice failed", err);
      const isConfig =
        err instanceof Error && err.message.includes("API key not configured");
      if (isConfig) {
        throw new BadRequestException(
          "AI is not configured. Ask an administrator to set GEMINI_API_KEY.",
        );
      }
      throw new BadRequestException(
        "Could not parse invoice. Try a clearer scan or PDF.",
      );
    }
  },

  async parseVisaDocument(
    buffer: Buffer,
    mimeType: string,
  ): Promise<ParsedVisaDoc> {
    try {
      return await runVisionJsonParse(
        buffer,
        mimeType,
        PARSE_VISA_SYSTEM,
        VISA_USER,
        PARSE_VISA_SCHEMA,
        parsedVisaDocSchema,
        "parseVisaDocument",
      );
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      logger.error("parseVisaDocument failed", err);
      const isConfig =
        err instanceof Error && err.message.includes("API key not configured");
      if (isConfig) {
        throw new BadRequestException(
          "AI is not configured. Ask an administrator to set GEMINI_API_KEY.",
        );
      }
      throw new BadRequestException(
        "Could not parse document. Try a clearer photo or PDF.",
      );
    }
  },
};
