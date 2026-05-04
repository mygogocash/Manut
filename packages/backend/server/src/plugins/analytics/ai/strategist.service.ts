import { Injectable, Logger } from '@nestjs/common';
import type { SocialInsight } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

import { PromptService } from '../../copilot/prompt/service';
import { CopilotProviderFactory } from '../../copilot/providers/factory';
import { BudgetService } from './budget.service';

/**
 * Per-million-token pricing in USD. We use these to estimate pre-flight
 * spend (for the canSpend gate) and to record the actual cost after a call
 * completes. Numbers track Vertex AI's published rates for the on-demand
 * tier; revisit if Google changes them.
 *
 * gpt-* is intentionally excluded — Superflow's Vertex stack doesn't route it
 * (CLAUDE.md §5d) and we'd rather see an error than a silent fallback.
 */
const PRICING: Record<string, { inputPerMTokens: number; outputPerMTokens: number }> = {
  'claude-sonnet-4-5@20250929': { inputPerMTokens: 3, outputPerMTokens: 15 },
  'gemini-2.5-flash': { inputPerMTokens: 0.075, outputPerMTokens: 0.3 },
  'gemini-2.5-pro': { inputPerMTokens: 1.25, outputPerMTokens: 10 },
};

/**
 * Pre-flight cost estimates (USD) per prompt. We use these for the
 * BudgetService.canSpend() gate so a runaway loop can't drain the cap.
 * Real numbers track PRD §7.
 */
const ESTIMATED_COST_USD = {
  weeklyStrategy: 0.5, // claude-sonnet-4.5 at ~30K in / 1.5K out
  contentRecommendation: 0.05, // gemini-2.5-flash at ~3K in / 0.5K out
};

const MAX_INPUT_CHARS = 30_000 * 4; // ~30K tokens at 4 chars/token

/**
 * Thrown when the workspace has hit its monthly hard cap. Resolver maps this
 * to a user-facing error.
 */
export class BudgetExceededError extends Error {
  constructor(workspaceId: string, public readonly model: string) {
    super(
      `Analytics AI budget exceeded for workspace ${workspaceId} — refusing ${model} call`
    );
    this.name = 'BudgetExceededError';
  }
}

/**
 * AI Strategist — produces the `Analytics: Weekly Strategy` insight per PRD §7.
 * Sundays 06:00 (workspace TZ), claude-sonnet-4.5, ~30K in / 1.5K out.
 *
 * Wired to the existing copilot Vertex providers — no new providers needed
 * (CLAUDE.md §5d). Prompts are upserted at server bootstrap from prompts.ts
 * (CLAUDE.md §5c).
 */
@Injectable()
export class StrategistService {
  private readonly logger = new Logger(StrategistService.name);

  constructor(
    private readonly db: PrismaClient,
    private readonly budget: BudgetService,
    private readonly promptService: PromptService,
    private readonly providerFactory: CopilotProviderFactory
  ) {}

  /**
   * Generate the weekly strategy insight: 7 days of metrics + top events
   * across all platforms, summarized into a 1500-token markdown report by
   * claude-sonnet-4.5.
   */
  async generateWeeklyStrategy(workspaceId: string): Promise<SocialInsight> {
    return await this.runPrompt({
      workspaceId,
      promptName: 'Analytics: Weekly Strategy',
      insightType: 'WEEKLY_STRATEGY',
      title: 'Weekly strategy report',
      estimatedCostUsd: ESTIMATED_COST_USD.weeklyStrategy,
      buildInput: () => this.buildWeeklyContext(workspaceId),
    });
  }

  /**
   * Generate a content recommendation insight from the last 30 days of
   * top-performing posts. Tone is optional — if omitted, the prompt picks
   * the dominant tone of the top performers.
   */
  async generateContentRecommendation(
    workspaceId: string,
    tone?: string
  ): Promise<SocialInsight> {
    return await this.runPrompt({
      workspaceId,
      promptName: 'Analytics: Content Recommendation',
      insightType: 'RECOMMENDATION',
      title: 'Content recommendations',
      estimatedCostUsd: ESTIMATED_COST_USD.contentRecommendation,
      buildInput: () => this.buildRecommendationContext(workspaceId, tone),
    });
  }

