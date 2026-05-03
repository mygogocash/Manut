/**
 * Utilities for the diagnostic error fallback UI.
 *
 * - generateTraceId: short, copy-friendly identifier derived from crypto.randomUUID()
 * - buildDiagnosticInfo: assembles a single shareable text blob (message + stack +
 *   trace id + url + user agent) for the "Copy diagnostic info" button.
 * - isNetworkError: heuristic match on error.message for the "Check your connection"
 *   variant.
 */

const NETWORK_ERROR_PATTERN = /network|fetch|connection/i;

export const generateTraceId = (): string => {
  // crypto.randomUUID() is widely available in modern browsers + Electron.
  // Fall back to a Math.random()-based id only if the API is missing so the
  // diagnostic page never throws while reporting an error.
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  // Fallback — non-cryptographic, but identifiers here are diagnostic only.
  const segment = () =>
    Math.floor(Math.random() * 0xffffffff)
      .toString(16)
      .padStart(8, '0');
  return `${segment()}-${segment()}-${segment()}-${segment()}`;
};

export const isNetworkError = (error: unknown): boolean => {
  if (!error) return false;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  return NETWORK_ERROR_PATTERN.test(message);
};

export interface DiagnosticInfoInput {
  error: unknown;
  traceId: string;
  timestamp: string;
}

export const buildDiagnosticInfo = ({
  error,
  traceId,
  timestamp,
}: DiagnosticInfoInput): string => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : String(error);
  const stack =
    error instanceof Error && error.stack
      ? error.stack
      : 'No stack trace available.';

  const url = typeof window !== 'undefined' ? window.location.href : 'n/a';
  const userAgent =
    typeof navigator !== 'undefined' && navigator.userAgent
      ? navigator.userAgent
      : 'n/a';

  return [
    `Trace ID: ${traceId}`,
    `Timestamp: ${timestamp}`,
    `URL: ${url}`,
    `User-Agent: ${userAgent}`,
    '',
    `Message: ${message}`,
    '',
    'Stack:',
    stack,
  ].join('\n');
};

export const copyDiagnosticInfo = async (text: string): Promise<boolean> => {
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the textarea fallback below
  }

  // Fallback for environments without the async clipboard API.
  if (typeof document === 'undefined') return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
};
