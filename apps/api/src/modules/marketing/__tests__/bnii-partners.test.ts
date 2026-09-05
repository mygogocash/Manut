import { afterEach, describe, expect, it } from "vitest";

import {
  activePartnerMap,
  BNII_API_BASE_URL,
  BNII_PARTNERS,
  bniiBaseUrl,
  parsePartnerOverrides,
} from "../bnii-partners";
import { OW_TELCOS } from "../ow-aliases";

describe("registry", () => {
  it("covers all nine live BNII partners", () => {
    expect(BNII_PARTNERS).toHaveLength(9);
  });

  it("has a telco slug for every partner and vice versa", () => {
    // These two lists disagreeing is what made Banglalink and Robi
    // permanently un-ingestable before.
    const slugs = new Set(BNII_PARTNERS.map((p) => p.slug));
    const telcos = new Set<string>(OW_TELCOS);
    for (const s of slugs) expect(telcos.has(s)).toBe(true);
    for (const t of telcos) expect(slugs.has(t as never)).toBe(true);
  });

  it("keeps ryze as the slug for Banglalink so history is not orphaned", () => {
    const ryze = BNII_PARTNERS.find((p) => p.slug === "ryze");
    expect(ryze?.name).toBe("Ryze-Banglalink");
    expect(ryze?.uuid).toBe("2429868c-29fd-4e46-b3b0-47f40b0f55a2");
  });

  it("has unique uuids", () => {
    expect(new Set(BNII_PARTNERS.map((p) => p.uuid)).size).toBe(
      BNII_PARTNERS.length,
    );
  });
});

describe("bniiBaseUrl", () => {
  const OLD = { ...process.env };
  afterEach(() => {
    process.env = { ...OLD };
  });

  it("defaults to the live API so an unset var cannot disable the only source", () => {
    delete process.env.MARKETING_ANALYTICS_API_URL;
    expect(bniiBaseUrl()).toBe(BNII_API_BASE_URL);
  });

  it("honours an override and strips trailing slashes", () => {
    process.env.MARKETING_ANALYTICS_API_URL = "https://example.test/api///";
    expect(bniiBaseUrl()).toBe("https://example.test/api");
  });
});

describe("parsePartnerOverrides", () => {
  // The two marketing modules previously disagreed on this format, and
  // whichever shape you set, the other silently degraded. Both must work.
  it("accepts slug:uuid pairs", () => {
    const { byUuid } = parsePartnerOverrides("gopay:u1,dialog:u2");
    expect(byUuid.get("u1")).toBe("gopay");
    expect(byUuid.get("u2")).toBe("dialog");
  });

  it("accepts JSON keyed by slug", () => {
    const { byUuid } = parsePartnerOverrides('{"gopay":"u1","u9":"u2"}');
    expect(byUuid.get("u1")).toBe("gopay");
    expect(byUuid.get("u2")).toBe("u9");
  });

  it("accepts JSON keyed by DISPLAY NAME, as the other module wrote it", () => {
    const { byUuid } = parsePartnerOverrides(
      '{"Dialog":"u1","Robi (My Airtel)":"u2"}',
    );
    expect(byUuid.get("u1")).toBe("dialog");
    expect(byUuid.get("u2")).toBe("robi");
  });

  it("warns on an unknown telco rather than dropping it silently", () => {
    const { byUuid, warnings } = parsePartnerOverrides("gopay:u1,atlantis:u2");
    expect(byUuid.size).toBe(1);
    expect(warnings.some((w) => w.includes("atlantis"))).toBe(true);
  });

  it("warns on malformed pair entries", () => {
    const { warnings } = parsePartnerOverrides("gopay:u1,garbage");
    expect(warnings.some((w) => w.includes("garbage"))).toBe(true);
  });

  it("warns rather than throwing on invalid JSON", () => {
    const { byUuid, warnings } = parsePartnerOverrides("{not json");
    expect(byUuid.size).toBe(0);
    expect(warnings.some((w) => w.includes("valid JSON"))).toBe(true);
  });

  it("stays quiet when unset — that is the normal path, not an error", () => {
    expect(parsePartnerOverrides(undefined).warnings).toEqual([]);
    expect(parsePartnerOverrides("  ").warnings).toEqual([]);
  });
});

describe("activePartnerMap", () => {
  const OLD = { ...process.env };
  afterEach(() => {
    process.env = { ...OLD };
  });

  it("falls back to every registered partner when unset", () => {
    delete process.env.MARKETING_ANALYTICS_PARTNER_IDS;
    const { byUuid } = activePartnerMap();
    expect(byUuid.size).toBe(BNII_PARTNERS.length);
    expect(byUuid.get("22299932-3e1f-422e-b024-0ed31f366c91")).toBe("u9");
  });

  it("uses the override when one resolves", () => {
    process.env.MARKETING_ANALYTICS_PARTNER_IDS = "gopay:only-one";
    const { byUuid } = activePartnerMap();
    expect(byUuid.size).toBe(1);
    expect(byUuid.get("only-one")).toBe("gopay");
  });

  it("falls back to the registry when the override resolves to nothing", () => {
    // A typo in the env var must not silently leave the dashboard with no
    // partners at all — that was the old failure mode.
    process.env.MARKETING_ANALYTICS_PARTNER_IDS = "atlantis:u1";
    expect(activePartnerMap().byUuid.size).toBe(BNII_PARTNERS.length);
  });
});
