import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client';

import { PromptService } from '../../copilot/prompt/service';
import { CopilotProviderFactory } from '../../copilot/providers/factory';
import { BudgetService } from './budget.service';

const ESTIMATED_COST_USD = 0.02; // gemini-2.5-flash, ~3K in / 0.5K out
const PROMPT_NAME = 'Analytics: Trend Detection';
const NO_TREND_MARKER = 'NO_TREND';

const PRICING_FLASH = {
  inputPerMTokens: 0.075,
  outputPerMTokens: 0.3,
};

/**
 * Hourly trend detector per PRD §7. gemini-2.5-flash on the last 24h of
 * metrics with 7-day baseline deltas. Emits a SocialInsight only when the
 * model finds a meaningful (>15%) trend; otherwise stays silent.
 */
@Injectable()
export class TrendDetectorService {
  private readonly logger = new Logger(TrendDetectorService.name);

  constructor(
    private readonly db: PrismaClient,
    private readonly budget: BudgetService,
    private readonly promptService: PromptService,
    private readonly providerFactory: CopilotProviderFactory
  ) {}

  // Hourly — top of the hour. Idempotent: a no-trend tick simply doesn't
  // write a row, so re-runs are cheap.
  @Cron('0 * * * *')
  async run(): Promise<void> {
    try {
      await this.detectAll();
    } catch (err) {
      this.logger.error('TrendDetectorService.run failed', err);
    }
  }

