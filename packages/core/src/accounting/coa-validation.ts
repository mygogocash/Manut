export const ENGLISH_LETTERS_AND_SPACES = /^[A-Za-z ]+$/;

export const COA_MESSAGES = {
  required: {
    en: "This field is required",
    th: "กรุณากรอกข้อมูล",
  },
  englishCharset: {
    en: "English fields may contain only English letters and spaces",
    th: "ช่องภาษาอังกฤษใช้ได้เฉพาะตัวอักษรอังกฤษและช่องว่าง",
  },
} as const;

export type CoaFieldError = {
  field: string;
  message: string;
  messageTh: string;
};

export type CoaWarning = {
  code: "inactive_code_reuse" | "inactive_name_reuse";
  message: string;
  messageTh: string;
  /** Structured copy of everything the message quotes, so the UI can lay it
   *  out rather than re-parsing prose. */
  detail?: InactiveAccountDetail;
};

export type InactiveAccountDetail = {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountNameTh: string | null;
  /** ISO date, or null for accounts deactivated before the column existed. */
  deactivatedAt: string | null;
  balance: number;
  lastMovementYear: number | null;
};

export function sanitizeCoaText(value: string | undefined | null): string {
  if (value == null) return "";
  return value.replace(/[\r\n\u00a0\u2028\u2029]+/g, " ").trim();
}

export function isBlank(value: string | undefined | null): boolean {
  return sanitizeCoaText(value).length === 0;
}

export function normalizeEnglishName(value: string): string {
  return sanitizeCoaText(value).replace(/\s+/g, " ").toLowerCase();
}

export function englishCharsetError(
  field: string,
  value: string,
): CoaFieldError | null {
  if (isBlank(value)) return null;
  if (ENGLISH_LETTERS_AND_SPACES.test(sanitizeCoaText(value))) return null;
  return {
    field,
    message: COA_MESSAGES.englishCharset.en,
    messageTh: COA_MESSAGES.englishCharset.th,
  };
}

export function requiredError(field: string): CoaFieldError {
  return {
    field,
    message: COA_MESSAGES.required.en,
    messageTh: COA_MESSAGES.required.th,
  };
}

export function duplicateCodeError(code: string, name: string): CoaFieldError {
  return {
    field: "code",
    message: `Account code already in use: ${code} ${name}`,
    messageTh: `รหัสบัญชีนี้ถูกใช้แล้ว: ${code} ${name}`,
  };
}

export function duplicateEnglishNameError(
  code: string,
  name: string,
): CoaFieldError {
  return {
    field: "name",
    message: `English name already in use: ${code} ${name}`,
    messageTh: `ชื่อภาษาอังกฤษนี้ถูกใช้แล้ว: ${code} ${name}`,
  };
}

// A balance below half a satang is zero. Same tolerance the settlement paths
// use, so "squared off" means the same thing across the module.
export const REUSE_BALANCE_TOLERANCE = 0.005;

/**
 * One deactivated account whose code or English name a new account wants.
 *
 * `balance` MUST be derived from posted journal lines, not read off
 * `chart_of_accounts.balance`. That column is a running counter incremented at
 * post time, and a block that trusts a counter which has drifted either refuses
 * a legitimate save or waves through the collision it exists to prevent.
 */
export interface InactiveAccountFacts {
  matchedOn: "code" | "name";
  id: string;
  code: string;
  name: string;
  nameTh: string | null;
  deactivatedAt: Date | null;
  balance: number;
  lastMovementYear: number | null;
  /** Still referenced by a financial-statement mapping role. */
  mappedInFinancialStatements: boolean;
}

export type InactiveReuseOutcome = "allow" | "acknowledge" | "block";

export interface InactiveReuseDecision {
  outcome: InactiveReuseOutcome;
  errors: CoaFieldError[];
  warnings: CoaWarning[];
  /** The account the new row should point back to. Null when nothing matched. */
  reusedFromAccountId: string | null;
}

function isoDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function describe(facts: InactiveAccountFacts): string {
  const parts = [`${facts.code} ${facts.name}`.trim()];
  if (facts.nameTh) parts.push(facts.nameTh);
  parts.push(`deactivated ${isoDate(facts.deactivatedAt) ?? "date unknown"}`);
  parts.push(`balance ${facts.balance.toFixed(2)}`);
  if (facts.lastMovementYear !== null) {
    parts.push(`last movement ${facts.lastMovementYear}`);
  }
  return parts.join(", ");
}

function describeTh(facts: InactiveAccountFacts): string {
  const parts = [`${facts.code} ${facts.nameTh ?? facts.name}`.trim()];
  parts.push(`ปิดใช้งาน ${isoDate(facts.deactivatedAt) ?? "ไม่ทราบวันที่"}`);
  parts.push(`ยอดคงเหลือ ${facts.balance.toFixed(2)}`);
  if (facts.lastMovementYear !== null) {
    parts.push(`เคลื่อนไหวล่าสุดปี ${facts.lastMovementYear}`);
  }
  return parts.join(" · ");
}

function toDetail(facts: InactiveAccountFacts): InactiveAccountDetail {
  return {
    accountId: facts.id,
    accountCode: facts.code,
    accountName: facts.name,
    accountNameTh: facts.nameTh,
    deactivatedAt: isoDate(facts.deactivatedAt),
    balance: facts.balance,
    lastMovementYear: facts.lastMovementYear,
  };
}

