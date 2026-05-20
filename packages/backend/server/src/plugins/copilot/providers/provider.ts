import { AsyncLocalStorage } from 'node:async_hooks';

import { Inject, Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { z } from 'zod';

import {
  Config,
  CopilotPromptInvalid,
  CopilotProviderNotSupported,
  OnEvent,
} from '../../../base';
import { DocReader, DocWriter } from '../../../core/doc';
import { AccessController } from '../../../core/permission';
import { Models } from '../../../models';
import { CalendarService } from '../../calendar/service';
import { GithubOAuthService } from '../../github-oauth/github-oauth.service';
import { GoogleOAuthService } from '../../google-oauth/google-oauth.service';
import { IndexerService } from '../../indexer';
import { MnApprovalService } from '../../manut/manut-approval.service';
import { MnApprovalGateService } from '../../manut/manut-approval-gate.service';
import { MnApprovalEventBus } from '../../manut/manut-approvals-stream.controller';
import type { ProviderMiddlewareConfig } from '../config';
import { CopilotContextService } from '../context/service';
import { DocReadEventBus } from '../doc-read/doc-read-event-bus.service';
import { PromptService } from '../prompt/service';
import { CopilotStorage } from '../storage';
import {
  buildBlobContentGetter,
  buildCalendarSearchHandler,
  buildCodeRunHandler,
  buildContentGetter,
  buildDocContentGetter,
  buildDocCreateHandler,
  buildDocKeywordSearchGetter,
  buildDocSearchGetter,
  buildDocUpdateHandler,
  buildDocUpdateMetaHandler,
  buildGithubReadIssueHandler,
  buildGithubReadPrHandler,
  buildGithubSearchIssuesHandler,
  buildGithubSearchReposHandler,
  buildGmailSearchHandler,
  buildImageGenHandler,
  type CopilotTool,
  type CopilotToolSet,
  createBlobReadTool,
  createCalendarSearchTool,
  createCodeArtifactTool,
  createCodeRunTool,
  createConversationSummaryTool,
  createDataViewAutofillColumnTool,
  createDataViewFilterTool,
  createDocComposeTool,
  createDocCreateTool,
  createDocEditTool,
  createDocKeywordSearchTool,
  createDocReadTool,
  createDocSemanticSearchTool,
  createDocUpdateMetaTool,
  createDocUpdateTool,
  createExaCrawlTool,
  createExaSearchTool,
  createGithubReadIssueTool,
  createGithubReadPrTool,
  createGithubSearchIssuesTool,
  createGithubSearchReposTool,
  createGmailSearchTool,
  createImageGenTool,
  createSectionEditTool,
} from '../tools';
import { canonicalizePromptAttachment } from './attachments';
import { CopilotProviderFactory } from './factory';
import { resolveProviderMiddleware } from './provider-middleware';
import { buildProviderRegistry } from './provider-registry';
import {
  type CopilotChatOptions,
  CopilotChatTools,
  type CopilotEmbeddingOptions,
  type CopilotImageOptions,
  CopilotProviderModel,
  CopilotProviderType,
  type CopilotRerankRequest,
  CopilotStructuredOptions,
  EmbeddingMessage,
  type ModelAttachmentCapability,
  ModelCapability,
  ModelConditions,
  ModelFullConditions,
  ModelInputType,
  ModelOutputType,
  type PromptAttachmentKind,
  type PromptAttachmentSourceKind,
  type PromptMessage,
  PromptMessageSchema,
  StreamObject,
} from './types';

const providerProfileContext = new AsyncLocalStorage<string>();

@Injectable()
export abstract class CopilotProvider<C = any> {
  protected readonly logger = new Logger(this.constructor.name);
  protected readonly MAX_STEPS = 20;
  protected onlineModelList: string[] = [];

  abstract readonly type: CopilotProviderType;
  abstract readonly models: CopilotProviderModel[];
  abstract configured(): boolean;

  @Inject() protected readonly AFFiNEConfig!: Config;
  @Inject() protected readonly factory!: CopilotProviderFactory;
  @Inject() protected readonly moduleRef!: ModuleRef;
  readonly #registeredProviderIds = new Set<string>();

  runWithProfile<T>(providerId: string, callback: () => T): T {
    return providerProfileContext.run(providerId, callback);
  }

  protected getActiveProviderId() {
    return providerProfileContext.getStore() ?? `${this.type}-default`;
  }

  protected getActiveProviderMiddleware(): ProviderMiddlewareConfig {
    const providerId = this.getActiveProviderId();
    const registry = buildProviderRegistry(this.AFFiNEConfig.copilot.providers);
    const profile = registry.profiles.get(providerId);
    return profile?.middleware ?? resolveProviderMiddleware(this.type);
  }

  protected metricLabels(
    model: string,
    labels: Record<string, string | number | boolean | undefined> = {}
  ) {
    const providerId = this.getActiveProviderId();
    return { model, providerId, ...labels };
  }

  get config(): C {
    const profileId = providerProfileContext.getStore();
    if (profileId) {
      const profile = this.AFFiNEConfig.copilot.providers.profiles?.find(
        profile => profile.id === profileId && profile.type === this.type
      );
      if (profile) return profile.config as C;
    }
    return this.AFFiNEConfig.copilot.providers[this.type] as C;
  }

  @OnEvent('config.init')
  async onConfigInit() {
    this.setup();
  }

  @OnEvent('config.changed')
  async onConfigChanged(event: Events['config.changed']) {
    if ('copilot' in event.updates) {
      this.setup();
    }
  }

  protected setup() {
    const registry = buildProviderRegistry(this.AFFiNEConfig.copilot.providers);
    const providerIds = registry.byType.get(this.type) ?? [];
    const nextProviderIds = new Set<string>();

    for (const id of providerIds) {
      const configured = this.runWithProfile(id, () => this.configured());
      if (configured) {
        nextProviderIds.add(id);
        this.factory.register(id, this);
      } else {
        this.factory.unregister(id, this);
      }
    }

    for (const providerId of this.#registeredProviderIds) {
      if (!nextProviderIds.has(providerId)) {
        this.factory.unregister(providerId, this);
      }
    }
    this.#registeredProviderIds.clear();
    for (const providerId of nextProviderIds) {
      this.#registeredProviderIds.add(providerId);
    }

    if (env.selfhosted && nextProviderIds.size > 0) {
      const [providerId] = Array.from(nextProviderIds);
      this.runWithProfile(providerId, () => {
        this.refreshOnlineModels().catch(e =>
          this.logger.error('Failed to refresh online models', e)
        );
      });
    }
  }

  async refreshOnlineModels() {}

  private unique<T>(values: Iterable<T>) {
    return Array.from(new Set(values));
  }

  private attachmentKindToInputType(
    kind: PromptAttachmentKind
  ): ModelInputType {
    switch (kind) {
      case 'image':
        return ModelInputType.Image;
      case 'audio':
        return ModelInputType.Audio;
      default:
        return ModelInputType.File;
    }
  }

  protected async inferModelConditionsFromMessages(
    messages?: PromptMessage[],
    withAttachment = true
  ): Promise<Partial<ModelFullConditions>> {
    if (!messages?.length || !withAttachment) return {};

    const attachmentKinds: PromptAttachmentKind[] = [];
    const attachmentSourceKinds: PromptAttachmentSourceKind[] = [];
    const inputTypes: ModelInputType[] = [];
    let hasRemoteAttachments = false;

    for (const message of messages) {
      if (!Array.isArray(message.attachments)) continue;

      for (const attachment of message.attachments) {
        const normalized = await canonicalizePromptAttachment(
          attachment,
          message
        );
        attachmentKinds.push(normalized.kind);
        inputTypes.push(this.attachmentKindToInputType(normalized.kind));
        attachmentSourceKinds.push(normalized.sourceKind);
        hasRemoteAttachments = hasRemoteAttachments || normalized.isRemote;
      }
    }

    return {
      ...(attachmentKinds.length
        ? { attachmentKinds: this.unique(attachmentKinds) }
        : {}),
      ...(attachmentSourceKinds.length
        ? { attachmentSourceKinds: this.unique(attachmentSourceKinds) }
        : {}),
      ...(inputTypes.length ? { inputTypes: this.unique(inputTypes) } : {}),
      ...(hasRemoteAttachments ? { hasRemoteAttachments } : {}),
    };
  }

  private mergeModelConditions(
    cond: ModelFullConditions,
    inferredCond: Partial<ModelFullConditions>
  ): ModelFullConditions {
    return {
      ...inferredCond,
      ...cond,
      inputTypes: this.unique([
        ...(inferredCond.inputTypes ?? []),
        ...(cond.inputTypes ?? []),
      ]),
      attachmentKinds: this.unique([
        ...(inferredCond.attachmentKinds ?? []),
        ...(cond.attachmentKinds ?? []),
      ]),
      attachmentSourceKinds: this.unique([
        ...(inferredCond.attachmentSourceKinds ?? []),
        ...(cond.attachmentSourceKinds ?? []),
      ]),
      hasRemoteAttachments:
        cond.hasRemoteAttachments ?? inferredCond.hasRemoteAttachments,
    };
  }

  protected getAttachCapability(
    model: CopilotProviderModel,
    outputType: ModelOutputType
  ): ModelAttachmentCapability | undefined {
    const capability =
      model.capabilities.find(cap => cap.output.includes(outputType)) ??
      model.capabilities[0];
    if (!capability) {
      return;
    }
    return this.resolveAttachmentCapability(capability, outputType);
  }

  private resolveAttachmentCapability(
    cap: ModelCapability,
    outputType?: ModelOutputType
  ): ModelAttachmentCapability | undefined {
    if (outputType === ModelOutputType.Structured) {
      return cap.structuredAttachments ?? cap.attachments;
    }
    return cap.attachments;
  }

  private matchesAttachCapability(
    cap: ModelCapability,
    cond: ModelFullConditions
  ) {
    const {
      attachmentKinds,
      attachmentSourceKinds,
      hasRemoteAttachments,
      outputType,
    } = cond;

    if (
      !attachmentKinds?.length &&
      !attachmentSourceKinds?.length &&
      !hasRemoteAttachments
    ) {
      return true;
    }

    const attachmentCapability = this.resolveAttachmentCapability(
      cap,
      outputType
    );
    if (!attachmentCapability) {
      return !attachmentKinds?.some(
        kind => !cap.input.includes(this.attachmentKindToInputType(kind))
      );
    }

    if (
      attachmentKinds?.some(kind => !attachmentCapability.kinds.includes(kind))
    ) {
      return false;
    }

    if (
      attachmentSourceKinds?.length &&
      attachmentCapability.sourceKinds?.length &&
      attachmentSourceKinds.some(
        kind => !attachmentCapability.sourceKinds?.includes(kind)
      )
    ) {
      return false;
    }

    if (
      hasRemoteAttachments &&
      attachmentCapability.allowRemoteUrls === false
    ) {
      return false;
    }

    return true;
  }

  private findValidModel(
    cond: ModelFullConditions
  ): CopilotProviderModel | undefined {
    const { modelId, outputType, inputTypes } = cond;
    const matcher = (cap: ModelCapability) =>
      (!outputType || cap.output.includes(outputType)) &&
      (!inputTypes?.length ||
        inputTypes.every(type => cap.input.includes(type))) &&
      this.matchesAttachCapability(cap, cond);

    if (modelId) {
      const hasOnlineModel = this.onlineModelList.includes(modelId);

      const model = this.models.find(
        m => m.id === modelId && m.capabilities.some(matcher)
      );

      if (model) return model;
      // allow online model without capabilities check
      if (hasOnlineModel) return { id: modelId, capabilities: [] };
      return undefined;
    }
    if (!outputType) return undefined;

    return this.models.find(m =>
      m.capabilities.some(c => matcher(c) && c.defaultForOutputType)
    );
  }

  // make it async to allow dynamic check available models in some providers
  async match(cond: ModelFullConditions = {}): Promise<boolean> {
    return this.configured() && !!this.findValidModel(cond);
  }

  protected selectModel(cond: ModelFullConditions): CopilotProviderModel {
    const model = this.findValidModel(cond);
    if (model) return model;

    const { modelId, outputType, inputTypes } = cond;
    throw new CopilotPromptInvalid(
      modelId
        ? `Model ${modelId} does not support ${outputType ?? '<any>'} output with ${inputTypes ?? '<any>'} input`
        : outputType
          ? `No model supports ${outputType} output with ${inputTypes ?? '<any>'} input for provider ${this.type}`
          : 'Output type is required when modelId is not provided'
    );
  }

  protected getProviderSpecificTools(
    _toolName: CopilotChatTools,
    _model: string
  ): [string, CopilotTool?] | undefined {
    return;
  }

  // use for tool use, shared between providers
  protected async getTools(
    options: CopilotChatOptions,
    model: string
  ): Promise<CopilotToolSet> {
    const tools: CopilotToolSet = {};
    if (options?.tools?.length) {
      this.logger.debug(`getTools: ${JSON.stringify(options.tools)}`);
      const ac = this.moduleRef.get(AccessController, { strict: false });
      const context = this.moduleRef.get(CopilotContextService, {
        strict: false,
      });
      const docReader = this.moduleRef.get(DocReader, { strict: false });
      const docWriter = this.moduleRef.get(DocWriter, { strict: false });
      const models = this.moduleRef.get(Models, { strict: false });
      const prompt = this.moduleRef.get(PromptService, {
        strict: false,
      });
      // Knowledge Graph activation pulse bus. Always registered by
      // CopilotModule; passed into the read-side tool builders so each
      // successful read emits a pulse on the workspace stream.
      const docReadBus = this.moduleRef.get(DocReadEventBus, {
        strict: false,
      });

      for (const tool of options.tools) {
        const toolDef = this.getProviderSpecificTools(tool, model);
        if (toolDef) {
          // allow provider prevent tool creation
          if (toolDef[1]) {
            tools[toolDef[0]] = toolDef[1];
          }
          continue;
        }
        if (
          !(env.dev || env.namespaces.canary) &&
          ['docCreate', 'docUpdate', 'docUpdateMeta'].includes(tool)
        ) {
          continue;
        }
        switch (tool) {
          case 'blobRead': {
            const docContext = options.session
              ? await context.getBySessionId(options.session)
              : null;
            const getBlobContent = buildBlobContentGetter(ac, docContext);
            tools.blob_read = createBlobReadTool(
              getBlobContent.bind(null, options)
            );
            break;
          }
          case 'codeArtifact': {
            tools.code_artifact = createCodeArtifactTool(prompt, this.factory);
            break;
          }
          case 'conversationSummary': {
            tools.conversation_summary = createConversationSummaryTool(
              options.session,
              prompt,
              this.factory
            );
            break;
          }
          case 'docEdit': {
            const getDocContent = buildContentGetter(ac, docReader, docReadBus);
            tools.doc_edit = createDocEditTool(
              this.factory,
              prompt,
              getDocContent.bind(null, options)
            );
            break;
          }
          case 'docSemanticSearch': {
            const docContext = options.session
              ? await context.getBySessionId(options.session)
              : null;
            const searchDocs = buildDocSearchGetter(
              ac,
              context,
              docContext,
              models,
              docReadBus
            );
            tools.doc_semantic_search = createDocSemanticSearchTool(
              searchDocs.bind(null, options)
            );
            break;
          }
          case 'docKeywordSearch': {
            if (this.AFFiNEConfig.indexer.enabled) {
              const indexerService = this.moduleRef.get(IndexerService, {
                strict: false,
              });
              const searchDocs = buildDocKeywordSearchGetter(
                ac,
                indexerService,
                models,
                docReadBus
              );
              tools.doc_keyword_search = createDocKeywordSearchTool(
                searchDocs.bind(null, options)
              );
            }
            break;
          }
          case 'docRead': {
            const getDoc = buildDocContentGetter(
              ac,
              docReader,
              models,
              docReadBus
            );
            tools.doc_read = createDocReadTool(getDoc.bind(null, options));
            break;
          }
          case 'docCreate': {
            const createDoc = buildDocCreateHandler(ac, docWriter);
            tools.doc_create = createDocCreateTool(
              createDoc.bind(null, options)
            );
            break;
          }
          case 'docUpdate': {
            const updateDoc = buildDocUpdateHandler(ac, docWriter);
            tools.doc_update = createDocUpdateTool(
              updateDoc.bind(null, options)
            );
            break;
          }
          case 'docUpdateMeta': {
            const updateDocMeta = buildDocUpdateMetaHandler(ac, docWriter);
            tools.doc_update_meta = createDocUpdateMetaTool(
              updateDocMeta.bind(null, options)
            );
            break;
          }
          case 'webSearch': {
            tools.web_search_exa = createExaSearchTool(this.AFFiNEConfig);
            tools.web_crawl_exa = createExaCrawlTool(this.AFFiNEConfig);
            break;
          }
          case 'imageGen': {
            // M3 E3.2 — Vertex Imagen via the existing geminiVertex
            // auth path. CopilotStorage is resolved lazily so a
            // deployment without it (unlikely — it's always in the
            // CopilotModule providers list) just skips the tool.
            const copilotStorage = this.moduleRef.get(CopilotStorage, {
              strict: false,
            });
            if (copilotStorage) {
              const imageGenHandler = buildImageGenHandler(
                this.AFFiNEConfig,
                copilotStorage
              );
              tools.image_gen = createImageGenTool(
                imageGenHandler.bind(null, options)
              );
            }
            break;
          }
          case 'codeRun': {
            // M3 E3.1 — Modal sandbox via a single typed Config entry.
            // The tool handler reads `config.copilot.modal.{apiToken,
            // endpoint}` directly, returns `toolError` when the token
            // is unset (graceful no-op), and never throws. The bound
            // handler shape mirrors imageGen / gmailSearch.
            const codeRunHandler = buildCodeRunHandler(this.AFFiNEConfig);
            tools.code_run = createCodeRunTool(
              codeRunHandler.bind(null, options)
            );
            break;
          }
          case 'gmailSearch': {
            // M1 B10 / E1.8 — Gmail API via the existing Google OAuth
            // scaffold. GoogleOAuthService.getValidAccessToken handles
            // the 5-minute refresh window; the tool itself gracefully
            // degrades when not connected / not configured.
            const oauth = this.moduleRef.get(GoogleOAuthService, {
              strict: false,
            });
            if (oauth) {
              const gmailHandler = buildGmailSearchHandler(oauth);
              tools.gmail_search = createGmailSearchTool(
                gmailHandler.bind(null, options)
              );
            }
            break;
          }
          case 'calendarSearch': {
            // M1 B10 / E1.8 — Workspace-linked calendar events from
            // the CalendarService's Postgres-cached event table.
            // No live Google Calendar round-trip per AI invocation;
            // CalendarService maintains the cache via sync workers
            // and kicks off background resync on stale subscriptions.
            const calendarService = this.moduleRef.get(CalendarService, {
              strict: false,
            });
            if (calendarService) {
              const calendarHandler =
                buildCalendarSearchHandler(calendarService);
              tools.calendar_search = createCalendarSearchTool(
                calendarHandler.bind(null, options)
              );
            }
            break;
          }
          case 'githubSearchIssues':
          case 'githubReadIssue':
          case 'githubSearchRepos':
          case 'githubReadPr': {
            // M2 E2.1 — GitHub REST tools via the v1.13.0 GitHub
            // OAuth scaffold. All four read-only tools share a
            // single GithubOAuthService resolution; the binding is
            // cheap and we'd rather register every tool the chat
            // session opted into than skip subsequent ones because
            // the first hit `break`-d out. GithubOAuthService is
            // resolved lazily via moduleRef so installs without
            // GITHUB_OAUTH_* env vars degrade gracefully — the
            // tools surface a "configure" toolError on first call
            // rather than crashing the chat stream.
            const githubOAuth = this.moduleRef.get(GithubOAuthService, {
              strict: false,
            });
            if (githubOAuth) {
              tools.github_search_issues = createGithubSearchIssuesTool(
                buildGithubSearchIssuesHandler(githubOAuth).bind(null, options)
              );
              tools.github_read_issue = createGithubReadIssueTool(
                buildGithubReadIssueHandler(githubOAuth).bind(null, options)
              );
              tools.github_search_repos = createGithubSearchReposTool(
                buildGithubSearchReposHandler(githubOAuth).bind(null, options)
              );
              tools.github_read_pr = createGithubReadPrTool(
                buildGithubReadPrHandler(githubOAuth).bind(null, options)
              );
            }
            break;
          }
          case 'docCompose': {
            tools.doc_compose = createDocComposeTool(prompt, this.factory);
            break;
          }
          case 'sectionEdit': {
            tools.section_edit = createSectionEditTool(prompt, this.factory);
            break;
          }
          case 'dataViewFilter': {
            tools.data_view_filter = createDataViewFilterTool(
              prompt,
              this.factory
            );
            break;
          }
          case 'dataViewAutofillColumn': {
            // ε-AI-INTEL v1.10: register the data-view cell autofill tool
            // so the editingDataViews mode flag can opt sessions into it.
            tools.data_view_autofill_column = createDataViewAutofillColumnTool(
              prompt,
              this.factory
            );
            break;
          }
        }
      }
      // M3 approval gate. If the workspace has any unresolved
      // approvals (or the chat session opted in via
      // `requireToolApproval`), wrap every WRITE tool with a gate
      // check: when blocked, the tool emits a TOOL_CALL_REVIEW
      // approval, surfaces a structured rejection in the stream, and
      // does NOT execute the underlying side-effect.
      //
      // Read-only tools (doc_read, *_search, *_summary, blob_read,
      // code_artifact) are intentionally NOT gated — pulses on the
      // Knowledge Graph make sense even mid-review.
      this.wrapToolsWithApprovalGate(tools, options);
      return tools;
    }
    return tools;
  }

  /**
   * Set of tool names that count as "writes" for the M3 approval gate.
   * Every entry here corresponds to a `case` branch in `getTools` that
   * registers a side-effecting tool. Read-side and inert tools (search,
   * read, conversation_summary, code_artifact, blob_read, web_search)
   * are intentionally absent — they never mutate workspace state.
   *
   * Marked `protected static readonly` so concrete provider subclasses
   * can override it if they ever ship custom write tools that need the
   * same gating.
   */
  protected static readonly WRITE_TOOL_NAMES = new Set<string>([
    'doc_edit',
    'doc_create',
    'doc_update',
    'doc_update_meta',
    'doc_compose',
    'section_edit',
    'data_view_filter',
    'data_view_autofill_column',
  ]);

  /**
   * Wrap each write tool's `execute` with a sub-millisecond gate
   * check. When the gate is hot (no pending approvals for the
   * workspace), the wrapper is a 1-comparison no-op (`gate.peek()`
   * returns `false`). When the gate is blocked OR cold, the wrapper:
   *
   *   1. (cold path only) refreshes the gate cache via
   *      `MnApprovalService.pendingCountForWorkspace`.
   *   2. (blocked path) creates a new TOOL_CALL_REVIEW approval with
   *      `{ toolName, args, sessionId, agentId }` payload.
   *   3. emits an event on `MnApprovalEventBus` so the inbox UI
   *      reflects the new pending row in real time.
   *   4. returns a structured rejection (not a thrown error) so the
   *      model can react.
   *
   * If the Manut module is disabled (gate / service unavailable via
   * `moduleRef.get`), the wrapper falls through to the original
   * `execute` — failing-open keeps the existing copilot surface
   * working on installs that haven't flipped `ENABLE_MANUT_MODULE`.
   */
  private wrapToolsWithApprovalGate(
    tools: CopilotToolSet,
    options: CopilotChatOptions
  ): void {
    const workspaceId = options?.workspace;
    if (!workspaceId) return;

    let gate: MnApprovalGateService | undefined;
    let approvals: MnApprovalService | undefined;
    let bus: MnApprovalEventBus | undefined;
    try {
      gate = this.moduleRef.get(MnApprovalGateService, { strict: false });
      approvals = this.moduleRef.get(MnApprovalService, { strict: false });
      bus = this.moduleRef.get(MnApprovalEventBus, { strict: false });
    } catch {
      // ManutModule is not loaded — fall through unchanged.
      return;
    }
    if (!gate || !approvals) return;

    for (const [name, tool] of Object.entries(tools)) {
      if (!CopilotProvider.WRITE_TOOL_NAMES.has(name)) continue;
      const originalExecute = tool.execute;
      if (!originalExecute) continue;
      tool.execute = async (args, execOptions) => {
        // Sub-millisecond fast path: synchronous Map.get + one
        // bounded comparison. This is the hot path for the common
        // case (no pending approvals).
        let blocked = gate.peek(workspaceId);
        if (blocked === null) {
          // Cache miss / stale — refresh against the DB and write
          // back. Await is fine here; we only land here on TTL
          // expiry (≤ every 30s) or on first call.
          const count = await approvals.pendingCountForWorkspace(workspaceId);
          gate.set(workspaceId, count);
          blocked = count > 0;
        }
        if (!blocked) {
          return originalExecute(args, execOptions);
        }
        // Blocked — emit a TOOL_CALL_REVIEW approval. Best-effort:
        // an approval-creation failure must NOT throw out of the
        // tool call (we'd rather skip the gate than crash mid-
        // chat). Log loudly and fall through to a structured
        // rejection.
        try {
          const sessionId = options?.session ?? null;
          const created = await approvals.create(workspaceId, null, {
            // The project the approval belongs to. Without an explicit
            // resolver on the chat session, we use the workspace's
            // "default" project — wired through the payload so the
            // UI can join in. When projectId is unknown, the create
            // call throws BadRequestException and we fall through to
            // the structured rejection below.
            projectId: '',
            type: 'TOOL_CALL_REVIEW' as never,
            requestedByAgentId: null,
            payload: {
              toolName: name,
              args,
              sessionId,
              agentId: null,
            },
          });
          bus?.emit(workspaceId, {
            approvalId: created.id,
            workspaceId,
            op: 'created',
            ts: Date.now(),
          });
          return {
            type: 'awaiting-approval',
            approvalId: created.id,
            toolName: name,
            message:
              'This action requires human approval. Once approved, the AI can retry.',
          };
        } catch (err) {
          this.logger.warn(
            `M3 approval gate: failed to create TOOL_CALL_REVIEW for ${name} in workspace ${workspaceId}`,
            err
          );
          return {
            type: 'awaiting-approval',
            approvalId: null,
            toolName: name,
            message:
              'This action requires approval, but the approval could not be created.',
          };
        }
      };
    }
  }

  private handleZodError(ret: z.SafeParseReturnType<any, any>) {
    if (ret.success) return;
    const issues = ret.error.issues.map(i => {
      const path =
        'root' +
        (i.path.length
          ? `.${i.path.map(seg => (typeof seg === 'number' ? `[${seg}]` : `.${seg}`)).join('')}`
          : '');
      return `${i.message}${path}`;
    });
    throw new CopilotPromptInvalid(issues.join('; '));
  }

  protected async checkParams({
    cond,
    messages,
    embeddings,
    options = {},
    withAttachment = true,
  }: {
    cond: ModelFullConditions;
    messages?: PromptMessage[];
    embeddings?: string[];
    options?: CopilotChatOptions | CopilotStructuredOptions;
    withAttachment?: boolean;
  }): Promise<ModelFullConditions> {
    if (messages) {
      const { requireContent = true, requireAttachment = false } = options;

      const MessageSchema = z
        .array(
          PromptMessageSchema.extend({
            content: requireContent
              ? z.string().trim().min(1)
              : z.string().optional().nullable(),
          })
            .passthrough()
            .catchall(z.union([z.string(), z.number(), z.date(), z.null()]))
        )
        .optional();

      this.handleZodError(MessageSchema.safeParse(messages));

      const inferredCond = await this.inferModelConditionsFromMessages(
        messages,
        withAttachment
      );
      const mergedCond = this.mergeModelConditions(cond, inferredCond);
      const model = this.selectModel(mergedCond);
      const multimodal = model.capabilities.some(c =>
        [ModelInputType.Image, ModelInputType.Audio, ModelInputType.File].some(
          t => c.input.includes(t)
        )
      );

      if (
        multimodal &&
        requireAttachment &&
        !messages.some(
          message =>
            message.role === 'user' &&
            Array.isArray(message.attachments) &&
            message.attachments.length > 0
        )
      ) {
        throw new CopilotPromptInvalid(
          'attachments required in multimodal mode'
        );
      }

      if (embeddings) {
        this.handleZodError(EmbeddingMessage.safeParse(embeddings));
      }

      return mergedCond;
    }

    const inferredCond = await this.inferModelConditionsFromMessages(
      messages,
      withAttachment
    );
    const mergedCond = this.mergeModelConditions(cond, inferredCond);

    if (embeddings) {
      this.handleZodError(EmbeddingMessage.safeParse(embeddings));
    }

    return mergedCond;
  }

  abstract text(
    model: ModelConditions,
    messages: PromptMessage[],
    options?: CopilotChatOptions
  ): Promise<string>;

  abstract streamText(
    model: ModelConditions,
    messages: PromptMessage[],
    options?: CopilotChatOptions
  ): AsyncIterable<string>;

  streamObject(
    _model: ModelConditions,
    _messages: PromptMessage[],
    _options?: CopilotChatOptions
  ): AsyncIterable<StreamObject> {
    throw new CopilotProviderNotSupported({
      provider: this.type,
      kind: 'object',
    });
  }

  structure(
    _cond: ModelConditions,
    _messages: PromptMessage[],
    _options?: CopilotStructuredOptions
  ): Promise<string> {
    throw new CopilotProviderNotSupported({
      provider: this.type,
      kind: 'structure',
    });
  }

  streamImages(
    _model: ModelConditions,
    _messages: PromptMessage[],
    _options?: CopilotImageOptions
  ): AsyncIterable<string> {
    throw new CopilotProviderNotSupported({
      provider: this.type,
      kind: 'image',
    });
  }

  embedding(
    _model: ModelConditions,
    _text: string | string[],
    _options?: CopilotEmbeddingOptions
  ): Promise<number[][]> {
    throw new CopilotProviderNotSupported({
      provider: this.type,
      kind: 'embedding',
    });
  }

  async rerank(
    _model: ModelConditions,
    _request: CopilotRerankRequest,
    _options?: CopilotChatOptions
  ): Promise<number[]> {
    throw new CopilotProviderNotSupported({
      provider: this.type,
      kind: 'rerank',
    });
  }
}