  /**
   * Run detection across every workspace that has at least one ACTIVE
   * SocialConnection. Public so the cron tick can be invoked from a test
   * harness without waiting for the scheduler.
   */
  async detectAll(): Promise<void> {
    const workspaces = await this.db.socialConnection
      .findMany({
        where: { status: 'ACTIVE' },
        select: { workspaceId: true },
        distinct: ['workspaceId'],
      })
      .then(rows => rows.map(r => r.workspaceId));

    for (const workspaceId of workspaces) {
      try {
        await this.detectForWorkspace(workspaceId);
      } catch (err) {
        this.logger.warn(
          `TrendDetectorService.detectForWorkspace failed for ${workspaceId}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  /**
   * Single-workspace tick. Skip silently if budget exceeded. Emit nothing
   * if the model returns NO_TREND (the prompt's escape hatch).
   */
  async detectForWorkspace(workspaceId: string): Promise<void> {
    const allowed = await this.budget.canSpend(workspaceId, ESTIMATED_COST_USD);
    if (!allowed) {
      this.logger.debug(
        `TrendDetectorService: budget exceeded for workspace ${workspaceId}, skipping`
      );
      return;
    }

    const deltas = await this.computeDeltas(workspaceId);
    if (deltas.length === 0) {
      // No data → no point spending tokens.
      return;
    }

    const prompt = await this.promptService.get(PROMPT_NAME);
    if (!prompt) {
      this.logger.warn(`Prompt not found: ${PROMPT_NAME}`);
      return;
    }
    const provider = await this.providerFactory.getProviderByModel(prompt.model);
    if (!provider) {
      this.logger.warn(`No provider for model ${prompt.model}`);
      return;
    }

    const content = renderDeltas(deltas);
    const messages = prompt.finish({ content });

    const body = await provider.text({ modelId: prompt.model }, messages);
    const trimmed = body.trim();

    // Always record cost — the call happened either way.
    const inputTokens = Math.ceil(
      messages.map(m => m.content).join('\n').length / 4
    );
    const outputTokens = Math.ceil(body.length / 4);
    const costUsd =
      (inputTokens * PRICING_FLASH.inputPerMTokens +
        outputTokens * PRICING_FLASH.outputPerMTokens) /
      1_000_000;
    await this.budget.record(workspaceId, costUsd);

    if (trimmed === NO_TREND_MARKER || trimmed.startsWith(NO_TREND_MARKER)) {
      // Model is telling us nothing meaningful happened. Skip insight.
      return;
    }

    const platforms = Array.from(new Set(deltas.map(d => d.platform)));

    await this.db.socialInsight.create({
      data: {
        workspaceId,
        insightType: 'TREND',
        platforms: platforms as never[],
        title: 'Hourly trend detected',
        body: trimmed,
        severity: 'INFO',
        modelUsed: prompt.model,
        costUsd,
      },
    });

    this.logger.log(
      `Created TREND insight for workspace ${workspaceId} ($${costUsd.toFixed(4)})`
    );
  }

  /**
   * Compute top-5 deltas per platform: latest-24h HOUR avg vs 7-day DAY avg.
   * We return a flat list across platforms; the prompt receives a small,
   * dense payload regardless of how many platforms are connected.
   */
  private async computeDeltas(workspaceId: string): Promise<
    Array<{
      platform: string;
      metricKey: string;
      latest24h: number;
      baseline7d: number;
      deltaPct: number;
    }>
  > {
    const now = Date.now();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const recent = await this.db.socialMetric.findMany({
      where: {
        workspaceId,
        bucket: 'HOUR',
        bucketStart: { gte: oneDayAgo },
      },
    });
    const baseline = await this.db.socialMetric.findMany({
      where: {
        workspaceId,
        bucket: 'DAY',
        bucketStart: { gte: sevenDaysAgo, lt: oneDayAgo },
      },
    });

    // Index baseline by (platform, metricKey).
    const baselineAvg = new Map<string, { sum: number; n: number }>();
    for (const b of baseline) {
      const key = `${b.platform}::${b.metricKey}`;
      const cur = baselineAvg.get(key) ?? { sum: 0, n: 0 };
      cur.sum += b.value;
      cur.n += 1;
      baselineAvg.set(key, cur);
    }

    const recentAvg = new Map<string, { sum: number; n: number }>();
    for (const r of recent) {
      const key = `${r.platform}::${r.metricKey}`;
      const cur = recentAvg.get(key) ?? { sum: 0, n: 0 };
      cur.sum += r.value;
      cur.n += 1;
      recentAvg.set(key, cur);
    }

    const allDeltas: Array<{
      platform: string;
      metricKey: string;
      latest24h: number;
      baseline7d: number;
      deltaPct: number;
    }> = [];

    for (const [key, recentEntry] of recentAvg) {
      const [platform, metricKey] = key.split('::');
      const baselineEntry = baselineAvg.get(key);
      if (!baselineEntry || baselineEntry.n === 0) continue;
      const latest = recentEntry.sum / recentEntry.n;
      const base = baselineEntry.sum / baselineEntry.n;
      if (base === 0) continue;
      const deltaPct = ((latest - base) / base) * 100;
      allDeltas.push({
        platform,
        metricKey,
        latest24h: latest,
        baseline7d: base,
        deltaPct,
      });
    }

    // Top-5 per platform by absolute delta.
    const byPlatform = new Map<string, typeof allDeltas>();
    for (const d of allDeltas) {
      const arr = byPlatform.get(d.platform) ?? [];
      arr.push(d);
      byPlatform.set(d.platform, arr);
    }

    const top: typeof allDeltas = [];
    for (const arr of byPlatform.values()) {
      arr.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));
      for (const d of arr.slice(0, 5)) top.push(d);
    }

    return top;
  }
}

function renderDeltas(
  deltas: Array<{
    platform: string;
    metricKey: string;
    latest24h: number;
    baseline7d: number;
    deltaPct: number;
  }>
): string {
  const lines: string[] = ['# Trend deltas (last 24h vs 7-day baseline)', ''];
  for (const d of deltas) {
    lines.push(
      `- [${d.platform}] ${d.metricKey}: latest_24h=${d.latest24h.toFixed(2)}, baseline_7d=${d.baseline7d.toFixed(2)}, delta_pct=${d.deltaPct.toFixed(1)}%`
    );
  }
  return lines.join('\n');
}
