import {
  ServerDeploymentType,
  ServerFeature,
  SubscriptionStatus,
} from '@affine/graphql';

type AIModelLike = {
  isPro: boolean;
};

type AIModelAccessContext = {
  serverType?: ServerDeploymentType | null;
  serverFeatures?: readonly ServerFeature[] | null;
  aiSubscriptionStatus?: SubscriptionStatus | null;
};

export function hasAIModelProAccess({
  serverType,
  serverFeatures,
  aiSubscriptionStatus,
}: AIModelAccessContext) {
  if (serverType === ServerDeploymentType.Selfhosted) {
    return true;
  }

  if (!serverFeatures?.includes(ServerFeature.Payment)) {
    return true;
  }

  return aiSubscriptionStatus === SubscriptionStatus.Active;
}

export function isAIModelProLocked(
  model: AIModelLike,
  context: AIModelAccessContext
) {
  return model.isPro && !hasAIModelProAccess(context);
}
