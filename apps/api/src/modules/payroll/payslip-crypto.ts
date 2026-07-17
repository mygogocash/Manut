/**
 * Password-protection for employee-facing payslip files.
 *
 * Each employee's payslip PDF / Excel is encrypted with their date of
 * birth as the password (format DDMMYYYY, e.g. 31 Oct 1998 → 31101998),
 * so a leaked download / email attachment can't be opened without it.
 *
 * - PDF: pdf-lib can't encrypt, so we hand the generated buffer to qpdf
 *   (via node-qpdf2). qpdf reads from disk, so we round-trip through a
 *   temp file. Requires the `qpdf` binary on PATH (added to
 *   docker/Dockerfile.api; `brew install qpdf` for local dev).
 * - XLSX: SheetJS community can't *write* encrypted workbooks, so the
 *   finished buffer is encrypted in-process by officecrypto-tool
 *   (ECMA-376). The template generation in payslip-generator stays
 *   untouched.
 */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { encrypt as qpdfEncrypt } from "node-qpdf2";
import officeCrypto from "officecrypto-tool";

import { logger } from "@/common/utils/logger";

/**
 * Derive the payslip password from a date of birth. Returns null when no
 * DOB is on file — callers fall back to an unprotected download.
 *
 * Uses UTC getters: a Prisma `@db.Date` column comes back as a Date at
 * UTC midnight, so local-time getters could shift it a day in non-UTC
 * runtimes.
 */
export function payslipPassword(
  dateOfBirth: Date | string | null | undefined,
): string | null {
  if (!dateOfBirth) return null;
  const d = new Date(dateOfBirth);
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getUTCFullYear());
  return `${dd}${mm}${yyyy}`;
}

/** Encrypt a PDF buffer with AES-256 via qpdf. */
export async function encryptPdf(
  buffer: Buffer,
  password: string,
): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "payslip-pdf-"));
  const input = join(dir, "in.pdf");
  try {
    await writeFile(input, buffer);
    // No `output` → node-qpdf2 returns the encrypted bytes as a Buffer.
    // A string password is applied as both the user and owner password.
    const out = await qpdfEncrypt({ input, password, keyLength: 256 });
    return Buffer.from(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Encrypt an XLSX buffer with a password (ECMA-376, in-process). */
export function encryptXlsx(buffer: Buffer, password: string): Buffer {
  return officeCrypto.encrypt(buffer, { password });
}

/**
 * Encrypt a generated payslip buffer in place when a password is
 * available. Returns the (possibly unchanged) buffer plus whether it was
 * actually protected, so callers can warn the employee when their DOB is
 * missing. Encryption failures never block the download — we log and fall
 * back to the unprotected file rather than denying access to a payslip.
 */
export async function protectPayslip(
  buffer: Buffer,
  format: "pdf" | "xlsx",
  password: string | null,
): Promise<{ buffer: Buffer; protected: boolean }> {
  if (!password) return { buffer, protected: false };
  try {
    const out =
      format === "pdf"
        ? await encryptPdf(buffer, password)
        : encryptXlsx(buffer, password);
    return { buffer: out, protected: true };
  } catch (err) {
    logger.error(
      `Failed to password-protect ${format} payslip: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return { buffer, protected: false };
  }
}
