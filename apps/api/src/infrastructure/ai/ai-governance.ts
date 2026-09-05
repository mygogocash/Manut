// AI Project Orchestrator — Phase 7 (Data Governance). Reusable AI-input
// sanitizer: strips prompt-injection attempts AND redacts sensitive data before
// any text is sent to an LLM. Every orchestrator AI service routes its inputs
// through `sanitizeForAi` so financial data, secrets, and private employee
// information never leave the perimeter. Deterministic, dependency-free.

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/gi,
  /forget\s+(everything|all|your)\s*(above|previous)?/gi,
  /you\s+are\s+now\s+a/gi,
  /new\s+role|change\s+your\s+role|act\s+as/gi,
  /system\s*prompt|reveal\s+(your|the)\s+(instructions?|prompt)/gi,
];

// Order matters: more specific patterns first so a token isn't partially
// masked by a broader numeric rule.
const SENSITIVE_PATTERNS: Array<{ re: RegExp; tag: string }> = [
  // Provider / API secrets and bearer tokens.
  { re: /\b(sk|rk|pk)-[A-Za-z0-9]{16,}\b/g, tag: "[redacted:key]" },
  { re: /\bAIza[0-9A-Za-z_-]{20,}\b/g, tag: "[redacted:key]" },
  { re: /\bgh[posru]_[A-Za-z0-9]{20,}\b/g, tag: "[redacted:key]" },
  { re: /\bBearer\s+[A-Za-z0-9._-]{16,}\b/gi, tag: "[redacted:token]" },
  { re: /\beyJ[A-Za-z0-9._-]{20,}\b/g, tag: "[redacted:token]" }, // JWT
  // Emails (private employee info).
  {
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    tag: "[redacted:email]",
  },
  // Card / bank / national-id style long digit runs (financial data) — matched
  // BEFORE the phone rule so a 13-19 digit card isn't misclassified as a phone.
  { re: /\b(?:\d[ -]?){13,19}\b/g, tag: "[redacted:number]" },
  { re: /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g, tag: "[redacted:iban]" },
  { re: /\b\d{3}-\d{2}-\d{4}\b/g, tag: "[redacted:id]" }, // SSN-style
  // Phone numbers (shorter digit runs).
  { re: /(?<!\d)(?:\+?\d[ -]?){9,12}(?!\d)/g, tag: "[redacted:phone]" },
  // Explicit currency amounts (sensitive financials).
  {
    re: /(?:USD|THB|AED|EUR|GBP|SGD|INR|\$|€|£|฿)\s?\d[\d,]*(?:\.\d+)?/gi,
    tag: "[redacted:amount]",
  },
];

/** Redact sensitive data (financials, secrets, PII) from free text. */
export function redactSensitive(text: string): string {
  let s = text;
  for (const { re, tag } of SENSITIVE_PATTERNS) s = s.replace(re, tag);
  return s;
}

/** Strip prompt-injection directives from free text. */
export function stripInjection(text: string): string {
  let s = text;
  for (const p of INJECTION_PATTERNS) s = s.replace(p, "[filtered]");
  return s;
}

/**
 * The single entry point every orchestrator AI service uses on each field
 * before templating it into a prompt: trims, bounds length, strips injection,
 * and redacts sensitive data. Minimum-necessary context only.
 */
export function sanitizeForAi(
  text: string | null | undefined,
  maxLen = 5000,
): string {
  const trimmed = (text ?? "").trim().slice(0, maxLen);
  return redactSensitive(stripInjection(trimmed));
}
