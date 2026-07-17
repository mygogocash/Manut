import type { AuditLogEntry } from "@/services/admin.service";

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function humanizeKey(key: string): string {
  return key
    .replace(/[_-]/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return plural(v.length, "item");
  if (typeof v === "object") {
    const keys = Object.keys(v as object);
    return keys.length === 0 ? "—" : plural(keys.length, "field");
  }
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

export function formatAuditDetails(entry: AuditLogEntry): string {
  const { action, resource, details } = entry;
  if (!details || Object.keys(details).length === 0) return "—";

  const d = details as Record<string, unknown>;
  const name = asString(d.name);
  const email = asString(d.email);

  if (resource === "user") {
    if (action === "create" && name) {
      return email ? `Created ${name} (${email})` : `Created ${name}`;
    }
    if (action === "bulk_import") {
      const ok = Number(d.successCount ?? 0);
      const failed = Number(d.failureCount ?? 0);
      const base = `Imported ${plural(ok, "user")}`;
      return failed ? `${base} (${failed} failed)` : base;
    }
    if (action === "assign-roles" && Array.isArray(d.roleIds)) {
      return `Assigned ${plural(d.roleIds.length, "role")}`;
    }
  }

  if (resource === "role") {
    if (name) {
      if (action === "create") return `Created "${name}"`;
      if (action === "update") return `Renamed to "${name}"`;
      if (action === "clone") return `Cloned as "${name}"`;
    }
  }

  if (resource === "user-group" && name) {
    if (action === "create") return `Created "${name}"`;
    if (action === "update") return `Renamed to "${name}"`;
  }

  if (resource === "module-access" && Array.isArray(d.modules)) {
    return `Updated access for ${plural(d.modules.length, "module")}`;
  }

  return Object.entries(d)
    .map(([k, v]) => `${humanizeKey(k)}: ${formatValue(v)}`)
    .join(" • ");
}
