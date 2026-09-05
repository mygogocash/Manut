import { NotFoundException } from "@/common/exceptions/http-exception";
import { logger } from "@/common/utils/logger";
import {
  createSignedUrl,
  parseStorageUrl,
} from "@/infrastructure/storage/supabase-storage";
import { marketingRepository } from "@/modules/marketing/marketing.repository";
import type {
  CreateMarketingCampaignInput,
  MarketingCampaignQuery,
  UpdateMarketingCampaignInput,
} from "@/modules/marketing/marketing.validation";
import { ingestAnalyticsApi } from "@/modules/marketing/ow-analytics-api.service";

// OW holistic snapshot freshness. The cron is the primary writer; an
// on-read refresh past this TTL keeps the dashboard from going blank.
const OW_SNAPSHOT_TTL_MS = 6 * 60 * 60 * 1000; // 6h

// Treat empty string the same as "no file" so clearing the field in the
// form (which may submit "") doesn't persist a bogus URL.
function normalizeUrl(value: string | null | undefined): string | null {
  if (value === undefined) return null;
  if (value === null || value.trim() === "") return null;
  return value;
}

// ── OW2.0 traction grid ─────────────────────────────────
// Sourced from the BNII Analytics API. This used to read the OW2.0 traction
// spreadsheet live on each dashboard load; the sheet was a manual transcription
// of this same API, so it has been removed rather than kept as a second source
// of truth that could disagree with the first.
interface TractionData {
  headers: string[];
  rows: string[][];
  range: string;
  fetchedAt: string;
}

/**
 * The traction grid the dashboard renders.
 *
 * `forceFresh` is accepted for call-site compatibility but no longer changes
 * anything: the grid is derived from the stored snapshot, and `?fresh=1`
 * already re-runs the ingest upstream of this via `refreshSnapshot`.
 */
async function getTraction(_forceFresh: boolean): Promise<TractionData | null> {
  return buildApiTraction();
}

