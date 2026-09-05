/**
 * The single registry of BNII telco partners.
 *
 * Both marketing modules used to carry their own copy of this and they had
 * drifted apart in three ways that each caused a silent failure:
 *
 *   - only ONE of them defaulted the API base URL, so the OneWave ingest was
 *     dead without secrets while Partner Workspaces worked out of the box;
 *   - `MARKETING_ANALYTICS_PARTNER_IDS` was read as `slug:uuid` pairs by one
 *     and as JSON by the other, so setting it in either shape half-broke the
 *     system without an error;
 *   - the telco slug list and the partner list disagreed, so Banglalink and
 *     Robi could never be ingested at all.
 *
 * Everything partner-related now resolves through here.
 */
import type { OwTelco } from "@/modules/marketing/ow-aliases";

/**
 * Live BNII Analytics API. This is the same upstream the team reads when they
 * fill in the OneWave spreadsheet by hand, so it is the source of record — the
 * sheet was only ever a manual copy of it.
 *
 * Defaulted rather than required: an unset env var must not silently disable
 * the only data source.
 */
export const BNII_API_BASE_URL =
  "https://bnii-analytics-api-epgxydm2fa-as.a.run.app";

export interface BniiPartner {
  /** OneWave telco slug — also the persisted `ow_daily_metrics.telco` value. */
  slug: OwTelco;
  /** Display name, as shown in Partner Workspaces. */
  name: string;
  /** BNII partner UUID, required by POST /v1/metrics/query. */
  uuid: string;
  country: string | null;
  subscribers: string | null;
  /**
   * Host telco-app baselines the per-telco view benchmarks OneWave against.
   * Null where no public figure exists; bars needing a baseline simply hide.
   */
  hostDau: number | null;
  hostMau: number | null;
  hostSessionSec: number | null;
}

/**
 * The nine live BNII partners.
 *
 * Two naming notes, both load-bearing:
 *   - `ryze` IS Banglalink. The OneWave sheet called it Ryze and Atlas renders
 *     it "Ryze-Banglalink" (WS_NAME_OVERRIDE). The slug stays `ryze` because
 *     existing ow_daily_metrics rows are keyed by it; renaming would orphan
 *     that history.
 *   - Okara is Vietnam, not Pakistan. Atlas's own WS_COUNTRY_OVERRIDE corrects
 *     its database, and the operator console displays Vietnam.
 *
 * Atlas also carries a tenth partner, PreponeBills (Nigeria,
 * 3a305c09-8595-4ef8-85f0-22ee6aeea2b7). It is deliberately absent here
 * because it has never been part of the OneWave telco set; adding it is a
 * one-line change if that becomes wanted.
 */
export const BNII_PARTNERS: BniiPartner[] = [
  {
    slug: "gopay",
    name: "GoPay",
    uuid: "21726d1e-fb08-4fbb-abf9-c51ec7e82740",
    country: "Indonesia",
    subscribers: null,
    hostDau: 1_500_000,
    hostMau: 35_000_000,
    hostSessionSec: 45,
  },
  {
    slug: "dialog",
    name: "Dialog",
    uuid: "cfc7f05b-be8d-495d-8e82-dd0a093936ba",
    country: "Sri Lanka",
    subscribers: "17.6M",
    hostDau: 667_000,
    hostMau: 3_800_000,
    hostSessionSec: 94,
  },
  {
    slug: "ryze",
    name: "Ryze-Banglalink",
    uuid: "2429868c-29fd-4e46-b3b0-47f40b0f55a2",
    country: "Bangladesh",
    subscribers: "40.4M",
    hostDau: null,
    hostMau: null,
    hostSessionSec: null,
  },
  {
    slug: "telkomsel",
    name: "Telkomsel",
    uuid: "9eca1efa-5f28-4a48-b02f-33612832b632",
    country: "Indonesia",
    subscribers: "159.1M",
    hostDau: 5_000_000,
    hostMau: 25_000_000,
    hostSessionSec: 50,
  },
  {
    slug: "okara",
    name: "Okara",
    uuid: "0b1463e7-49b6-4116-b1b1-0ab6a0aafdf6",
    country: "Vietnam",
    subscribers: null,
    hostDau: 250_000,
    hostMau: 1_500_000,
    hostSessionSec: 40,
  },
  {
    slug: "myim3",
    name: "MyIM3",
    uuid: "1460b433-797e-41ce-bd4c-e15a3281f97d",
    country: "Indonesia",
    subscribers: null,
    hostDau: 800_000,
    hostMau: 8_000_000,
    hostSessionSec: 35,
  },
  {
    slug: "bima",
    name: "Bima",
    uuid: "caa39a26-21c4-4c64-89a3-5ad120249d51",
    country: "Indonesia",
    subscribers: null,
    hostDau: 600_000,
    hostMau: 4_000_000,
    hostSessionSec: 40,
  },
  {
    slug: "u9",
    name: "U9",
    uuid: "22299932-3e1f-422e-b024-0ed31f366c91",
    country: "Myanmar",
    subscribers: null,
    hostDau: 950_000,
    hostMau: 2_300_000,
    hostSessionSec: 60,
  },
  {
    slug: "robi",
    name: "Robi (My Airtel)",
    uuid: "b2b50938-90c5-4f19-a21d-ecc4e8b381a3",
    country: "Bangladesh",
    subscribers: "57.0M",
    hostDau: null,
    hostMau: null,
    hostSessionSec: null,
  },
];

