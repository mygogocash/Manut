import type { Framework } from '@toeverything/infra';

import { GraphQLService } from '../cloud';
import { WorkspaceScope } from '../workspace';
import { AnalyticsDataEntity } from './entities/analytics-data.entity';
import { InsightEntity } from './entities/insight.entity';
import { PlatformConnectionEntity } from './entities/platform-connection.entity';
import { AnalyticsService } from './services/analytics.service';
import { ConnectionService } from './services/connection.service';

export { AnalyticsService } from './services/analytics.service';
export { ConnectionService } from './services/connection.service';
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
  ConnectionStatus,
  PlatformConnection,
} from './entities/platform-connection.entity';
export type {
  Insight,
  InsightType,
  InsightSeverity,
} from './entities/insight.entity';

export function configureAnalyticsModule(framework: Framework) {
  framework
    .scope(WorkspaceScope)
    .entity(AnalyticsDataEntity)
    .entity(InsightEntity)
    .entity(PlatformConnectionEntity)
    .service(AnalyticsService, [GraphQLService])
    .service(ConnectionService, [GraphQLService]);
}
