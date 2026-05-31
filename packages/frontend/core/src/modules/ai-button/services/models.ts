import { isGraphQLSchemaValidationError } from '@affine/error';
import { getPromptModelsQuery } from '@affine/graphql';
import {
  createSignalFromObservable,
  type Signal,
} from '@blocksuite/affine/shared/utils';
import { signal } from '@preact/signals-core';
import { LiveData, Service } from '@toeverything/infra';

import type {
  GraphQLService,
  ServerService,
  SubscriptionService,
} from '../../cloud';
import type { GlobalStateService } from '../../storage';
import { isAIModelProLocked } from './model-access';

const AI_MODEL_ID_KEY = 'AIModelId';

export interface AIModel {
  name: string;
  id: string;
  version: string;
  category: string;
  isPro: boolean;
  isDefault: boolean;
}

export function resolveSelectedAIModelId(
  models: readonly AIModel[],
  storedModelId: string | undefined
): string | undefined {
  if (storedModelId && models.some(model => model.id === storedModelId)) {
    return storedModelId;
  }

  return models.find(model => model.isDefault)?.id ?? 'auto';
}

export class AIModelService extends Service {
  modelId: Signal<string | undefined>;

  models: Signal<AIModel[]> = signal([]);

  private readonly modelId$ = LiveData.from(
    this.globalStateService.globalState.watch<string>(AI_MODEL_ID_KEY),
    undefined
  );

  constructor(
    private readonly globalStateService: GlobalStateService,
    private readonly gqlService: GraphQLService,
    private readonly serverService: ServerService,
    private readonly subscriptionService: SubscriptionService
  ) {
    super();

    const { signal: modelId, cleanup } = createSignalFromObservable<
      string | undefined
    >(this.modelId$, undefined);
    this.modelId = modelId;
    this.disposables.push(cleanup);

    this.init().catch(err => {
      if (isGraphQLSchemaValidationError(err)) {
        // Backend missing the copilot prompt-models field (module disabled
        // or version skew). Surface a synthetic Auto entry so the picker
        // doesn't render an empty dropdown — selecting Auto sends
        // modelId='auto' which the backend resolves server-side.
        console.warn('[ai] models query unavailable — using fallback');
        this.models.value = [
          {
            id: 'auto',
            name: 'Auto',
            version: 'Smart routing',
            category: 'Auto',
            isPro: false,
            isDefault: true,
          },
        ];
        return;
      }
      console.error(err);
    });
  }

  resetModel = () => {
    this.globalStateService.globalState.set(AI_MODEL_ID_KEY, undefined);
  };

  setModel = (modelId: string) => {
    // Selection gating lives in the picker UI (preference-popup.ts) which
    // knows about self-hosted deployment status. Don't double-gate here —
    // the previous Pro-vs-subscription guard caused setModel to silently
    // reject selections on self-hosted servers, so the chat input kept
    // reverting to Auto even after the user picked Gemini Pro / Claude.
    this.globalStateService.globalState.set(AI_MODEL_ID_KEY, modelId);
  };

  getSelectedModelId = () => {
    return resolveSelectedAIModelId(this.models.value, this.modelId.value);
  };

  private readonly init = async () => {
    await this.initModels();

    // subscribe to ai purchase status
    const sub = this.subscriptionService.subscription.ai$.subscribe(
      subscription => {
        const model = this.models.value.find(
          model => model.id === this.modelId.value
        );
        const serverConfig = this.serverService.server.config$.value;
        if (
          model &&
          isAIModelProLocked(model, {
            serverType: serverConfig?.type,
            serverFeatures: serverConfig?.features,
            aiSubscriptionStatus: subscription?.status,
          })
        ) {
          this.resetModel();
        }
      }
    );
    this.disposables.push(() => sub.unsubscribe());
  };

  private readonly initModels = async (prompt?: string) => {
    const promptName = prompt || 'Chat With AFFiNE AI';
    const models = await this.getModelsByPrompt(promptName);
    if (models) {
      const { defaultModel, optionalModels, proModels } = models;
      // Synthetic "Auto" entry — sent as modelId='auto' to the backend, where
      // ScenarioClassifier picks the scenario-mapped model from copilot config.
      // Marked default so first-time users land on Auto unless they pick a
      // specific model. Not pro-gated.
      const autoEntry: AIModel = {
        id: 'auto',
        name: 'Auto',
        version: 'Smart routing',
        category: 'Auto',
        isPro: false,
        isDefault: true,
      };
      this.models.value = [
        autoEntry,
        ...optionalModels.map(model => {
          const [category] = model.name.split(' ');
          const version = model.name.slice(category.length + 1);
          return {
            name: model.name,
            id: model.id,
            version,
            category,
            isPro: proModels.some(proModel => proModel.id === model.id),
            // Server's defaultModel marker stays true on its native entry —
            // both Auto and the server default carry isDefault=true. The UI
            // resolves the active selection via stored modelId; if absent,
            // Auto wins because it appears first in the array.
            isDefault: model.id === defaultModel,
          };
        }),
      ];
    }
  };

  private readonly getModelsByPrompt = async (promptName: string) => {
    return this.gqlService
      .gql({
        query: getPromptModelsQuery,
        variables: { promptName },
      })
      .then(res => res.currentUser?.copilot?.models);
  };
}