export const PARTNER_BY_SLUG = new Map(BNII_PARTNERS.map((p) => [p.slug, p]));
export const PARTNER_BY_UUID = new Map(BNII_PARTNERS.map((p) => [p.uuid, p]));

/** The base URL to query, honouring an override. */
export function bniiBaseUrl(): string {
  const raw = process.env.MARKETING_ANALYTICS_API_URL?.trim();
  return (raw || BNII_API_BASE_URL).replace(/\/+$/, "");
}

/**
 * Parse a `MARKETING_ANALYTICS_PARTNER_IDS` override into uuid → slug.
 *
 * Accepts BOTH historical shapes, because the two modules disagreed about
 * which one was correct and picking either would have silently broken the
 * other:
 *   - `slug:uuid,slug:uuid`
 *   - JSON `{"<slug or display name>": "<uuid>"}`
 *
 * Unknown slugs warn rather than being dropped in silence. An empty or
 * unparseable value yields no entries, and callers fall back to the registry.
 */
export function parsePartnerOverrides(raw: string | undefined): {
  byUuid: Map<string, OwTelco>;
  warnings: string[];
} {
  const byUuid = new Map<string, OwTelco>();
  const warnings: string[] = [];
  const trimmed = raw?.trim();
  if (!trimmed) return { byUuid, warnings };

  // Resolve a label to a known slug: the slug itself, or a display name.
  const toSlug = (label: string): OwTelco | null => {
    const key = label.trim().toLowerCase();
    if (PARTNER_BY_SLUG.has(key as OwTelco)) return key as OwTelco;
    const byName = BNII_PARTNERS.find((p) => p.name.toLowerCase() === key);
    return byName?.slug ?? null;
  };

  const add = (label: string, uuid: string) => {
    const slug = toSlug(label);
    if (!slug) {
      warnings.push(`unknown telco "${label}" (skipped)`);
      return;
    }
    if (!uuid.trim()) {
      warnings.push(`telco "${label}" has no uuid (skipped)`);
      return;
    }
    byUuid.set(uuid.trim(), slug);
  };

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      for (const [label, uuid] of Object.entries(parsed)) {
        if (typeof uuid === "string") add(label, uuid);
        else warnings.push(`telco "${label}" uuid is not a string (skipped)`);
      }
    } catch {
      warnings.push("MARKETING_ANALYTICS_PARTNER_IDS is not valid JSON");
    }
    return { byUuid, warnings };
  }

  for (const part of trimmed.split(",")) {
    const entry = part.trim();
    if (!entry) continue;
    const idx = entry.indexOf(":");
    if (idx <= 0) {
      warnings.push(`partner entry not slug:uuid — "${entry}"`);
      continue;
    }
    add(entry.slice(0, idx), entry.slice(idx + 1));
  }
  return { byUuid, warnings };
}

/**
 * The uuid → slug map to query with: the env override when one is set and
 * usable, otherwise every registered partner.
 */
export function activePartnerMap(): {
  byUuid: Map<string, OwTelco>;
  warnings: string[];
} {
  const { byUuid, warnings } = parsePartnerOverrides(
    process.env.MARKETING_ANALYTICS_PARTNER_IDS,
  );
  if (byUuid.size > 0) return { byUuid, warnings };
  return {
    byUuid: new Map(BNII_PARTNERS.map((p) => [p.uuid, p.slug])),
    warnings,
  };
}
