/**
 * Reading and writing the System Settings fields without changing their type.
 *
 * The tab used to render every value with `String(value)` into a text input and
 * post back `e.target.value`, so saving turned `true` into `"true"`, `90` into
 * `"90"`, and a list into one comma-joined string. The API now validates each
 * key against the type it actually holds, so a string where a boolean belongs is
 * rejected rather than stored — which means the editor has to preserve types
 * rather than flatten them.
 */

export type SettingValue = string | number | boolean | string[] | null;

/** Which control a value should be edited with. */
export type SettingKind = "boolean" | "number" | "list" | "text";

export function settingKind(value: SettingValue): SettingKind {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (Array.isArray(value)) return "list";
  return "text";
}

/** What a text-style control should show for a value. */
export function formatSettingValue(value: SettingValue): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

export interface ParsedSetting {
  value: SettingValue;
  /** Set when the text cannot be read as the kind this key holds. */
  error: string | null;
}

/**
 * Read a text control back into the value's own type.
 *
 * A number that will not parse is REPORTED rather than coerced. Falling back to
 * zero would save successfully and quietly change a session timeout or a
 * without-approval spend limit to nothing, which is worse than refusing.
 */
export function parseSettingValue(
  kind: SettingKind,
  raw: string,
): ParsedSetting {
  if (kind === "boolean") {
    // Booleans are edited with a switch, so a string never reaches here.
    return { value: raw === "true", error: null };
  }
  if (kind === "number") {
    const trimmed = raw.trim();
    if (trimmed === "") return { value: null, error: "Enter a number" };
    const cleaned = trimmed.replace(/[,\s_]/g, "");
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
      return { value: null, error: `“${trimmed}” is not a number` };
    }
    return { value: Number(cleaned), error: null };
  }
  if (kind === "list") {
    // Commas are the separator the field displays, so they are the one it reads.
    return {
      value: raw
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.length > 0),
      error: null,
    };
  }
  return { value: raw, error: null };
}

/** `security.session_timeout_minutes` → "Security session timeout minutes". */
export function settingLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[._-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}
