export type ResourceRow = {
  title: string;
  meta?: string;
  body?: string;
};

function asText(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

/** Best-effort title/meta/body from the loose list shapes the module pages share. */
export function defaultResourceRow(item: Record<string, unknown>): ResourceRow {
  const title =
    asText(item.title) ??
    asText(item.name) ??
    asText(item.label) ??
    asText(item.code) ??
    asText(item.company) ??
    asText(item.partner) ??
    asText(item.holderName) ??
    asText(item.employeeName) ??
    asText(item.slug) ??
    asText(item.period) ??
    asText(item.id) ??
    "—";

  const meta = [
    asText(item.status),
    asText(item.team),
    asText(item.type),
    asText(item.category),
    asText(item.date),
    asText(item.createdAt),
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  return {
    title,
    meta: meta || undefined,
    body: asText(item.content),
  };
}
