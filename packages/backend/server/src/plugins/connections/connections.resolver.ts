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
  constructor(private readonly connections: ConnectionsService) {}

  @Query(() => [ConnectedAccountType])
  async listConnections(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string
  ): Promise<ConnectedAccountType[]> {
    if (!user) {
      throw new AuthenticationRequired();
    }
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
    return this.connections.disconnectProvider(user.id, workspaceId, provider);
  }
}
