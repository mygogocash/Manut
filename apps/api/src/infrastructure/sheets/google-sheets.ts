import { JWT } from "google-auth-library";

import { logger } from "@/common/utils/logger";

/**
 * Read-only Google Sheets access via a service account. Unlike the
 * per-user OAuth integration (Gmail/Drive), this is a non-human identity
 * the target sheet is explicitly shared with, so unattended reads (live
 * dashboard fetch) don't depend on any employee staying connected.
 *
 * Config: `GOOGLE_SHEETS_SA_KEY` = the service-account JSON key, either
 * raw JSON or base64-encoded JSON. Absent → not configured (callers fall
 * back gracefully).
 */

let cachedClient: JWT | null = null;
let triedClient = false;

function loadServiceAccount(): {
  client_email: string;
  private_key: string;
} | null {
  const raw = process.env.GOOGLE_SHEETS_SA_KEY?.trim();
  if (!raw) return null;
  try {
    const json = raw.startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(json) as {
      client_email?: string;
      private_key?: string;
    };
    if (!parsed.client_email || !parsed.private_key) {
      logger.error(
        "GOOGLE_SHEETS_SA_KEY missing client_email / private_key fields",
      );
      return null;
    }
    return {
      client_email: parsed.client_email,
      // Env-stored keys often carry escaped newlines.
      private_key: parsed.private_key.replace(/\\n/g, "\n"),
    };
  } catch {
    logger.error("GOOGLE_SHEETS_SA_KEY is not valid JSON or base64-JSON");
    return null;
  }
}

export function isSheetsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SHEETS_SA_KEY?.trim());
}

function getClient(): JWT | null {
  if (triedClient) return cachedClient;
  triedClient = true;
  const sa = loadServiceAccount();
  if (!sa) return null;
  cachedClient = new JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return cachedClient;
}

/**
 * Read a range from a spreadsheet as a row-major grid of strings.
 * `range` is an A1 notation range, optionally tab-qualified
 * (e.g. "Traction!A1:Z500" or just "A1:Z500").
 */
export async function readSheetValues(
  spreadsheetId: string,
  range: string,
): Promise<string[][]> {
  const client = getClient();
  if (!client) {
    throw new Error("Google Sheets service account is not configured");
  }
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Failed to obtain a Google access token");

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}` +
    `/values/${encodeURIComponent(range)}?majorDimension=ROWS`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Sheets API ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { values?: string[][] };
  return data.values ?? [];
}

export interface SheetTab {
  title: string;
  rows: number;
  cols: number;
}

/**
 * List the tabs (sheets) in a spreadsheet with their grid size. Used by
 * the OW holistic ingester to enumerate every tab before reading. Reuses
 * the same service-account auth + error shape as `readSheetValues`.
 */
export async function listSheetTabs(
  spreadsheetId: string,
): Promise<SheetTab[]> {
  const client = getClient();
  if (!client) {
    throw new Error("Google Sheets service account is not configured");
  }
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Failed to obtain a Google access token");

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}` +
    `?fields=${encodeURIComponent("sheets.properties(title,gridProperties)")}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Sheets API ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    sheets?: Array<{
      properties?: {
        title?: string;
        gridProperties?: { rowCount?: number; columnCount?: number };
      };
    }>;
  };
  return (data.sheets ?? []).map((s) => ({
    title: s.properties?.title ?? "",
    rows: s.properties?.gridProperties?.rowCount ?? 0,
    cols: s.properties?.gridProperties?.columnCount ?? 0,
  }));
}

/**
 * Read multiple A1 ranges in one call. Returns a map of requested range
 * → row-major grid. Google's batchGet preserves request order; we key
 * the result by the requested range string for the caller's convenience.
 */
export async function batchGetSheetValues(
  spreadsheetId: string,
  ranges: string[],
): Promise<Record<string, string[][]>> {
  if (ranges.length === 0) return {};
  const client = getClient();
  if (!client) {
    throw new Error("Google Sheets service account is not configured");
  }
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Failed to obtain a Google access token");

  const qs = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}` +
    `/values:batchGet?${qs}&majorDimension=ROWS`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Sheets API ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    valueRanges?: Array<{ values?: string[][] }>;
  };
  const out: Record<string, string[][]> = {};
  (data.valueRanges ?? []).forEach((vr, i) => {
    const key = ranges[i];
    if (key != null) out[key] = vr.values ?? [];
  });
  return out;
}
