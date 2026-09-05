import { afterEach, describe, expect, it, vi } from "vitest";

import { marketingRepository } from "../marketing.repository";
import { buildApiTraction } from "../marketing.service";

describe("buildApiTraction", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds a latest-per-telco grid from the snapshot's rawTabs", async () => {
    vi.spyOn(marketingRepository, "getLatestSnapshot").mockResolvedValue({
      payload: {
        rawTabs: [
          {
            telco: "gopay",
            headers: ["date", "dauCrm"],
            rows: [
              ["2026-05-11", "90"],
              ["2026-05-12", "100"],
            ],
          },
        ],
      },
    } as never);

    const result = await buildApiTraction();

    expect(result).not.toBeNull();
    expect(result!.headers[0]).toBe("telco");
    expect(result!.rows[0][0]).toBe("gopay");
    // Uses the LAST row of the tab, not the first.
    expect(result!.rows[0]).toContain("100");
    expect(result!.rows[0]).not.toContain("90");
  });

  it("returns null when there are no rawTabs", async () => {
    vi.spyOn(marketingRepository, "getLatestSnapshot").mockResolvedValue({
      payload: { rawTabs: [] },
    } as never);

    expect(await buildApiTraction()).toBeNull();
  });

  it("returns null when the snapshot itself is missing", async () => {
    vi.spyOn(marketingRepository, "getLatestSnapshot").mockResolvedValue(
      null as never,
    );

    expect(await buildApiTraction()).toBeNull();
  });

  it("resolves to null (never throws) on a transient DB error", async () => {
    vi.spyOn(marketingRepository, "getLatestSnapshot").mockRejectedValue(
      new Error("P1001"),
    );

    await expect(buildApiTraction()).resolves.toBeNull();
  });
});