  /**
   * Shared pipeline: budget check → context build → prompt call → cost
   * record → SocialInsight persist. Returns the persisted row.
   */
  private async runPrompt(args: {
    workspaceId: string;
    promptName: string;
    insightType: 'WEEKLY_STRATEGY' | 'RECOMMENDATION';
    title: string;
    estimatedCostUsd: number;
    buildInput: () => Promise<{ content: string; platforms: string[] }>;
  }): Promise<SocialInsight> {
    const { workspaceId, promptName, insightType, title, estimatedCostUsd } =
      args;

    const allowed = await this.budget.canSpend(workspaceId, estimatedCostUsd);
    if (!allowed) {
      throw new BudgetExceededError(workspaceId, promptName);
    }

    const prompt = await this.promptService.get(promptName);
    if (!prompt) {
      throw new Error(`Prompt not found: ${promptName}`);
    }
    const provider = await this.providerFactory.getProviderByModel(prompt.model);
    if (!provider) {
      throw new Error(
        `No provider available for model ${prompt.model} (prompt ${promptName})`
      );
    }

    const { content, platforms } = await args.buildInput();
    const trimmedContent = truncateToChars(content, MAX_INPUT_CHARS);

    const messages = prompt.finish({ content: trimmedContent });

    const body = await provider.text({ modelId: prompt.model }, messages);

    // We don't get usage tokens back from provider.text(), so we estimate
    // cost from char counts at 4 chars/token. Tightening this later means
    // threading usage through the provider abstraction — out of scope here.
    const inputTokens = estimateTokens(
      messages.map(m => m.content).join('\n')
    );
    const outputTokens = estimateTokens(body);
    const costUsd = computeCost(prompt.model, inputTokens, outputTokens);

    await this.budget.record(workspaceId, costUsd);

    const insight = await this.db.socialInsight.create({
      data: {
        workspaceId,
        insightType,
        platforms: platforms as never[], // Prisma SocialPlatform[] — values pre-validated
        title,
        body,
        severity: 'INFO',
        modelUsed: prompt.model,
        costUsd,
      },
    });

    this.logger.log(
      `Created ${insightType} insight for workspace ${workspaceId} via ${prompt.model} ($${costUsd.toFixed(4)})`
    );

    return insight;
  }

  private async buildWeeklyContext(
    workspaceId: string
  ): Promise<{ content: string; platforms: string[] }> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const metrics = await this.db.socialMetric.findMany({
      where: {
        workspaceId,
        bucket: 'DAY',
        bucketStart: { gte: sevenDaysAgo },
      },
      orderBy: [{ platform: 'asc' }, { bucketStart: 'asc' }],
    });

    const platforms = Array.from(new Set(metrics.map(m => m.platform)));

    // Top 20 events per platform — newest first, oldest dropped first when
    // we hit the char cap further down.
    const allEvents: Array<{
      platform: string;
      eventType: string;
      occurredAt: Date;
      payload: unknown;
    }> = [];
    for (const platform of platforms) {
      const events = await this.db.socialEvent.findMany({
        where: {
          workspaceId,
          platform: platform as never,
          occurredAt: { gte: sevenDaysAgo },
        },
        orderBy: { occurredAt: 'desc' },
        take: 20,
      });
      for (const ev of events) {
        allEvents.push({
          platform: ev.platform,
          eventType: ev.eventType,
          occurredAt: ev.occurredAt,
          payload: ev.payload,
        });
      }
    }

