import {
  Args,
  Field,
  GraphQLISODateTime,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';

import { AuthenticationRequired } from '../../base';
import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import { MongoIngestionConfigService } from './ingestion-config.service';
import { MongoDbConnectionNotConnectedError } from './mongodb-connection.service';
import {
  MongoDbDriverMissingError,
  MongoSchemaExplorerService,
} from './schema-explorer.service';
import type {
  MongoCollectionInfo,
  MongoIngestionConfig,
  MongoSampleDocs,
} from './types';

// ============================================================================
// ObjectTypes
//
// Every nullable @Field has an explicit `() => Type` parameter.
// NestJS metadata reflection cannot infer a GraphQL type from a union
// containing `null` (or any other ambiguous union) — see CLAUDE.md §6
// (the `UndefinedTypeError` scar that's shipped twice).
// ============================================================================

@ObjectType('MongoCollectionInfo')
export class MongoCollectionInfoType {
  @Field()
  name!: string;

  @Field(() => Int, { nullable: true })
  estimatedCount?: number;

  @Field()
  enabled!: boolean;

  @Field(() => String, { nullable: true })
  cursorField?: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  lastSyncedAt?: Date;
  @Field(() => Int, { nullable: true })
  consecutiveFailures?: number;

  @Field(() => String, { nullable: true })
  lastError?: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  lastErrorAt?: Date;
}

@ObjectType('MongoSampleDocs')
export class MongoSampleDocsType {
  @Field()
  collectionName!: string;

  /**
   * Each entry is a JSON-stringified document (ObjectIds + Dates
   * already serialised to strings). The frontend parses one entry
   * at a time so a single malformed doc doesn't poison the whole
   * sample.
   */
  @Field(() => [String])
  documents!: string[];
}

@ObjectType('MongoIngestionConfig')
export class MongoIngestionConfigType {
  @Field()
  id!: string;

  @Field()
  workspaceId!: string;

  @Field()
  collectionName!: string;

  @Field()
  enabled!: boolean;

  @Field()
  cursorField!: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  lastSyncedAt?: Date;

  @Field(() => String, { nullable: true })
  lastCursorValue?: string;

  @Field(() => Int)
  consecutiveFailures!: number;

  @Field(() => String, { nullable: true })
  lastError?: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  lastErrorAt?: Date;
  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@InputType('SetMongoIngestionConfigInput')
export class SetMongoIngestionConfigInputType {
  @Field()
  collectionName!: string;

  @Field()
  enabled!: boolean;

  @Field()
  cursorField!: string;
}

/**
 * Friendly error mapper — the GraphQL layer never surfaces typed
 * exception class names to the client. Mirrors `rethrowFriendly` in
 * `mongodb-connection.resolver.ts`.
 */
function rethrowFriendly(err: unknown): never {
  if (err instanceof MongoDbConnectionNotConnectedError) {
    throw new Error(
      'MongoDB is not connected. Add a connection string in Settings → Integrations → MongoDB.'
    );
  }
  if (err instanceof MongoDbDriverMissingError) {
    throw new Error(err.message);
  }
  throw err;
}

@Resolver()
export class MongoIngestionConfigResolver {
  constructor(
    private readonly explorer: MongoSchemaExplorerService,
    private readonly configs: MongoIngestionConfigService,
    private readonly ac: AccessController
  ) {}

  /**
   * Live list of collections in the workspace's connected Mongo
   * cluster, joined against any persisted ingestion-config rows.
   * Auth gate at the resolver — the schema-explorer trusts the
   * passed workspaceId.
   */
  @Query(() => [MongoCollectionInfoType])
  async listMongoCollections(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<MongoCollectionInfoType[]> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    try {
      const [collections, configs] = await Promise.all([
        this.explorer.listCollections(user.id, workspaceId),
        this.configs.list(workspaceId),
      ]);
      const configByName = new Map(configs.map(c => [c.collectionName, c]));
      return collections.map(c => mergeCollection(c, configByName.get(c.name)));
    } catch (err) {
      rethrowFriendly(err);
    }
  }

  /**
   * Sample N documents from a single collection for the "preview" row
   * in the picker UI. Capped at 20 by the schema-explorer service.
   */
  @Query(() => MongoSampleDocsType)
  async sampleMongoCollection(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string,
    @Args('collectionName') collectionName: string,
    @Args('limit', { type: () => Int, nullable: true })
    limit?: number
  ): Promise<MongoSampleDocsType> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    try {
      const result = await this.explorer.sampleDocs(
        user.id,
        workspaceId,
        collectionName,
        limit ?? 5
      );
      return sampleToDto(result);
    } catch (err) {
      rethrowFriendly(err);
    }
  }

  /**
   * Return every persisted ingestion-config row for the workspace.
   * Used by the "saved configurations" sub-list inside the picker —
   * separate from `listMongoCollections` so the UI can render saved
   * state even when the Mongo cluster is temporarily unreachable.
   */
  @Query(() => [MongoIngestionConfigType])
  async getMongoIngestionConfigs(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<MongoIngestionConfigType[]> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    const rows = await this.configs.list(workspaceId);
    return rows.map(configToDto);
  }

  /**
   * Upsert one ingestion-config row. The (workspaceId, collectionName)
   * pair is the unique key. Returns the persisted shape so the UI can
   * confirm the round-trip without a refetch.
   */
  @Mutation(() => MongoIngestionConfigType)
  async setMongoIngestionConfig(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string,
    @Args('input') input: SetMongoIngestionConfigInputType
  ): Promise<MongoIngestionConfigType> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    const row = await this.configs.upsert(workspaceId, {
      collectionName: input.collectionName,
      enabled: input.enabled,
      cursorField: input.cursorField,
    });
    return configToDto(row);
  }

  /**
   * Remove an ingestion-config row. Returns `true` when a row was
   * deleted, `false` when no row matched (idempotent).
   */
  @Mutation(() => Boolean)
  async deleteMongoIngestionConfig(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string,
    @Args('collectionName') collectionName: string
  ): Promise<boolean> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    return this.configs.delete(workspaceId, collectionName);
  }
}

function mergeCollection(
  c: MongoCollectionInfo,
  config: MongoIngestionConfig | undefined
): MongoCollectionInfoType {
  return {
    name: c.name,
    estimatedCount: c.estimatedCount,
    enabled: config?.enabled ?? false,
    cursorField: config?.cursorField,
    lastSyncedAt: config?.lastSyncedAt,
    consecutiveFailures: config?.consecutiveFailures,
    lastError: config?.lastError,
    lastErrorAt: config?.lastErrorAt,
  };
}

function configToDto(row: MongoIngestionConfig): MongoIngestionConfigType {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    collectionName: row.collectionName,
    enabled: row.enabled,
    cursorField: row.cursorField,
    lastSyncedAt: row.lastSyncedAt,
    lastCursorValue: row.lastCursorValue,
    consecutiveFailures: row.consecutiveFailures,
    lastError: row.lastError,
    lastErrorAt: row.lastErrorAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function sampleToDto(result: MongoSampleDocs): MongoSampleDocsType {
  return {
    collectionName: result.collectionName,
    documents: result.documents,
  };
}
