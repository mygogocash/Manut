import { Logger } from '@nestjs/common';
import {
  Args,
  Field,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';

import { AuthenticationRequired, BadRequest, Throttle } from '../../base';
import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import {
  MongoDbConnectionInvalidUriError,
  MongoDbConnectionNotConnectedError,
  MongoDbConnectionService,
} from './mongodb-connection.service';

@InputType()
export class MongoDbConnectionInputType {
  @Field()
  uri!: string;
}

@ObjectType()
export class MongoDbConnectionType {
  @Field()
  connected!: boolean;

  // Explicit @Field(() => String) for nullable union — CLAUDE.md §6.
  @Field(() => String, { nullable: true })
  host?: string;

  @Field(() => String, { nullable: true })
  database?: string;
}

@ObjectType()
export class MongoDbConnectionTestResultType {
  @Field()
  ok!: boolean;

  @Field(() => String, { nullable: true })
  error?: string;

  @Field(() => String, { nullable: true })
  host?: string;

  @Field(() => String, { nullable: true })
  database?: string;

  // Explicit Int — NEVER `@Field(() => Number)` (UndefinedTypeError
  // startup crash). CLAUDE.md §6.
  @Field(() => Int, { nullable: true })
  pingMs?: number;
}

// Map domain errors to the established UserFriendlyError framework
// (BadRequest extends UserFriendlyError) so they surface as typed,
// friendly GraphQL errors instead of the generic "Unhandled error
// raised" that bare `throw new Error()` produces (finding #13,
// CLAUDE.md error-mapping scar).
function rethrowFriendly(err: unknown): never {
  if (err instanceof MongoDbConnectionNotConnectedError) {
    throw new BadRequest(
      'MongoDB is not connected. Add a connection string in Settings → Analytics · Connections.'
    );
  }
  if (err instanceof MongoDbConnectionInvalidUriError) {
    throw new BadRequest(err.message);
  }
  throw err;
}

@Resolver()
export class MongoDbConnectionResolver {
  private readonly logger = new Logger(MongoDbConnectionResolver.name);

  constructor(
    private readonly mongo: MongoDbConnectionService,
    private readonly ac: AccessController
  ) {}

  /**
   * Persist a MongoDB URI for the workspace. Encrypts at rest.
   * Returns the parsed host + database for display.
   */
  @Mutation(() => MongoDbConnectionType)
  async setMongoDbConnection(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string,
    @Args('input') input: MongoDbConnectionInputType
  ): Promise<MongoDbConnectionType> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    try {
      const status = await this.mongo.setConnection(
        user.id,
        workspaceId,
        input.uri
      );
      return {
        connected: status.connected,
        host: status.host,
        database: status.database,
      };
    } catch (err) {
      rethrowFriendly(err);
    }
  }

  @Mutation(() => Boolean)
  async disconnectMongoDb(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<boolean> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    return this.mongo.disconnect(user.id, workspaceId);
  }

  /**
   * Stateless connection probe — does NOT persist the URI. Used by
   * the inline "Test" button on the frontend form before the user
   * saves.
   */
  @Mutation(() => MongoDbConnectionTestResultType)
  @Throttle('default', { limit: 10 })
  async testMongoDbConnection(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string,
    @Args('input') input: MongoDbConnectionInputType
  ): Promise<MongoDbConnectionTestResultType> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    const result = await this.mongo.testConnection(input.uri);
    return {
      ok: result.ok,
      error: result.error,
      host: result.host,
      database: result.database,
      pingMs: result.pingMs,
    };
  }

  @Query(() => MongoDbConnectionType)
  async mongoDbConnection(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<MongoDbConnectionType> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    try {
      const status = await this.mongo.getStatus(user.id, workspaceId);
      return {
        connected: status.connected,
        host: status.host,
        database: status.database,
      };
    } catch (err) {
      this.logger.error(
        // CRITICAL: never log the URI; the user-bound row stores it
        // encrypted but a transient query failure must not echo any
        // metadata that might contain secrets.
        `mongoDbConnection lookup failed for user=${user.id} workspace=${workspaceId}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined
      );
      return { connected: false };
    }
  }
}