    const content = renderWeeklyPayload(metrics, allEvents);
    return { content, platforms };
  }

  private async buildRecommendationContext(
    workspaceId: string,
    tone?: string
  ): Promise<{ content: string; platforms: string[] }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Fetch up to 50 events from the last 30 days — we'll let the model
    // pick top performers. Sort by occurredAt desc; the 4-chars/token
    // truncation drops oldest first.
    const events = await this.db.socialEvent.findMany({
      where: {
        workspaceId,
        occurredAt: { gte: thirtyDaysAgo },
      },
      orderBy: { occurredAt: 'desc' },
      take: 50,
    });

    const platforms = Array.from(new Set(events.map(e => e.platform)));

    const content = renderRecommendationPayload(events, tone);
    return { content, platforms };
  }
}

// ---- helpers --------------------------------------------------------------

function truncateToChars(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s;
  // Drop the OLDEST events first — the newest data is most relevant.
  // We assume the renderer puts oldest content at the END (we render from
  // descending order, so oldest is last). To preserve that, slice from the
  // start (newest first) and keep up to maxChars.
  return s.slice(0, maxChars);
}

function estimateTokens(s: string): number {
  // 4 chars/token — same heuristic as the auto-router. Good enough for
  // budget telemetry; not for billing.
  return Math.ceil(s.length / 4);
}

function computeCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const rate = PRICING[model];
  if (!rate) {
    // Unknown model — record a conservative estimate so the budget still
    // moves. Default to gemini-2.5-flash pricing (cheapest catalogued).
    return (
      (inputTokens * 0.075 + outputTokens * 0.3) / 1_000_000
    );
  }
  return (
    (inputTokens * rate.inputPerMTokens +
      outputTokens * rate.outputPerMTokens) /
    1_000_000
  );
}

function renderWeeklyPayload(
  metrics: Array<{
    platform: string;
    metricKey: string;
    bucketStart: Date;
    value: number;
  }>,
  events: Array<{
    platform: string;
    eventType: string;
    occurredAt: Date;
    payload: unknown;
  }>
): string {
  const byPlatform = new Map<string, typeof metrics>();
  for (const m of metrics) {
    const arr = byPlatform.get(m.platform) ?? [];
    arr.push(m);
    byPlatform.set(m.platform, arr);
  }

  const lines: string[] = ['# 7-Day Metrics + Events', ''];

  for (const [platform, rows] of byPlatform) {
    lines.push(`## ${platform}`);
    // Group by metricKey for readability.
    const byKey = new Map<string, typeof rows>();
    for (const r of rows) {
      const arr = byKey.get(r.metricKey) ?? [];
      arr.push(r);
      byKey.set(r.metricKey, arr);
    }
    for (const [key, series] of byKey) {
      const values = series.map(s => `${s.value}`).join(', ');
      lines.push(`- ${key}: ${values}`);
    }
    lines.push('');
  }

  if (events.length > 0) {
    lines.push('# Top Events (most recent first)');
    for (const ev of events) {
      lines.push(
        `- [${ev.platform}] ${ev.eventType} @ ${ev.occurredAt.toISOString()}: ${safeStringify(ev.payload, 200)}`
      );
    }
  }

  return lines.join('\n');
}

function renderRecommendationPayload(
  events: Array<{
    platform: string;
    eventType: string;
    occurredAt: Date;
    payload: unknown;
  }>,
  tone?: string
): string {
  const lines: string[] = ['# Top-performing posts (last 30 days)', ''];
  if (tone) {
    lines.push(`Desired tone: ${tone}`);
    lines.push('');
  }
  for (const ev of events) {
    lines.push(
      `- [${ev.platform}] ${ev.eventType} @ ${ev.occurredAt.toISOString()}: ${safeStringify(ev.payload, 300)}`
    );
  }
  return lines.join('\n');
}

function safeStringify(value: unknown, maxLen: number): string {
  try {
    const json = JSON.stringify(value);
    if (!json) return '';
    return json.length > maxLen ? `${json.slice(0, maxLen)}…` : json;
  } catch {
    return '';
  }
}
