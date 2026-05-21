/**
 * Manut Analytics — MongoDB connection plugin public surface.
 *
 * This barrel file exports the runtime providers + types so callers
 * outside the plugin can compose against the public surface without
 * reaching into module-private files. The internal raw-SQL helpers,
 * sanitisers, and circuit-breaker logic stay non-exported on purpose.
 *
 * Aggregation surface (this PR — M3 E3.5):
 *  - `MongoDbAggregationService` — `runForWorkspace(workspaceId,
 *    lookbackDays?)` and `listWorkspacesWithRawData()` for the hourly
 *    cron + admin backfill mutation.
 *  - `MongoDbAggregationCron` — `@Cron(CronExpression.EVERY_HOUR)`
 *    wrapper, honours `ENABLE_MONGO_AGGREGATION_CRON=false` operator
 *    override.
 *  - `AnalyticsResolver` — `dailyStats` query + `backfillAnalytics`
 *    mutation. Permission gates: `Workspace.Read` for the query,
 *    `Workspace.Settings.Update` for the mutation.
 *  - `DailyStatType` / `DailyStatsInputType` — GraphQL ObjectType +
 *    InputType re-exported so external resolvers can compose against
 *    the daily-stats shape.
 *
 * Existing surface (left intact):
 *  - `MongoDbConnectionModule` — the NestJS module to import.
 *  - `MongoDbConnectionService`, `MongoSchemaExplorerService`,
 *    `MongoIngestionConfigService` — direct service handles.
 *  - The `mongodb-connection.resolver` + `ingestion-config.resolver`
 *    surfaces stay file-local; the module is the only public hook.
 */

export { MongoDbAggregationCron } from './aggregation.cron';
export type { AggregationResult } from './aggregation.service';
export { MongoDbAggregationService } from './aggregation.service';
export {
  AnalyticsResolver,
  DailyStatsInputType,
  DailyStatType,
} from './analytics.resolver';
export { MongoIngestionConfigService } from './ingestion-config.service';
export { MongoDbConnectionModule } from './mongodb-connection.module';
export { MongoDbConnectionService } from './mongodb-connection.service';
export { MongoSchemaExplorerService } from './schema-explorer.service';
export type {
  MongoCollectionInfo,
  MongoDbConnectionStatus,
  MongoIngestionConfig,
  MongoSampleDocs,
  SetMongoIngestionConfigInput,
} from './types';
export { MONGODB_PROVIDER_NAME } from './types';
