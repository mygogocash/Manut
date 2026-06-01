import {
  Args,
  Field,
  GraphQLISODateTime,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';

import { AuthenticationRequired } from '../../base';
import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import { ConnectionsService } from './connections.service';

@ObjectType()
export class ConnectedAccountType {
  @Field()
  id!: string;

  @Field()
  provider!: string;

  @Field()
  displayName!: string;

  @Field(() => [String])
  scopes!: string[];

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}

@Resolver()
export class ConnectionsResolver {
  constructor(
    private readonly connections: ConnectionsService,
    private readonly ac: AccessController
  ) {}

  @Query(() => [ConnectedAccountType])
  async listConnections(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<ConnectedAccountType[]> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    return this.connections.listConnections(user.id, workspaceId);
  }

  @Mutation(() => Boolean)
  async disconnectProvider(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string,
    @Args('provider') provider: string
  ): Promise<boolean> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Settings.Update');
    return this.connections.disconnectProvider(user.id, workspaceId, provider);
  }
}
