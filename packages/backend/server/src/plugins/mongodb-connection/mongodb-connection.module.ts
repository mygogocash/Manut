import { Module } from '@nestjs/common';

import { ServerConfigModule } from '../../core';
import { AuthModule } from '../../core/auth';
import { PermissionModule } from '../../core/permission';
import { MongoDbAggregationCron } from './aggregation.cron';
import { MongoDbAggregationService } from './aggregation.service';
import { AnalyticsResolver } from './analytics.resolver';
import { MongoDbIngestionCron } from './ingestion.cron';
import { MongoDbIngestionService } from './ingestion.service';
import { MongoIngestionConfigResolver } from './ingestion-config.resolver';
import { MongoIngestionConfigService } from './ingestion-config.service';
import { MongoDbConnectionResolver } from './mongodb-connection.resolver';
import { MongoDbConnectionService } from './mongodb-connection.service';
import { MongoSchemaExplorerService } from './schema-explorer.service';

/**
 * Manut Analytics — MongoDB connection scaffold.
 *
 * Direct-URI auth (NOT OAuth). Connect/disconnect plumbing wired
 * end-to-end:
 *
 *   - `setMongoDbConnection` mutation persists an encrypted URI
 *   - `testMongoDbConnection` mutation runs `db.command({ ping: 1 })`
 *     against a candidate URI without persisting
 *   - `disconnectMongoDb` mutation deletes the row
 *   - `mongoDbConnection` query returns `{ connected, host, database }`
 *
 * No controller — there's no OAuth callback to handle. The frontend
 * shows an inline form with the URI input and Test button.
 *
 * Optional env var: `MONGODB_DEFAULT_URI` provides a placeholder hint
 * for the frontend (never used as a real default — workspaces must
 * explicitly opt in).
 *
 * Security posture:
 *  - Connection string is encrypted at rest (reuses the OAuth token
 *    encryption helper).
 *  - The URI is NEVER logged at any level — only the parsed host is
 *    safe to log.
 *  - The driver is loaded LAZILY via `await import('mongodb')` in
 *    `testConnection` so the dependency isn't required at boot; if
 *    it's missing, the test surfaces a friendly "ask an admin to
 *    install" message instead of crashing.
 */
@Module({
  imports: [AuthModule, ServerConfigModule, PermissionModule],
  providers: [
    MongoDbConnectionService,
    MongoDbConnectionResolver,
    // Schema discovery + ingestion-config (Manut analytics Wave 2 / M3 E3.4)
    MongoSchemaExplorerService,
    MongoIngestionConfigService,
    MongoIngestionConfigResolver,
    MongoDbIngestionService,
    MongoDbIngestionCron,
    // Daily-stats aggregation + GraphQL dashboard surface (M3 E3.5).
    // Reads from `mn_mongo_raw_data` that the ingestion service /
    // ingestion cron land; writes `mn_analytics_daily_stats` rows that
    // the `dailyStats` query exposes to the frontend.
    MongoDbAggregationService,
    MongoDbAggregationCron,
    AnalyticsResolver,
  ],
  exports: [
    MongoDbConnectionService,
    MongoSchemaExplorerService,
    MongoIngestionConfigService,
    MongoDbIngestionService,
    MongoDbAggregationService,
  ],
})
export class MongoDbConnectionModule {}
