import { type AutoRouteReason, routeAutoModel } from '../auto-router.js';
import type { PromptAttachment, PromptMessage } from '../providers/types.js';
import type { ScenarioKey } from './scenario-classifier.js';

export type AutoScenarioModelConfig = {
  readonly scenarios?: Partial<Record<ScenarioKey, string | undefined>>;
};

const HIGH_SIGNAL_ROUTE_REASONS = new Set<AutoRouteReason>([
  'code-heavy',
  'image-input',
  'long-context',
]);

export function selectAutoModelForScenario(input: {
  readonly scenario: ScenarioKey;
  readonly content: string;
  readonly attachments?: PromptAttachment[] | null;
  readonly scenariosConfig?: AutoScenarioModelConfig;
}): string {
  const routeInput: PromptMessage[] = [
    {
      role: 'user',
      content: input.content,
      attachments: input.attachments ?? undefined,
    },
  ];
  const routeDecision = routeAutoModel(routeInput);

  if (HIGH_SIGNAL_ROUTE_REASONS.has(routeDecision.reason)) {
    return routeDecision.modelId;
  }

  return (
    input.scenariosConfig?.scenarios?.[input.scenario] ?? routeDecision.modelId
  );
}