export function inactiveReuseWarning(facts: InactiveAccountFacts): CoaWarning {
  const noun = facts.matchedOn === "code" ? "code" : "English name";
  const nounTh = facts.matchedOn === "code" ? "รหัส" : "ชื่อภาษาอังกฤษ";
  return {
    code:
      facts.matchedOn === "code"
        ? "inactive_code_reuse"
        : "inactive_name_reuse",
    message: `This ${noun} was last used by a deactivated account (${describe(facts)}). Historical reports will show one ${noun} meaning two accounts, so confirm before saving.`,
    messageTh: `${nounTh}นี้เคยใช้กับบัญชีที่ปิดใช้งานแล้ว (${describeTh(facts)}) รายงานย้อนหลังจะแสดง${nounTh}เดียวที่หมายถึงสองบัญชี กรุณายืนยันก่อนบันทึก`,
    detail: toDetail(facts),
  };
}

function balanceBlocker(facts: InactiveAccountFacts): CoaFieldError {
  const field = facts.matchedOn === "code" ? "code" : "name";
  return {
    field,
    message: `The deactivated account ${describe(facts)} still has a balance, so reusing its ${field} would put two accounts under one ${field} in the same trial balance. Use another ${field}, or reactivate that account instead.`,
    messageTh: `บัญชีที่ปิดใช้งาน ${describeTh(facts)} ยังมียอดคงเหลืออยู่ การใช้${field === "code" ? "รหัส" : "ชื่อ"}ซ้ำจะทำให้งบทดลองมีสองบัญชีใต้${field === "code" ? "รหัส" : "ชื่อ"}เดียวกัน ใช้ค่าอื่น หรือเปิดใช้งานบัญชีเดิมกลับมาแทน`,
  };
}

function mappingBlocker(facts: InactiveAccountFacts): CoaFieldError {
  const field = facts.matchedOn === "code" ? "code" : "name";
  return {
    field,
    message: `The deactivated account ${facts.code} ${facts.name} is still mapped in the financial statements, so both accounts would be pulled into the same line. Clear that mapping first.`,
    messageTh: `บัญชีที่ปิดใช้งาน ${facts.code} ${facts.nameTh ?? facts.name} ยังถูกอ้างอยู่ในผังงบการเงิน งบจะดึงสองบัญชีมารวมช่องเดียว กรุณาแก้ผังงบก่อน`,
  };
}

export function acknowledgementRequiredError(): CoaFieldError {
  return {
    field: "acknowledgeInactiveReuse",
    message:
      "Confirm you have read the deactivated-account warning before saving.",
    messageTh: "กรุณาติ๊กยืนยันรับทราบคำเตือนเรื่องบัญชีที่ปิดใช้งานก่อนบันทึก",
  };
}

/**
 * Decide what happens when a new or renamed account lands on a code or English
 * name that a DEACTIVATED account used.
 *
 * - nothing matched                       → allow
 * - a match still carries a balance       → block
 * - a match is still on the FS mapping    → block, whatever its balance: the
 *                                           statement would pull both accounts
 *                                           into one line
 * - otherwise (squared off and unmapped)  → warn, and require an explicit tick
 *
 * Every match is reported, not just the first: a code can collide with one
 * dead account while the English name collides with a different one, and a
 * message that mentions only one of them sends the user to fix half the problem.
 */
export function classifyInactiveReuse(
  matches: InactiveAccountFacts[],
  opts: { acknowledged: boolean },
): InactiveReuseDecision {
  if (matches.length === 0) {
    return {
      outcome: "allow",
      errors: [],
      warnings: [],
      reusedFromAccountId: null,
    };
  }

  const errors: CoaFieldError[] = [];
  for (const facts of matches) {
    if (facts.mappedInFinancialStatements) {
      errors.push(mappingBlocker(facts));
      continue;
    }
    if (Math.abs(facts.balance) >= REUSE_BALANCE_TOLERANCE) {
      errors.push(balanceBlocker(facts));
    }
  }

  const warnings = matches.map(inactiveReuseWarning);
  // Prefer the code match as the back-pointer: a shared code is the stronger
  // claim that this row succeeds that one. Falls back to the name match.
  const anchor = matches.find((m) => m.matchedOn === "code") ?? matches[0]!;

  if (errors.length > 0) {
    return { outcome: "block", errors, warnings, reusedFromAccountId: null };
  }
  if (!opts.acknowledged) {
    return {
      outcome: "acknowledge",
      errors: [acknowledgementRequiredError()],
      warnings,
      reusedFromAccountId: anchor.id,
    };
  }
  return {
    outcome: "allow",
    errors: [],
    warnings,
    reusedFromAccountId: anchor.id,
  };
}

const CREATE_REQUIRED_FIELDS = [
  "code",
  "name",
  "nameTh",
  "description",
  "descriptionTh",
] as const;

export type CoaWritableFields = {
  code?: string;
  name?: string;
  nameTh?: string;
  description?: string;
  descriptionTh?: string;
};

export function collectCoaFieldErrors(
  input: CoaWritableFields,
  options: { requireAll: boolean; validateEnglish: boolean },
): CoaFieldError[] {
  const errors: CoaFieldError[] = [];
  const seen = new Set<string>();
  const push = (err: CoaFieldError | null) => {
    if (!err || seen.has(err.field)) return;
    seen.add(err.field);
    errors.push(err);
  };

  if (options.requireAll) {
    for (const field of CREATE_REQUIRED_FIELDS) {
      if (isBlank(input[field])) push(requiredError(field));
    }
  }

  if (options.validateEnglish) {
    if (!isBlank(input.name)) push(englishCharsetError("name", input.name!));
    if (!isBlank(input.description)) {
      push(englishCharsetError("description", input.description!));
    }
  }

  return errors;
}
