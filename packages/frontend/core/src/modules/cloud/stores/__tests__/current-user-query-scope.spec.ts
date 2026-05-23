import {
  copilotQuotaQuery,
  getUserFeaturesQuery,
  getUserSettingsQuery,
  quotaQuery,
} from '@affine/graphql';
import { Framework } from '@toeverything/infra';
import { describe, expect, test, vi } from 'vitest';

import { GraphQLService } from '../../services/graphql';
import { UserCopilotQuotaStore } from '../user-copilot-quota';
import { UserFeatureStore } from '../user-feature';
import { UserQuotaStore } from '../user-quota';
import { UserSettingsStore } from '../user-settings';

const createGraphQLService = (response: unknown) => {
  const gql = vi.fn().mockResolvedValue(response);
  return {
    gql,
  };
};

const createStore = <T>(
  StoreClass: new (...args: any[]) => T,
  response: unknown
) => {
  const gqlService = createGraphQLService(response);
  const framework = new Framework();

  framework.service(GraphQLService, gqlService as any);
  framework.store(StoreClass as any, [GraphQLService]);

  return {
    gqlService,
    store: framework.provider().get(StoreClass as any) as T,
  };
};

describe('current-user cloud store queries', () => {
  test('UserQuotaStore only requests quota fields', async () => {
    const { gqlService, store } = createStore(UserQuotaStore, {
      currentUser: {
        id: 'user-1',
        quota: { storageQuota: 1024 },
        quotaUsage: { storageQuota: 128 },
      },
    });

    await store.fetchUserQuota();

    expect(gqlService.gql).toHaveBeenCalledWith({
      query: quotaQuery,
      context: {
        signal: undefined,
      },
    });
  });

  test('UserSettingsStore only requests settings fields', async () => {
    const { gqlService, store } = createStore(UserSettingsStore, {
      currentUser: {
        settings: {
          receiveInvitationEmail: true,
          receiveMentionEmail: true,
          receiveCommentEmail: true,
        },
      },
    });

    await store.getUserSettings();

    expect(gqlService.gql).toHaveBeenCalledWith({
      query: getUserSettingsQuery,
    });
  });

  test('UserFeatureStore only requests feature fields', async () => {
    const abortController = new AbortController();
    const { gqlService, store } = createStore(UserFeatureStore, {
      currentUser: {
        id: 'user-1',
        features: [],
      },
    });

    await store.getUserFeatures(abortController.signal);

    expect(gqlService.gql).toHaveBeenCalledWith({
      query: getUserFeaturesQuery,
      context: {
        signal: abortController.signal,
      },
    });
  });

  test('UserCopilotQuotaStore only requests copilot quota fields', async () => {
    const { gqlService, store } = createStore(UserCopilotQuotaStore, {
      currentUser: {
        copilot: {
          quota: {
            limit: null,
            used: 0,
          },
        },
      },
    });

    await store.fetchUserCopilotQuota();

    expect(gqlService.gql).toHaveBeenCalledWith({
      query: copilotQuotaQuery,
      context: {
        signal: undefined,
      },
    });
  });
});
