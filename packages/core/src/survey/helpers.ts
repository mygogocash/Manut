import { BadRequestException } from "../http-exception";

export function asArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
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
  const userIds = asArray(form.targetUserIds);
  if (userIds.includes(user.id)) return true;
  const entityIds = asArray(form.targetEntityIds);
  if (user.entityId && entityIds.includes(user.entityId)) return true;
  const departments = asArray(form.targetDepartments);
  if (user.department && departments.includes(user.department)) return true;
  return false;
}

export function isOpenNow(form: { startDate: string | null; endDate: string | null }): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (form.startDate && form.startDate > today) return false;
  if (form.endDate && form.endDate < today) return false;
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
    if (required) throw new BadRequestException("Answer is required");
    return null;
  }

  switch (type) {
    case "short_text":
    case "long_text": {
      if (typeof value !== "string") throw new BadRequestException("Text answer must be a string");
      const max = type === "short_text" ? 500 : 5000;
      if (value.length > max) {
        throw new BadRequestException(`Answer exceeds the ${max}-character limit`);
      }
      return value;
    }
    case "single_choice": {
      if (typeof value !== "string") throw new BadRequestException("Choice answer must be a string");
      const opts = asArray(options);
      if (!opts.includes(value)) {
        throw new BadRequestException("Selected option is not part of the question");
      }
      return value;
    }
    case "multi_choice": {
      if (!Array.isArray(value)) throw new BadRequestException("Multi-choice answer must be an array");
      const opts = asArray(options);
      const arr = value.filter((v): v is string => typeof v === "string");
      for (const v of arr) {
        if (!opts.includes(v)) {
          throw new BadRequestException(`Selected option "${v}" is not part of the question`);
        }
      }
      return arr;
    }
    case "rating":
    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n)) throw new BadRequestException("Numeric answer is not a number");
      return n;
    }
    case "date": {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new BadRequestException("Date answer must be YYYY-MM-DD");
      }
      return value;
    }
    default:
      throw new BadRequestException(`Unknown question type: ${type}`);
  }
}

export interface AnnouncementDefaults {
  wall: boolean;
  news: boolean;
  companyDate: boolean;
  messageTemplate: string;
  newsCategory: string;
}

export const DEFAULT_ANNOUNCEMENT: AnnouncementDefaults = {
  wall: true,
  news: true,
  companyDate: true,
  messageTemplate: 'New survey: "{title}" is now open. Share your input on the Intranet.',
  newsCategory: "Survey",
};

export function readAnnouncementDefaults(value: unknown): AnnouncementDefaults {
  const v = (value ?? {}) as Record<string, unknown>;
  const str = (x: unknown, fallback: string) =>
    typeof x === "string" && x.trim() ? x : fallback;
  const bool = (x: unknown, fallback: boolean) => (typeof x === "boolean" ? x : fallback);
  return {
    wall: bool(v.wall, DEFAULT_ANNOUNCEMENT.wall),
    news: bool(v.news, DEFAULT_ANNOUNCEMENT.news),
    companyDate: bool(v.companyDate, DEFAULT_ANNOUNCEMENT.companyDate),
    messageTemplate: str(v.messageTemplate, DEFAULT_ANNOUNCEMENT.messageTemplate),
    newsCategory: str(v.newsCategory, DEFAULT_ANNOUNCEMENT.newsCategory),
  };
}

export interface NotificationRecipients {
  recipients: string[];
}

export function readNotificationRecipients(value: unknown): NotificationRecipients {
  const v = (value ?? {}) as Record<string, unknown>;
  const seen = new Set<string>();
  const recipients: string[] = [];
  for (const raw of asArray(v.recipients)) {
    const clean = raw.trim().toLowerCase();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      recipients.push(clean);
    }
  }
  return { recipients };
}

export function buildAnnounceMessage(
  title: string,
  custom: string | undefined,
  template: string,
): string {
  const base = custom?.trim() || template || DEFAULT_ANNOUNCEMENT.messageTemplate;
  return base.replace(/\{title\}/g, title);
}
