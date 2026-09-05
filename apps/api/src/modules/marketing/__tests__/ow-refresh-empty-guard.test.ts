// Guards refreshSnapshot() against clobbering a good snapshot with an empty
// ingest (transient outage) — see marketing.service.ts refreshSnapshot.
//
// The analytics API is now the only source, so the ingest is module-mocked to
// return nothing. Previously this drove the sheet path to get an empty result;
// without the mock the test would make a real network call.
import { afterEach, describe, expect, it, vi } from "vitest";

import { marketingRepository } from "../marketing.repository";
import { marketingService } from "../marketing.service";

vi.mock("../ow-analytics-api.service", () => ({
  ingestAnalyticsApi: vi.fn(async () => ({
    metrics: [],
    rawTabs: [],
    telcos: [],
    warnings: ["upstream unavailable"],
    fetchedAt: new Date().toISOString(),
  })),
}));

describe("refreshSnapshot — empty-ingest guard", () => {
  const OLD = { ...process.env };

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...OLD };
  });

  it("retains the last good snapshot instead of overwriting with an empty payload", async () => {
    vi.spyOn(marketingRepository, "getLatestSnapshot").mockResolvedValue({
      payload: { metricCount: 5, marker: "old" },
    } as never);
    const createSnapshot = vi
      .spyOn(marketingRepository, "createSnapshot")
      .mockResolvedValue({} as never);

    const result = await marketingService.refreshSnapshot();

    expect(createSnapshot).not.toHaveBeenCalled();
    expect(result).toEqual({ metricCount: 5, marker: "old" });
  });

  it("writes the empty payload on a genuine cold start (no prior snapshot)", async () => {
    vi.spyOn(marketingRepository, "getLatestSnapshot").mockResolvedValue(
      null as never,
    );
    const createSnapshot = vi
      .spyOn(marketingRepository, "createSnapshot")
      .mockResolvedValue({} as never);

    await marketingService.refreshSnapshot();

    expect(createSnapshot).toHaveBeenCalledTimes(1);
  });
});
