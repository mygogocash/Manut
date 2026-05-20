import { DynamicModule, ExecutionContext } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { ClsModule } from 'nestjs-cls';

import { AppController } from './app.controller';
import {
  getRequestFromHost,
  getRequestIdFromHost,
  getRequestIdFromRequest,
  ScannerModule,
} from './base';
import { CacheModule } from './base/cache';
import { ConfigModule } from './base/config';
import { ErrorModule } from './base/error';
import { EventModule } from './base/event';
import { GqlModule } from './base/graphql';
import { HelpersModule } from './base/helpers';
import { JobModule } from './base/job';
import { LoggerModule } from './base/logger';
import { MetricsModule } from './base/metrics';
import { MutexModule } from './base/mutex';
import { PrismaModule } from './base/prisma';
import { RedisModule } from './base/redis';
import { StorageProviderModule } from './base/storage';
import { RateLimiterModule } from './base/throttler';
import { WebSocketModule } from './base/websocket';
import { AccessTokenModule } from './core/access-token';
import { AuthModule } from './core/auth';
import { CommentModule } from './core/comment';
import { ServerConfigModule, ServerConfigResolverModule } from './core/config';
import { DocStorageModule } from './core/doc';
import { DocRendererModule } from './core/doc-renderer';
import { DocServiceModule } from './core/doc-service';
import { FeatureModule } from './core/features';
import { MailModule } from './core/mail';
import { MonitorModule } from './core/monitor';
import { NotificationModule } from './core/notification';
import { PermissionModule } from './core/permission';
import { QueueDashboardModule } from './core/queue-dashboard';
import { QuotaModule } from './core/quota';
import { SelfhostModule } from './core/selfhost';
import { StaticFileModule } from './core/static-files';
import { StorageModule } from './core/storage';
import { SyncModule } from './core/sync';
import { TelemetryModule } from './core/telemetry';
import { UserModule } from './core/user';
import { VersionModule } from './core/version';
import { WorkspaceModule } from './core/workspaces';
import { Env } from './env';
import { ModelsModule } from './models';
import { AgentsModule } from './plugins/agents';
import {
  AnalyticsModule,
  isAnalyticsModuleEnabled,
} from './plugins/analytics/analytics.module';
import { CalendarModule } from './plugins/calendar';
import { CaptchaModule } from './plugins/captcha';
import { ConnectionsModule } from './plugins/connections';
import { CopilotModule } from './plugins/copilot';
import { CustomerIoModule } from './plugins/customerio';
import { FacebookOAuthModule } from './plugins/facebook-oauth/facebook-oauth.module';
import { FigmaOAuthModule } from './plugins/figma-oauth/figma-oauth.module';
import { GCloudModule } from './plugins/gcloud';
import { GithubOAuthModule } from './plugins/github-oauth/github-oauth.module';
import { GoGoCashConnectionModule } from './plugins/gogocash-connection/gogocash-connection.module';
import { GoogleOAuthModule } from './plugins/google-oauth';
import { IndexerModule } from './plugins/indexer';
import { InstagramOAuthModule } from './plugins/instagram-oauth/instagram-oauth.module';
import { LicenseModule } from './plugins/license';
import { LineVoomOAuthModule } from './plugins/line-voom-oauth/line-voom-oauth.module';
import { LinearOAuthModule } from './plugins/linear-oauth/linear-oauth.module';
import {
  isManutModuleEnabled,
  ManutModule,
} from './plugins/manut/manut.module';
import { MongoDbConnectionModule } from './plugins/mongodb-connection/mongodb-connection.module';
import { OAuthModule } from './plugins/oauth';
import { PaymentModule } from './plugins/payment';
import { PostHogConnectionModule } from './plugins/posthog-connection/posthog-connection.module';
import { SlackOAuthModule } from './plugins/slack-oauth/slack-oauth.module';
import { ThreadsOAuthModule } from './plugins/threads-oauth/threads-oauth.module';
import { TiktokOAuthModule } from './plugins/tiktok-oauth/tiktok-oauth.module';
import { WorkerModule } from './plugins/worker';

