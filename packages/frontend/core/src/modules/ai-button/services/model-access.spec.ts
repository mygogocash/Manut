import {
  ServerDeploymentType,
  ServerFeature,
  SubscriptionStatus,
} from '@affine/graphql';
import { describe, expect, test } from 'vitest';

import { isAIModelProLocked } from './model-access';

const proModel = { isPro: true };
const freeModel = { isPro: false };

describe('ai model access', () => {
  test('ai model access > given payment disabled > then pro model is not gated', () => {
    expect(
      isAIModelProLocked(proModel, {
        serverType: ServerDeploymentType.Affine,
        serverFeatures: [ServerFeature.Copilot],
        aiSubscriptionStatus: undefined,
      })
    ).toBe(false);
  });

  test('ai model access > given payment enabled without subscription > then pro model is gated', () => {
    expect(
      isAIModelProLocked(proModel, {
        serverType: ServerDeploymentType.Affine,
        serverFeatures: [ServerFeature.Copilot, ServerFeature.Payment],
        aiSubscriptionStatus: undefined,
      })
    ).toBe(true);
  });

  test('ai model access > given payment enabled with active AI > then pro model is not gated', () => {
    expect(
      isAIModelProLocked(proModel, {
        serverType: ServerDeploymentType.Affine,
        serverFeatures: [ServerFeature.Copilot, ServerFeature.Payment],
        aiSubscriptionStatus: SubscriptionStatus.Active,
      })
    ).toBe(false);
  });

  test('ai model access > given selfhosted server > then pro model is not gated', () => {
    expect(
      isAIModelProLocked(proModel, {
        serverType: ServerDeploymentType.Selfhosted,
        serverFeatures: [ServerFeature.Copilot, ServerFeature.Payment],
        aiSubscriptionStatus: undefined,
      })
    ).toBe(false);
  });

  test('ai model access > given free model > then model is never gated', () => {
    expect(
      isAIModelProLocked(freeModel, {
        serverType: ServerDeploymentType.Affine,
        serverFeatures: [ServerFeature.Copilot, ServerFeature.Payment],
        aiSubscriptionStatus: undefined,
      })
    ).toBe(false);
  });
});
