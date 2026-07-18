function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

export function targetsUser(
  form: {
    targetAll: boolean;
    targetEntityIds: unknown;
    targetDepartments: unknown;
    targetUserIds: unknown;
  },
  user: { id: string; entityId: string | null; department: string | null },
): boolean {
  if (form.targetAll) return true;
  const userIds = asStringArray(form.targetUserIds);
  if (userIds.includes(user.id)) return true;
  const entityIds = asStringArray(form.targetEntityIds);
  if (user.entityId && entityIds.includes(user.entityId)) return true;
  const departments = asStringArray(form.targetDepartments);
  if (user.department && departments.includes(user.department)) return true;
  return false;
}

/** Inclusive UTC YYYY-MM-DD window; null bound means open on that side. */
export function isOpenNow(form: {
  startDate: Date | string | null;
  endDate: Date | string | null;
}): boolean {
  const today = new Date().toISOString().slice(0, 10);
  const start =
    form.startDate == null
      ? null
      : typeof form.startDate === "string"
        ? form.startDate.slice(0, 10)
        : form.startDate.toISOString().slice(0, 10);
  const end =
    form.endDate == null
      ? null
      : typeof form.endDate === "string"
        ? form.endDate.slice(0, 10)
        : form.endDate.toISOString().slice(0, 10);
  if (start && start > today) return false;
  if (end && end < today) return false;
  return true;
}

export function validateAnswerValue(
  type: string,
  options: unknown,
  required: boolean,
  value: unknown,
): unknown {
  const isMissing =
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim().length === 0) ||
    (Array.isArray(value) && value.length === 0);
  if (type === "info") return null;

  if (isMissing) {
    if (required) {
      throw new Error("Answer is required");
    }
    return null;
  }

  switch (type) {
    case "short_text":
    case "long_text": {
      if (typeof value !== "string") {
        throw new Error("Text answer must be a string");
      }
      const max = type === "short_text" ? 500 : 5000;
      if (value.length > max) {
        throw new Error(`Answer exceeds the ${max}-character limit`);
      }
      return value;
    }
    case "single_choice": {
      if (typeof value !== "string") {
        throw new Error("Choice answer must be a string");
      }
      const opts = asStringArray(options);
      if (!opts.includes(value)) {
        throw new Error("Selected option is not part of the question");
      }
      return value;
    }
    case "multi_choice": {
      if (!Array.isArray(value)) {
        throw new Error("Multi-choice answer must be an array");
      }
      const opts = asStringArray(options);
      const arr = value.filter((entry): entry is string => typeof entry === "string");
      for (const entry of arr) {
        if (!opts.includes(entry)) {
          throw new Error(
            `Selected option "${entry}" is not part of the question`,
          );
        }
      }
      return arr;
    }
    case "rating":
    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n)) {
        throw new Error("Numeric answer is not a number");
      }
      return n;
    }
    case "date": {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
        throw new Error("Date answer must be YYYY-MM-DD");
      }
      return value;
    }
    default:
      throw new Error(`Unknown question type: ${type}`);
  }
}

export const SURVEY_QUESTION_TYPES = new Set([
  "info",
  "short_text",
  "long_text",
  "single_choice",
  "multi_choice",
  "rating",
  "date",
  "number",
]);