export const FunctionalityModules = [
  ClsModule.forRoot({
    global: true,
    // for http / graphql request
    middleware: {
      mount: true,
      generateId: true,
      idGenerator(req: Request) {
        // make every request has a unique id to tracing
        return getRequestIdFromRequest(req, 'http');
      },
      setup(cls, req: Request, res: Response) {
        res.setHeader('X-Request-Id', cls.getId());
        cls.set(CLS_REQUEST_HOST, req.hostname);
      },
    },
    // for websocket connection
    // https://papooch.github.io/nestjs-cls/considerations/compatibility#websockets
    interceptor: {
      mount: true,
      generateId: true,
      idGenerator(context: ExecutionContext) {
        // make every request has a unique id to tracing
        return getRequestIdFromHost(context);
      },
      setup(cls, context: ExecutionContext) {
        const req = getRequestFromHost(context);
        cls.set(CLS_REQUEST_HOST, req.hostname);
      },
    },
    plugins: [
      // https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional/prisma-adapter
      new ClsPluginTransactional({
        adapter: new TransactionalAdapterPrisma({
          prismaInjectionToken: PrismaClient,
        }),
      }),
    ],
  }),
  LoggerModule,
  ScannerModule,
  PrismaModule,
  EventModule,
  ConfigModule,
  RedisModule,
  CacheModule,
  MutexModule,
  MetricsModule,
  RateLimiterModule,
  StorageProviderModule,
  HelpersModule,
  ErrorModule,
  WebSocketModule,
  JobModule.forRoot(),
  ModelsModule,
  ScheduleModule.forRoot(),
  MonitorModule,
];

export class AppModuleBuilder {
  private readonly modules: AFFiNEModule[] = [];

  use(...modules: AFFiNEModule[]): this {
    modules.forEach(m => {
      this.modules.push(m);
    });

    return this;
  }

  useIf(predicator: () => boolean, ...modules: AFFiNEModule[]): this {
    if (predicator()) {
      this.use(...modules);
    }

    return this;
  }

  compile(): DynamicModule {
    class AppModule {}

    return {
      module: AppModule,
      imports: this.modules,
      controllers: [AppController],
    };
  }
}

export function buildAppModule(env: Env) {
  const factor = new AppModuleBuilder();

  factor
    // basic
    .use(...FunctionalityModules)

    // enable indexer module on graphql, doc and front service
    .useIf(
      () => env.flavors.graphql || env.flavors.doc || env.flavors.front,
      IndexerModule
    )

    // auth
    .use(UserModule, AuthModule, PermissionModule)

    // business modules
    .use(
      ServerConfigModule,
      FeatureModule,
      QuotaModule,
      DocStorageModule,
      NotificationModule,
      MailModule
    )
    // renderer server and front server
    .useIf(() => env.flavors.renderer || env.flavors.front, DocRendererModule)
    // sync server and front server
    .useIf(
      () => env.flavors.sync || env.flavors.front,
      SyncModule,
      TelemetryModule
    )
    // graphql server only
    .useIf(
      () => env.flavors.graphql,
      GqlModule,
      VersionModule,
      StorageModule,
      ServerConfigResolverModule,
      WorkspaceModule,
      LicenseModule,
      PaymentModule,
      CopilotModule,
      CaptchaModule,
      OAuthModule,
      CalendarModule,
      ConnectionsModule,
      GoogleOAuthModule,
      GithubOAuthModule,
      SlackOAuthModule,
      LinearOAuthModule,
      FigmaOAuthModule,
      // Manut Analytics — social platform OAuth scaffolds (5 OAuth providers
      // + 1 internal API-key + 2 database connectors). All shipped together
      // in the analytics-connections panel. Same useIf gate as the rest of
      // the OAuth modules so the GraphQL surface only mounts on the graphql
      // flavor. Each module is graceful-no-op when its env vars are unset
      // (see CLAUDE.md §6 Google OAuth scaffold-only pattern).
      FacebookOAuthModule,
      InstagramOAuthModule,
      ThreadsOAuthModule,
      TiktokOAuthModule,
      LineVoomOAuthModule,
      GoGoCashConnectionModule,
      MongoDbConnectionModule,
      PostHogConnectionModule,
      AgentsModule,
      CustomerIoModule,
      TelemetryModule,
      CommentModule,
      AccessTokenModule,
      QueueDashboardModule
    )
    // analytics platform — feature-flagged via ENABLE_ANALYTICS_MODULE
    .useIf(
      () => env.flavors.graphql && isAnalyticsModuleEnabled(),
      AnalyticsModule.forRoot()
    )
    // Manut PM / CRM / reminders — feature-flagged via ENABLE_MANUT_MODULE
    // (legacy ENABLE_SUPERFLOW_MODULE is also honored for BC)
    .useIf(
      () => env.flavors.graphql && isManutModuleEnabled(),
      ManutModule.forRoot()
    )
    // doc service and front service
    .useIf(() => env.flavors.doc || env.flavors.front, DocServiceModule)
    // worker for and self-hosted API only for self-host and local development only
    .useIf(() => env.dev || env.selfhosted, WorkerModule, SelfhostModule)
    // static frontend routes for front flavor
    .useIf(() => env.flavors.front, StaticFileModule)

    // gcloud
    .useIf(() => env.gcp, GCloudModule);

  return factor.compile();
}

export const AppModule = buildAppModule(env);
