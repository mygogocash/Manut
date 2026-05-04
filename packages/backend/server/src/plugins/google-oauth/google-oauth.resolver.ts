import {
  Args,
  Field,
  Int,
  Mutation,
  ObjectType,
  Query,
  registerEnumType,
  Resolver,
} from '@nestjs/graphql';

import { AuthenticationRequired, URLHelper } from '../../base';
import { CurrentUser } from '../../core/auth';
import { type DriveFile, DriveService } from './drive.service';
import { type GmailMessageSummary, GmailService } from './gmail.service';
import {
  GoogleOAuthNotConfiguredError,
  GoogleOAuthNotConnectedError,
  GoogleOAuthRefreshFailedError,
  GoogleOAuthService,
} from './google-oauth.service';
import type { GoogleScope } from './types';

/**
 * GraphQL enum mirroring `GoogleScope`. Keeping it local to the resolver
 * lets us evolve the wire shape without leaking into the service.
 */
enum GoogleScopeEnum {
  gmail = 'gmail',
  drive = 'drive',
}

registerEnumType(GoogleScopeEnum, {
  name: 'GoogleScope',
  description:
    'Which Google service the OAuth flow should request access to. v1.10.1: gmail and drive only.',
});

@ObjectType()
export class GoogleConnectAuthUrl {
  @Field()
  url!: string;
}

@ObjectType()
export class GoogleConnectionType {
  @Field(() => GoogleScopeEnum)
  scope!: GoogleScopeEnum;

  @Field()
  connected!: boolean;

  @Field({ nullable: true })
  email?: string;
}

@ObjectType()
export class GmailMessageSummaryType implements GmailMessageSummary {
  @Field()
  messageId!: string;

  @Field()
  from!: string;

  @Field()
  subject!: string;

  @Field()
  date!: string;

  @Field()
  snippet!: string;
}

@ObjectType()
export class DriveFileType implements DriveFile {
  @Field()
  id!: string;

  @Field()
  name!: string;

  @Field()
  mimeType!: string;

  @Field({ nullable: true })
  iconLink?: string;

  @Field({ nullable: true })
  webViewLink?: string;

  @Field({ nullable: true })
  modifiedTime?: string;

  // SUPERFLOW v1.10.2: explicit @Field(() => String) for the `string | null`
  // union. NestJS metadata reflection cannot infer a GraphQL type from a
  // union containing `null` and crashes the schema build with
  // `UndefinedTypeError: ... explicit type for the "size" of "DriveFile"`.
  // Same lesson as v1.7.0 — always pass an explicit type for nullable /
  // optional / union @Field declarations. Drive returns `size` as a string
  // (file sizes can exceed JS safe-integer range).
  @Field(() => String, { nullable: true })
  size?: string | null;
}

/**
 * Map the typed errors out of the service into messages the frontend
 * can render directly. We deliberately don't pass the raw upstream
 * Google error text through — those messages occasionally include
 * tokens or internal IDs.
 */
function rethrowFriendly(err: unknown): never {
  if (err instanceof GoogleOAuthNotConnectedError) {
    throw new Error(
      'Google account is not connected for this workspace. Connect it in Settings → Integrations.'
    );
  }
  if (err instanceof GoogleOAuthNotConfiguredError) {
    throw new Error(
      'Google OAuth client is not configured on this server. Ask an admin to set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.'
    );
  }
  if (err instanceof GoogleOAuthRefreshFailedError) {
    throw new Error(
      'Could not refresh Google access — please reconnect your Google account in Settings → Integrations.'
    );
  }
  throw err;
}

@Resolver()
export class GoogleOAuthResolver {
  constructor(
    private readonly googleOAuth: GoogleOAuthService,
    private readonly url: URLHelper
  ) {}

  /**
   * Returns the Google consent URL for the given scope. The frontend
   * should open this in a popup or full-page redirect; once the user
   * approves, the callback handler at /oauth/google/callback persists
   * the connection.
   *
   * Throws when GOOGLE_OAUTH_CLIENT_ID / SECRET are not configured —
   * surfaced to the client so it can render a helpful "Configure OAuth
   * client in Google Cloud Console" message instead of a blank popup.
   */
  @Mutation(() => GoogleConnectAuthUrl)
  async connectGoogle(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string,
    @Args('scope', { type: () => GoogleScopeEnum }) scope: GoogleScopeEnum
  ): Promise<GoogleConnectAuthUrl> {
    if (!user) {
      throw new AuthenticationRequired();
    }

    const redirectUri = this.googleOAuth.resolveRedirectUri(
      this.url.requestOrigin
    );
    const url = await this.googleOAuth.initiateOAuth(
      user.id,
      workspaceId,
      scope as GoogleScope,
      redirectUri
    );
    return { url };
  }

  @Mutation(() => Boolean)
  async disconnectGoogle(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string,
    @Args('scope', { type: () => GoogleScopeEnum }) scope: GoogleScopeEnum
  ): Promise<boolean> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    return this.googleOAuth.disconnect(
      user.id,
      workspaceId,
      scope as GoogleScope
    );
  }

  @Query(() => GoogleConnectionType)
  async googleConnection(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string,
    @Args('scope', { type: () => GoogleScopeEnum }) scope: GoogleScopeEnum
  ): Promise<GoogleConnectionType> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    const status = await this.googleOAuth.getStatus(
      user.id,
      workspaceId,
      scope as GoogleScope
    );
    return {
      scope,
      connected: status.connected,
      email: status.email,
    };
  }
}

/**
 * v1.10.2 Gmail / Drive resolvers. Kept in their own resolver class so
 * the auth-only `GoogleOAuthResolver` doesn't need the GmailService or
 * DriveService injected — keeps the connect/disconnect flow runnable
 * even if the live importers are mis-wired.
 */
@Resolver()
export class GoogleIntegrationResolver {
  constructor(
    private readonly gmail: GmailService,
    private readonly drive: DriveService
  ) {}

  @Query(() => [GmailMessageSummaryType])
  async gmailMessages(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string,
    @Args('query', { nullable: true }) query?: string,
    @Args('maxResults', { type: () => Int, defaultValue: 25 })
    maxResults?: number
  ): Promise<GmailMessageSummaryType[]> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    try {
      return await this.gmail.listMessages(
        user.id,
        workspaceId,
        query,
        maxResults ?? 25
      );
    } catch (err) {
      rethrowFriendly(err);
    }
  }

  @Mutation(() => String, {
    description:
      'Imports a Gmail message as a new doc. Returns the new doc ID.',
  })
  async importGmailMessage(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string,
    @Args('messageId') messageId: string
  ): Promise<string> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    try {
      const result = await this.gmail.importMessage(
        user.id,
        workspaceId,
        messageId
      );
      return result.docId;
    } catch (err) {
      rethrowFriendly(err);
    }
  }

  @Query(() => [DriveFileType])
  async driveFiles(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId') workspaceId: string,
    @Args('query', { nullable: true }) query?: string,
    @Args('pageSize', { type: () => Int, defaultValue: 25 })
    pageSize?: number
  ): Promise<DriveFileType[]> {
    if (!user) {
      throw new AuthenticationRequired();
    }
    try {
      return await this.drive.listFiles(
        user.id,
        workspaceId,
        query,
        pageSize ?? 25
      );
    } catch (err) {
      rethrowFriendly(err);
    }
  }
}
