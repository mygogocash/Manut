// Side-effect import — registers the consolidated analytics config schema
// (kms, meta, line, tiktok) before any DI consumer reads from `Config`.
import './config';

import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';

import { NotificationModule } from '../../core/notification';
import { PermissionModule } from '../../core/permission';
import { CopilotModule } from '../copilot';
import { isAnalyticsModuleEnabled } from './feature-flag';

export { isAnalyticsModuleEnabled } from './feature-flag';
import { DailyRollupCron } from './aggregator/daily-rollup.cron';
import { HourlyRollupCron } from './aggregator/hourly-rollup.cron';
import { MetricRollupService } from './aggregator/metric-rollup.service';
import { WeeklyRollupCron } from './aggregator/weekly-rollup.cron';
import { AnomalyDetectorService } from './ai/anomaly-detector.service';
import { BudgetService } from './ai/budget.service';
import { StrategistService } from './ai/strategist.service';
import { TrendDetectorService } from './ai/trend-detector.service';
import { ConnectionResolver } from './connections/connection.resolver';
import { ConnectionService } from './connections/connection.service';
import { LineOAuthService } from './connections/oauth/line.oauth';
import { MetaOAuthService } from './connections/oauth/meta.oauth';
import { TikTokOAuthService } from './connections/oauth/tiktok.oauth';
import { OAuthCallbackController } from './connections/oauth-callback.controller';
import { TokenRefreshCron } from './connections/refresh.cron';
import { TokenStore } from './connections/token-store';
import { AnalyticsResolver } from './graphql/analytics.resolver';
import { IngestionService } from './ingest/ingestion.service';
import { GogocashPoller } from './ingest/polling/gogocash.poller';
import { LinePoller } from './ingest/polling/line.poller';
import { MetaPoller } from './ingest/polling/meta.poller';
import { ThreadsPoller } from './ingest/polling/threads.poller';
import { TikTokPoller } from './ingest/polling/tiktok.poller';
import { LineWebhookController } from './ingest/webhooks/line.controller';
import { MetaWebhookController } from './ingest/webhooks/meta.controller';
import { TikTokWebhookController } from './ingest/webhooks/tiktok.controller';
import { AnalyticsInsightEventBus } from './insight-event-bus.service';
import { AnalyticsInsightsStreamController } from './insight-stream.controller';
import { LineMapper } from './normalizer/platform-mappers/line.mapper';
import { MetaMapper } from './normalizer/platform-mappers/meta.mapper';
import { ThreadsMapper } from './normalizer/platform-mappers/threads.mapper';
import { TikTokMapper } from './normalizer/platform-mappers/tiktok.mapper';

/**
 * Analytics platform module — PRD: docs/analytics-platform.md.
 *
 * Behind a feature flag: env `ENABLE_ANALYTICS_MODULE`. When the flag is
 * not exactly `'true'`, `forRoot()` returns an empty module — no providers
 * wire up, no controllers register, no cron jobs schedule.
 */
@Module({})
export class AnalyticsModule {
  static forRoot(): DynamicModule {
    if (!isAnalyticsModuleEnabled()) {
      return {
        module: AnalyticsModule,
        // Intentionally empty — when disabled, no providers, no controllers.
      };
    }

    return {
      module: AnalyticsModule,
      imports: [
        // Analytics depends on CopilotModule for PromptService +
        // CopilotProviderFactory (consumed by the AI services). Permission
        // module backs Workspace.Read ACL on every resolver. Notification
        // module exposes NotificationService used by the budget soft-cap
        // alert (BudgetService.fireSoftCapAlert).
        CopilotModule,
        PermissionModule,
        NotificationModule,
      ],
      providers: [
        // connections
        TokenStore,
        ConnectionService,
        ConnectionResolver,
        MetaOAuthService,
        LineOAuthService,
        TikTokOAuthService,
        TokenRefreshCron,
        // ingest — IngestionService is still a stub (NOT_IMPLEMENTED at
        // runtime); registering it satisfies DI for the pollers + webhook
        // controllers that consume it. See ingestion.service.ts TODO.
        IngestionService,
        MetaPoller,
        ThreadsPoller,
        TikTokPoller,
        LinePoller,
        GogocashPoller,
        // normalizer mappers (one per platform)
        MetaMapper,
        TikTokMapper,
        LineMapper,
        ThreadsMapper,
        // aggregator cron jobs
        MetricRollupService,
        HourlyRollupCron,
        DailyRollupCron,
        WeeklyRollupCron,
        // ai
        BudgetService,
        StrategistService,
        TrendDetectorService,
        AnomalyDetectorService,
        // graphql
        AnalyticsInsightEventBus,
        AnalyticsResolver,
      ],
      controllers: [
        MetaWebhookController,
        TikTokWebhookController,
        LineWebhookController,
        OAuthCallbackController,
        AnalyticsInsightsStreamController,
      ],
    };
  }
}
