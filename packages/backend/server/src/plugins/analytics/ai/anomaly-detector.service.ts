import { Injectable, Logger } from '@nestjs/common';
import type { InsightSeverity, SocialInsight } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

import { CopilotProviderFactory } from '../../copilot/providers/factory';
import { PromptService } from '../../copilot/prompt/service';
import { BudgetService } from './budget.service';

const ESTIMATED_COST_USD = 0.005; // gemini-2.5-flash, ~500 in / 200 out
const PROMPT_NAME = 'Analytics: Anomaly Alert';
const Z_SCORE_THRESHOLD = 3;

const PRICING_FLASH = {
  inputPerMTokens: 0.075,
  outputPerMTokens: 0.3,
};

/**
 * Input shape for `checkMetric`. The ingestion pipeline calls this AFTER
 * persisting a metric so we can z-score it against its 30-day baseline
 * without re-fetching the just-written row.
 */
export interface AnomalyMetricInput {
  workspaceId: string;
  platform: string;
  metricKey: string;
  value: number;
  occurredAt: Date;
  /**
   * Optional context blob — recent campaign launches, scheduled posts, etc.
   * Helps the model differentiate "campaign just launched" from "engineering
   * regression". Free-form string; capped at 1KB before being sent.
   */
  context?: string;
}

/**
 * Real-time anomaly detection per PRD §7. Triggered when a metric crosses a
 * z-score > 3 vs its 30-day mean. Emits an ANOMALY SocialInsight via
 * gemini-2.5-flash with a 200-token explanation + suggested action.
 *
 * Wiring: IngestionService.normalizeAndStore SHOULD call `checkMetric` after
 * each metric write (Round D wires this — see analytics.module wiring TODO).
 */
@Injectable()
export class AnomalyDetectorService {
  private readonly logger = new Logger(AnomalyDetectorService.name);

  constructor(
    private readonly db: PrismaClient,
    private readonly budget: BudgetService,
    private readonly promptService: PromptService,
    private readonly providerFactory: CopilotProviderFactory
  ) {}

  /**
   * Score a single metric against its 30-day baseline. Returns the persisted
   * SocialInsight if an anomaly was detected and a prompt was successfully
   * fired; otherwise returns null (no insight, no cost recorded).
   *
   * Side-effect-free in the common path (most metrics are not anomalous, so
   * we return null without touching the budget or insight table).
   */
  async checkMetric(
    metric: AnomalyMetricInput
  ): Promise<SocialInsight | null> {
    const stats = await this.computeBaseline(metric);
    if (!stats) return null;

    const z = (metric.value - stats.mean) / stats.stddev;
    if (Math.abs(z) <= Z_SCORE_THRESHOLD) {
      return null;
    }

    // Anomaly. Gate on budget BEFORE calling the model.
    const allowed = await this.budget.canSpend(
      metric.workspaceId,
      ESTIMATED_COST_USD
    );
    if (!allowed) {
      this.logger.debug(
        `AnomalyDetectorService: budget exceeded for workspace ${metric.workspaceId}, skipping (z=${z.toFixed(2)})`
      );
      return null;
    }

    const prompt = await this.promptService.get(PROMPT_NAME);
    if (!prompt) {
      this.logger.warn(`Prompt not found: ${PROMPT_NAME}`);
      return null;
    }
    const provider = await this.providerFactory.getProviderByModel(prompt.model);
    if (!provider) {
      this.logger.warn(`No provider for model ${prompt.model}`);
      return null;
    }

    const content = renderAnomalyPayload({ metric, stats, z });
    const messages = prompt.finish({ content });

    const body = await provider.text({ modelId: prompt.model }, messages);

    const inputTokens = Math.ceil(
      messages.map(m => m.content).join('\n').length / 4
    );
    const outputTokens = Math.ceil(body.length / 4);
    const costUsd =
      (inputTokens * PRICING_FLASH.inputPerMTokens +
        outputTokens * PRICING_FLASH.outputPerMTokens) /
      1_000_000;
    await this.budget.record(metric.workspaceId, costUsd);

    const severity = parseSeverity(body);

    const insight = await this.db.socialInsight.create({
      data: {
        workspaceId: metric.workspaceId,
        insightType: 'ANOMALY',
        platforms: [metric.platform as never],
        title: `Anomaly: ${metric.metricKey} on ${metric.platform}`,
        body,
        severity,
        modelUsed: prompt.model,
        costUsd,
      },
    });

    this.logger.log(
      `Created ANOMALY insight (${severity}) for workspace ${metric.workspaceId} on ${metric.platform}/${metric.metricKey} z=${z.toFixed(2)} ($${costUsd.toFixed(4)})`
    );

    return insight;
  }

  /**
   * 30-day mean + stddev of the same (workspace, platform, metricKey,
   * bucket=HOUR) series. Returns null when we don't have enough data points
   * to compute a stable stddev (n < 5 or stddev = 0 — flat line).
   */
  private async computeBaseline(metric: AnomalyMetricInput): Promise<{
    mean: number;
    stddev: number;
    n: number;
  } | null> {
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    );

    const rows = await this.db.socialMetric.findMany({
      where: {
        workspaceId: metric.workspaceId,
        platform: metric.platform as never,
        metricKey: metric.metricKey,
        bucket: 'HOUR',
        bucketStart: { gte: thirtyDaysAgo, lt: metric.occurredAt },
      },
      select: { value: true },
    });

    const n = rows.length;
    if (n < 5) return null;

    const mean = rows.reduce((s, r) => s + r.value, 0) / n;
    const variance =
      rows.reduce((s, r) => s + (r.value - mean) ** 2, 0) / n;
    const stddev = Math.sqrt(variance);
    if (stddev === 0) return null;

    return { mean, stddev, n };
  }
}

function renderAnomalyPayload(args: {
  metric: AnomalyMetricInput;
  stats: { mean: number; stddev: number; n: number };
  z: number;
}): string {
  const { metric, stats, z } = args;
  const lines: string[] = [
    `metric: ${metric.metricKey}`,
    `platform: ${metric.platform}`,
    `current_value: ${metric.value}`,
    `baseline_mean_30d: ${stats.mean.toFixed(4)}`,
    `baseline_stddev_30d: ${stats.stddev.toFixed(4)}`,
    `baseline_sample_size: ${stats.n}`,
    `z_score: ${z.toFixed(2)}`,
    `occurred_at: ${metric.occurredAt.toISOString()}`,
  ];
  if (metric.context) {
    const trimmed = metric.context.slice(0, 1024);
    lines.push('');
    lines.push(`recent_context: ${trimmed}`);
  }
  return lines.join('\n');
}

function parseSeverity(body: string): InsightSeverity {
  // Prompt contract: first line is the severity token.
  const firstLine = body.split('\n', 1)[0]?.trim().toUpperCase() ?? '';
  if (firstLine === 'ACTION_REQUIRED') return 'ACTION_REQUIRED';
  if (firstLine === 'NOTABLE') return 'NOTABLE';
  return 'INFO';
}
