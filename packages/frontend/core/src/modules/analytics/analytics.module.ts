import type { Framework } from '@toeverything/infra';

import { EventSourceService, WorkspaceServerService } from '../cloud';
import { WorkspaceScope } from '../workspace';
import { AnalyticsDataEntity } from './entities/analytics-data.entity';
import { InsightEntity } from './entities/insight.entity';
import { PlatformConnectionEntity } from './entities/platform-connection.entity';
import { AnalyticsService } from './services/analytics.service';
import { ConnectionService } from './services/connection.service';

export type {
  AnalyticsKpi,
  AnalyticsOverview,
  AnalyticsPlatformStatus,
  KpiSnapshot,
  MetricPoint,
  MetricSeries,
  SocialPlatform,
} from './entities/analytics-data.entity';
export type {
  Insight,
  InsightSeverity,
  InsightType,
} from './entities/insight.entity';
export type {
  ConnectionStatus,
  PlatformConnection,
} from './entities/platform-connection.entity';
export { AnalyticsService } from './services/analytics.service';
export { ConnectionService } from './services/connection.service';

export function configureAnalyticsModule(framework: Framework) {
  framework
    .scope(WorkspaceScope)
    .entity(AnalyticsDataEntity)
    .entity(InsightEntity)
    .entity(PlatformConnectionEntity)
    .service(AnalyticsService, [WorkspaceServerService, EventSourceService])
    .service(ConnectionService, [WorkspaceServerService]);
}
