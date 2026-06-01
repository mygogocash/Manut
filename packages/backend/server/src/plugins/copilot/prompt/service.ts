import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Prisma, PrismaClient } from '@prisma/client';

import { Config, OnEvent } from '../../../base';
// Manut Wave 4 (M5b) — Memory MVP. Imports must be runtime (no `import
// type`) per the v1.12.0 DI-metadata scar — the retrieve service is a
// constructor target for NestJS DI.
import { MemoryRetrieveService } from '../memory/retrieve.service';
import { formatMemoriesForPrompt } from '../memory/system-prompt';
import {
  PromptConfig,
  PromptConfigSchema,
  PromptMessage,
  PromptMessageSchema,
} from '../providers/types';
import { ChatPrompt } from './chat-prompt';
import {
  CopilotPromptScenario,
  type Prompt,
  prompts,
  refreshPrompts,
  Scenario,
} from './prompts';

@Injectable()
export class PromptService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PromptService.name);
  private readonly cache = new Map<string, ChatPrompt>();
  private readonly inMemoryPrompts = new Map<string, Prompt>();

  constructor(
    private readonly config: Config,
    private readonly db: PrismaClient,
    // Manut Wave 4 (M5b) — optional injection of the memory retrieve
    // service. NestJS will fail to resolve PromptService at module-init
    // time if MemoryRetrieveService isn't in providers[]; that's the
    // intended contract (see plugins/copilot/index.ts where the memory
    // services are registered alongside PromptService).
    private readonly memoryRetrieve: MemoryRetrieveService
  ) {}

  async onApplicationBootstrap() {
    this.resetInMemoryPrompts();
    await refreshPrompts(this.db);
  }

  @OnEvent('config.init')
  async onConfigInit() {
    await this.setup(this.config.copilot?.scenarios);
  }

  @OnEvent('config.changed')
  async onConfigChanged(event: Events['config.changed']) {
    if ('copilot' in event.updates) {
      await this.setup(event.updates.copilot?.scenarios);
    }
  }

  protected async setup(scenarios?: CopilotPromptScenario) {
    this.ensureInMemoryPrompts();
    if (!!scenarios && scenarios.override_enabled && scenarios.scenarios) {
      this.logger.log('Updating prompts based on scenarios...');
      for (const [scenario, model] of Object.entries(scenarios.scenarios)) {
        const promptNames = Scenario[scenario as keyof typeof Scenario] || [];
        if (!promptNames.length) continue;
        for (const name of promptNames) {
          const prompt = prompts.find(p => p.name === name);
          if (prompt && model) {
            await this.update(
              prompt.name,
              { model, modified: true },
              { model: { not: model } }
            );
          }
        }
      }
    } else {
      this.logger.log('No scenarios enabled, using default prompts.');
      const prompts = Object.values(Scenario).flat();
      for (const prompt of prompts) {
        await this.update(prompt, { modified: false });
      }
    }
  }

  /**
   * list prompt names
   * @returns prompt names
   */
  async listNames() {
    this.ensureInMemoryPrompts();
    return Array.from(this.inMemoryPrompts.keys());
  }

  async list() {
    this.ensureInMemoryPrompts();
    return Array.from(this.inMemoryPrompts.values())
      .map(prompt => ({
        name: prompt.name,
        action: prompt.action ?? null,
        model: prompt.model,
        config: prompt.config ? structuredClone(prompt.config) : null,
        messages: prompt.messages.map(message => ({
          role: message.role,
          content: message.content,
          params: message.params ?? null,
        })),
      }))
      .sort((a, b) => {
        if (a.action === null && b.action !== null) return -1;
        if (a.action !== null && b.action === null) return 1;
        return (a.action ?? '').localeCompare(b.action ?? '');
      });
  }

  /**
   * get prompt messages by prompt name
   * @param name prompt name
   * @returns prompt messages
   */
  async get(name: string): Promise<ChatPrompt | null> {
    this.ensureInMemoryPrompts();

    // skip cache in dev mode to ensure the latest prompt is always fetched
    if (!env.dev) {
      const cached = this.cache.get(name);
      if (cached) return cached;
    }

    const prompt = this.inMemoryPrompts.get(name);
    if (!prompt) return null;

    const messages = PromptMessageSchema.array().safeParse(prompt.messages);
    const config = PromptConfigSchema.safeParse(prompt.config);
    if (messages.success && config.success) {
      const chatPrompt = ChatPrompt.createFromPrompt({
        ...this.clonePrompt(prompt),
        action: prompt.action ?? null,
        optionalModels: prompt.optionalModels ?? [],
        config: config.data,
        messages: messages.data,
      });
      this.cache.set(name, chatPrompt);
      return chatPrompt;
    }
    return null;
  }

  async set(
    name: string,
    model: string,
    messages: PromptMessage[],
    config?: PromptConfig | null,
    extraConfig?: { optionalModels: string[] }
  ) {
    this.ensureInMemoryPrompts();

    const existing = this.inMemoryPrompts.get(name);
    const mergedOptionalModels = existing?.optionalModels
      ? [...existing.optionalModels, ...(extraConfig?.optionalModels ?? [])]
      : extraConfig?.optionalModels;
    const inMemoryConfig = (!!config && structuredClone(config)) || undefined;
    const dbConfig = this.toDbConfig(config);
    this.inMemoryPrompts.set(name, {
      name,
      model,
      action: existing?.action,
      optionalModels: mergedOptionalModels,
      config: inMemoryConfig,
      messages: this.cloneMessages(messages),
    });
    this.cache.delete(name);

    try {
      return await this.db.aiPrompt
        .upsert({
          where: { name },
          create: {
            name,
            action: existing?.action,
            model,
            optionalModels: mergedOptionalModels,
            config: dbConfig,
            messages: {
              create: messages.map((m, idx) => ({
                idx,
                ...m,
                attachments: m.attachments || undefined,
                params: m.params || undefined,
              })),
            },
          },
          update: {
            model,
            optionalModels: mergedOptionalModels,
            config: dbConfig,
            updatedAt: new Date(),
            messages: {
              deleteMany: {},
              create: messages.map((m, idx) => ({
                idx,
                ...m,
                attachments: m.attachments || undefined,
                params: m.params || undefined,
              })),
            },
          },
        })
        .then(ret => ret.id);
    } catch (error) {
      this.logger.warn(
        `Compat prompt upsert failed for "${name}": ${this.stringifyError(error)}`
      );
      return -1;
    }
  }

  @Transactional()
  async update(
    name: string,
    data: {
      messages?: PromptMessage[];
      model?: string;
      modified?: boolean;
      config?: PromptConfig | null;
    },
    where?: Prisma.AiPromptWhereInput
  ) {
    this.ensureInMemoryPrompts();
    const { config, messages, model, modified } = data;

    const current = this.inMemoryPrompts.get(name);
    if (current) {
      const next = this.clonePrompt(current);
      if (model !== undefined) {
        next.model = model;
      }
      if (config === null) {
        next.config = undefined;
      } else if (config !== undefined) {
        next.config = structuredClone(config);
      }
      if (messages) {
        next.messages = this.cloneMessages(messages);
      }

      this.inMemoryPrompts.set(name, next);
      this.cache.delete(name);
    }

    try {
      const existing = await this.db.aiPrompt
        .count({ where: { ...where, name } })
        .then(count => count > 0);
      if (existing) {
        await this.db.aiPrompt.update({
          where: { name },
          data: {
            config: this.toDbConfig(config),
            updatedAt: new Date(),
            modified,
            model,
            messages: messages
              ? {
                  // cleanup old messages
                  deleteMany: {},
                  create: messages.map((m, idx) => ({
                    idx,
                    ...m,
                    attachments: m.attachments || undefined,
                    params: m.params || undefined,
                  })),
                }
              : undefined,
          },
        });
      }
    } catch (error) {
      this.logger.warn(
        `Compat prompt update failed for "${name}": ${this.stringifyError(error)}`
      );
    }
  }

  async delete(name: string) {
    this.inMemoryPrompts.delete(name);
    this.cache.delete(name);

    try {
      const { id } = await this.db.aiPrompt.delete({ where: { name } });
      return id;
    } catch (error) {
      this.logger.warn(
        `Compat prompt delete failed for "${name}": ${this.stringifyError(error)}`
      );
      return -1;
    }
  }

  private resetInMemoryPrompts() {
    this.cache.clear();
    this.inMemoryPrompts.clear();
    for (const prompt of prompts) {
      this.inMemoryPrompts.set(prompt.name, this.clonePrompt(prompt));
    }
    this.injectAutoPrompt();
  }

  /**
   * Register the `auto` prompt in-memory. The session's auto-router
   * (see `auto-router.ts`) re-routes the model on every chat-stream
   * request, so the default `model` here is just a placeholder; the
   * `optionalModels` list is intentionally generous so the picker can
   * surface any model the auto-router might choose.
   *
   * Kept out of `prompts.ts` to avoid editing the static prompt catalogue.
   */
  private injectAutoPrompt() {
    if (this.inMemoryPrompts.has('auto')) return;
    const baseChat = this.inMemoryPrompts.get('Chat With Manut AI');
    if (!baseChat) return;
    const autoPrompt = this.clonePrompt(baseChat);
    autoPrompt.name = 'auto';
    autoPrompt.optionalModels = [
      ...(baseChat.optionalModels ?? []),
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'claude-sonnet-4-5@20250929',
      // gpt-5-mini intentionally omitted: Manut's Vertex stack has no
      // OpenAI provider, so exposing this option silently breaks chat
      // for any user who picks it (CLAUDE.md §5c). Re-add only after
      // wiring an OpenAI provider.
      'llama-3.1-70b-instruct-maas',
      'llama-3.1-405b-instruct-maas',
      'mistral-large-2411',
      'codestral-2501',
      'deepseek-r1-0528-maas',
    ].filter((id, idx, arr) => arr.indexOf(id) === idx);
    this.inMemoryPrompts.set('auto', autoPrompt);
  }

  private ensureInMemoryPrompts() {
    if (!this.inMemoryPrompts.size) {
      this.resetInMemoryPrompts();
    }
  }

  private toDbConfig(
    config: PromptConfig | null | undefined
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (config === null) return Prisma.DbNull;
    if (config === undefined) return undefined;
    return config as Prisma.InputJsonValue;
  }

  private cloneMessages(messages: PromptMessage[]) {
    return messages.map(message => ({
      ...message,
      attachments: message.attachments ? [...message.attachments] : undefined,
      params: message.params ? structuredClone(message.params) : undefined,
    }));
  }

  private clonePrompt(prompt: Prompt): Prompt {
    return {
      ...prompt,
      optionalModels: prompt.optionalModels
        ? [...prompt.optionalModels]
        : undefined,
      config: prompt.config ? structuredClone(prompt.config) : undefined,
      messages: this.cloneMessages(prompt.messages),
    };
  }

  private stringifyError(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  /**
   * Manut Wave 4 (M5b) — inject memory snippets into a finalized message
   * array immediately before send-to-provider. Surfaced as a method on
   * PromptService (rather than baking into ChatPrompt.finish) so:
   *   1. The memory plumbing lives on the same DI layer as the
   *      MemoryRetrieveService (the only consumer).
   *   2. Callers without workspace / user context (legacy code paths)
   *      can skip injection trivially — there's no per-call API change.
   *
   * Wiring contract (chat-turn boundary):
   *   - controller.ts:285 builds `finalMessage` via `session.finish(...)`.
   *   - That `finalMessage` is then passed to provider.text /
   *     provider.streamText. The right insertion point is just before
   *     the provider call:
   *
   *       const memoryAware = await promptService.injectMemoriesIntoMessages(
   *         finalMessage,
   *         { workspaceId, userId, query: lastUserMessage }
   *       );
   *       return { provider, model, session, finalMessage: memoryAware };
   *
   *   - Wiring is deferred to a follow-up PR (controller.ts is outside
   *     this slice's owned files). The method is public so the wiring
   *     PR is a one-line addition.
   *
   * Behaviour:
   *   - If `retrieve` returns zero memories, returns the input array
   *     unchanged (no clone / no allocation).
   *   - If the first message is a `system` message, the memory blob is
   *     PREPENDED to that message's content. The LLM sees:
   *         <memories>…</memories>\n\n<original system prompt>
   *   - If there's no `system` message, a new one is inserted at index 0.
   *   - Failures in retrieve are absorbed silently and the original
   *     messages are returned — memory is best-effort.
   */
  async injectMemoriesIntoMessages(
    messages: PromptMessage[],
    context: {
      workspaceId: string;
      userId: string;
      query: string;
      topK?: number;
    }
  ): Promise<PromptMessage[]> {
    // Belt-and-braces guards per the v1.12.x prod incident (PR #122 chat
    // pipeline failure). Memory injection is best-effort — invalid input
    // returns the original messages immediately, never throws.
    if (!Array.isArray(messages)) {
      return messages;
    }
    if (!context || !context.workspaceId || !context.userId || !context.query) {
      return messages;
    }
    try {
      const memories = await this.memoryRetrieve.retrieve({
        workspaceId: context.workspaceId,
        userId: context.userId,
        query: context.query,
        topK: context.topK ?? 5,
        scopes: ['user', 'workspace'],
      });
      if (!memories || memories.length === 0) {
        return messages;
      }
      const memoryBlob = formatMemoriesForPrompt(memories);
      if (!memoryBlob) {
        return messages;
      }
      // Clone the messages array shallowly so the caller's reference
      // isn't mutated (immutability principle from CLAUDE.md §0 /
      // common/coding-style.md).
      const cloned = messages.map(m => ({ ...m }));
      const systemIdx = cloned.findIndex(m => m.role === 'system');
      if (systemIdx === -1) {
        cloned.unshift({
          role: 'system',
          content: memoryBlob.trimEnd(),
        } as PromptMessage);
        return cloned;
      }
      const original = cloned[systemIdx];
      cloned[systemIdx] = {
        ...original,
        content: `${memoryBlob}${original.content ?? ''}`,
      };
      return cloned;
    } catch (error) {
      this.logger.warn(
        `Memory injection failed (workspace=${context?.workspaceId ?? '?'}, user=${context?.userId ?? '?'}): ${this.stringifyError(error)}`
      );
      return messages;
    }
  }
}