// API-source traction: latest-per-telco grid built from the most recent
// analytics-API snapshot's rawTabs (no live Sheets read, no BigInt).
// Owns its own failure (mirrors the sheet branch's try/catch in
// getTraction): a transient DB read (e.g. Prisma P1001) must not 500 the
// whole dashboard — log it and fall back to null. Exported for unit tests.
export async function buildApiTraction(): Promise<TractionData | null> {
  try {
    const snap = await marketingRepository.getLatestSnapshot();
    const payload = snap?.payload as
      | {
          rawTabs?: Array<{
            telco: string | null;
            headers: string[];
            rows: string[][];
          }>;
        }
      | undefined;
    const tabs = payload?.rawTabs ?? [];
    if (tabs.length === 0) return null;
    const headers = ["telco", ...(tabs[0]!.headers ?? [])];
    const rows = tabs.map((t) => {
      const last = t.rows[t.rows.length - 1] ?? [];
      return [t.telco ?? "", ...last];
    });
    return {
      headers,
      rows,
      range: "analytics-api",
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.error(
      `OW analytics traction build failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

export class MarketingService {
  async list(query: MarketingCampaignQuery) {
    const { page, limit, ...filters } = query;
    const { data, total } = await marketingRepository.findMany(
      filters,
      page,
      limit,
    );
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    const row = await marketingRepository.findById(id);
    if (!row) throw new NotFoundException("Campaign not found");
    return row;
  }

  /**
   * OneWave dashboard payload: campaign-derived metrics + the live OW2.0
   * traction grid (null when the sheet sync isn't configured). Pass
   * `forceFresh` to bypass the traction cache (the UI's Refresh button).
   */
  async dashboard(forceFresh = false) {
    const rows = await marketingRepository.findAllForDashboard();
    const now = new Date();
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    const statusBreakdown: Record<string, number> = {
      planned: 0,
      live: 0,
      completed: 0,
      cancelled: 0,
    };
    let totalHours = 0;
    for (const r of rows) {
      statusBreakdown[r.status] = (statusBreakdown[r.status] ?? 0) + 1;
      if (typeof r.hours === "number") totalHours += r.hours;
    }

    const future = rows
      .filter((r) => new Date(r.campaignDate) >= todayStart)
      .sort(
        (a, b) =>
          new Date(a.campaignDate).getTime() -
          new Date(b.campaignDate).getTime(),
      );

    // Trailing 12-month campaign counts, oldest → newest, for the cadence
    // exhibit. Bucket keys are UTC `YYYY-MM`.
    const monthly: Array<{ month: string; count: number }> = [];
    const buckets = new Map<string, number>();
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
      );
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      buckets.set(key, 0);
      monthly.push({ month: key, count: 0 });
    }
    for (const r of rows) {
      const d = new Date(r.campaignDate);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    for (const m of monthly) m.count = buckets.get(m.month) ?? 0;

    return {
      totalCampaigns: rows.length,
      upcomingCount: future.length,
      liveCount: statusBreakdown.live ?? 0,
      totalHours,
      statusBreakdown,
      monthly,
      upcoming: future.slice(0, 8),
      // Live OW2.0 traction grid (null when the sheet sync is unconfigured).
      traction: await getTraction(forceFresh),
    };
  }

  // ── OW Holistic Dashboard (P1 — facts foundation) ────────────
  // Snapshot considered stale after this; a read past TTL (or ?fresh=1)
  // triggers a refresh. The /api/cron/ow-snapshot-refresh job is the
  // primary writer; this on-read refresh is a fallback so the dashboard
  // is never blank on first load.
  async refreshSnapshot() {
    const ingest = await ingestAnalyticsApi();
    if (ingest.metrics.length > 0) {
      await marketingRepository.upsertDailyMetrics(
        ingest.metrics.map((m) => ({
          date: new Date(`${m.date}T00:00:00.000Z`),
          telco: m.telco,
          values: m.values as Record<string, number>,
          txMetrics: m.txMetrics,
          isIntraday: m.isIntraday,
          sourceTab: m.sourceTab,
        })),
      );
    }
    const payload = {
      generatedAt: ingest.fetchedAt,
      telcos: ingest.telcos,
      rawTabs: ingest.rawTabs,
      warnings: ingest.warnings,
      metricCount: ingest.metrics.length,
    };
    // Transient-outage guard: an empty ingest must not overwrite a good
    // snapshot (that would blank the dashboard and reset the freshness
    // TTL, suppressing retries). A genuine cold start (no prior snapshot)
    // still writes the empty payload so the dashboard isn't null forever.
    if (ingest.metrics.length === 0) {
      const existing = await marketingRepository.getLatestSnapshot();
      if (existing) {
        logger.warn(
          "OW refresh produced 0 metrics; retaining last good snapshot",
        );
        return existing.payload;
      }
    }
    await marketingRepository.createSnapshot(payload);
    return payload;
  }

  async holisticDashboard(forceFresh = false) {
    let snap = await marketingRepository.getLatestSnapshot();
    const stale =
      !snap ||
      Date.now() - new Date(snap.generatedAt).getTime() > OW_SNAPSHOT_TTL_MS;
    if (forceFresh || stale) {
      try {
        await this.refreshSnapshot();
        snap = await marketingRepository.getLatestSnapshot();
      } catch (err) {
        // A flaky sheet / DB never blanks the dashboard — serve the last
        // good snapshot (possibly null on a cold start).
        logger.error(
          `OW snapshot refresh failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    const campaigns = await marketingRepository.findCampaignsWithFullDetail();
    return {
      snapshot: snap?.payload ?? null,
      narrative: snap?.narrative ?? null,
      generatedAt: snap?.generatedAt?.toISOString() ?? null,
      campaigns,
    };
  }

  async create(input: CreateMarketingCampaignInput, actorId: string) {
    return marketingRepository.create({
      title: input.title,
      campaignDate: new Date(input.campaignDate),
      hours: input.hours ?? undefined,
      leversPulled: input.leversPulled ?? undefined,
      copyDesign: input.copyDesign ?? undefined,
      predictionFileUrl: normalizeUrl(input.predictionFileUrl) ?? undefined,
      predictionFileName: input.predictionFileName ?? undefined,
      status: input.status ?? undefined,
      addedBy: actorId,
    });
  }

  async update(id: string, input: UpdateMarketingCampaignInput) {
    await this.getById(id);
    return marketingRepository.update(id, {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.campaignDate !== undefined && {
        campaignDate: new Date(input.campaignDate),
      }),
      ...(input.hours !== undefined && { hours: input.hours }),
      ...(input.leversPulled !== undefined && {
        leversPulled: input.leversPulled,
      }),
      ...(input.copyDesign !== undefined && { copyDesign: input.copyDesign }),
      ...(input.predictionFileUrl !== undefined && {
        predictionFileUrl: normalizeUrl(input.predictionFileUrl),
      }),
      ...(input.predictionFileName !== undefined && {
        predictionFileName: input.predictionFileName,
      }),
      ...(input.status !== undefined && { status: input.status }),
    });
  }

  async delete(id: string) {
    await this.getById(id);
    return marketingRepository.delete(id);
  }

  /**
   * Mint a short-lived signed URL for the campaign's prediction xlsx.
   * The file lives in the private `documents` bucket, so the stored
   * public URL is unreachable — re-sign on demand (mirrors the hrms
   * agreements download pattern).
   */
  async getPredictionDownloadUrl(id: string) {
    const row = await this.getById(id);
    if (!row.predictionFileUrl) {
      throw new NotFoundException("No prediction file on this campaign");
    }
    const parsed = parseStorageUrl(row.predictionFileUrl);
    if (!parsed) {
      throw new NotFoundException("Prediction file location is invalid");
    }
    const url = await createSignedUrl(parsed.bucket, parsed.path, 300);
    return { url, fileName: row.predictionFileName };
  }
}

export const marketingService = new MarketingService();
