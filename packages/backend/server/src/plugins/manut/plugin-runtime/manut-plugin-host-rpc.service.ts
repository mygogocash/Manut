import { randomUUID } from 'node:crypto';

import {
  CapabilityDeniedError,
  HOST_RPC_CAPABILITIES,
  type HostDocSummary,
  type HostRpcMethod,
  type HostTaskInput,
  type HostTaskSummary,
  type HostWorkspaceSummary,
  type PluginCapability,
} from '@manut/plugin-sdk';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Host-side implementation of the `HostRPC` surface defined in
 * `@manut/plugin-sdk`. Every method is dispatched by name through
 * `dispatch()`, which gates on the capabilities declared in the
 * plugin's manifest BEFORE forwarding to the implementation.
 *
 * A denied call returns a structured error to the caller — never
 * thrown into the plugin process and never crashes the host. The
 * IPC bridge catches the thrown `CapabilityDeniedError` and wraps
 * it into the JSON-RPC error envelope (see manut-plugin-rpc-bridge.ts).
 *
 * `@Injectable()` is required so TS emits `design:paramtypes` and
 * NestJS DI can resolve `PrismaClient` (v1.12.0 production scar).
 * `PrismaClient` is a RUNTIME import for the same reason — `import type`
 * on DI targets erases the metadata and the host fails to start.
 */
@Injectable()
export class ManutPluginHostRpcService {
  private readonly logger = new Logger(ManutPluginHostRpcService.name);

  constructor(private readonly db: PrismaClient) {}

  /**
   * Entry point used by the runtime bridge for every inbound call.
   * Inspect the granted-capability list FIRST so a misbehaving plugin
   * cannot reach implementations it didn't declare.
   */
  async dispatch(
    method: string,
    params: unknown,
    grantedCapabilities: ReadonlyArray<string>
  ): Promise<unknown> {
    if (!isKnownRpcMethod(method)) {
      throw new HostRpcError(
        'unknown_method',
        `unknown RPC method '${method}'`
      );
    }
    const required: PluginCapability = HOST_RPC_CAPABILITIES[method];
    if (!grantedCapabilities.includes(required)) {
      throw new CapabilityDeniedError(required, grantedCapabilities);
    }

    switch (method) {
      case 'workspaces.list':
        return await this.listWorkspaces();
      case 'docs.read':
        return await this.readDoc(params);
      case 'docs.write':
        return await this.writeDoc(params);
      case 'tasks.create':
        return await this.createTask(params);
      case 'tasks.list':
        return await this.listTasks(params);
      case 'agents.invoke':
        return await this.invokeAgent(params);
      case 'budget.snapshot':
        return await this.budgetSnapshot(params);
      case 'secrets.get':
        return await this.getSecret(params);
      case 'network.fetch':
        return await this.networkFetch(params);
    }
    // Exhaustiveness fallthrough — `isKnownRpcMethod` rules everything
    // else out. The compiler refuses to narrow the switch otherwise.
    throw new HostRpcError(
      'unknown_method',
      `unhandled method '${String(method)}'`
    );
  }

  // ---------------------------------------------------------------------
  // Implementations. Kept thin: data invariants are owned by the
  // existing M1-M5 services; this surface is a JSON-friendly adapter.
  // ---------------------------------------------------------------------

  private async listWorkspaces(): Promise<HostWorkspaceSummary[]> {
    const rows = await this.db.workspace.findMany({
      select: { id: true, slug: true, name: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map(r => ({ id: r.id, slug: r.slug, name: r.name }));
  }

  private async readDoc(params: unknown): Promise<HostDocSummary | null> {
    const input = expectObject(params, ['workspaceId', 'docId']);
    const row = await this.db.workspaceDoc.findUnique({
      where: {
        workspaceId_docId: {
          workspaceId: String(input.workspaceId),
          docId: String(input.docId),
        },
      },
      select: {
        workspaceId: true,
        docId: true,
        title: true,
        summary: true,
        publishedAt: true,
      },
    });
    if (!row) return null;
    return {
      workspaceId: row.workspaceId,
      docId: row.docId,
      title: row.title,
      summary: row.summary,
      updatedAt: (row.publishedAt ?? new Date()).toISOString(),
    };
  }

  private async writeDoc(_params: unknown): Promise<{ ok: true }> {
    // Real doc writes flow through `DocWriter` which lives in
    // packages/backend/server/src/core/doc. M6a stubs this to a
    // capability-gated no-op so the contract surface compiles; the
    // first plugin that needs `write.doc` (M6b's templates app) wires
    // the real DocWriter call here.
    this.logger.warn(
      'docs.write called: stub returns ok=true; wire DocWriter for real writes'
    );
    return { ok: true };
  }

  private async createTask(params: unknown): Promise<HostTaskSummary> {
    const input = expectObject(params, ['workspaceId', 'title']) as Record<
      string,
      unknown
    > &
      HostTaskInput;
    // Defer to the existing MnTask model directly (no resolver call so
    // there's no authn frame). The plugin's capability already gated
    // this call; downstream services treat the plugin as a system
    // actor identified by its plugin id (logged via the bridge).
    const projectId =
      typeof input.projectId === 'string' && input.projectId.length > 0
        ? input.projectId
        : await this.ensureDefaultProject(String(input.workspaceId));

    const row = await this.db.mnTask.create({
      data: {
        id: randomUUID(),
        projectId,
        title: String(input.title),
        description:
          typeof input.description === 'string' ? input.description : null,
        assigneeUserId:
          typeof input.assigneeId === 'string' ? input.assigneeId : null,
        dueAt: typeof input.dueAt === 'string' ? new Date(input.dueAt) : null,
        createdByUserId: null,
      },
    });
    return {
      id: row.id,
      workspaceId: String(input.workspaceId),
      projectId: row.projectId,
      title: row.title,
      status: row.status,
      assigneeId: row.assigneeUserId,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async listTasks(params: unknown): Promise<HostTaskSummary[]> {
    const input = expectObject(params, ['workspaceId']);
    const projectFilter =
      typeof input.projectId === 'string'
        ? { id: String(input.projectId) }
        : {};
    const projects = await this.db.mnProject.findMany({
      where: { workspaceId: String(input.workspaceId), ...projectFilter },
      select: { id: true },
      take: 100,
    });
    if (projects.length === 0) return [];

    const rows = await this.db.mnTask.findMany({
      where: { projectId: { in: projects.map(p => p.id) } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map(r => ({
      id: r.id,
      workspaceId: String(input.workspaceId),
      projectId: r.projectId,
      title: r.title,
      status: r.status,
      assigneeId: r.assigneeUserId,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  private async invokeAgent(_params: unknown): Promise<{ runId: string }> {
    // Real invocation enqueues a copilot session; for M6a we return a
    // placeholder runId so plugin authors can wire the call site. The
    // copilot SessionService is hooked here in M6b.
    const runId = randomUUID();
    this.logger.warn(`agents.invoke stubbed; returning runId=${runId}`);
    return { runId };
  }

  private async budgetSnapshot(
    params: unknown
  ): Promise<{ remaining: number; limit: number }> {
    const input = expectObject(params, ['workspaceId']);
    // Use the existing MnBudgetScope.WORKSPACE row when present;
    // otherwise return zeros (no budget configured).
    const budgets = await this.db.mnBudget.findMany({
      where: {
        workspaceId: String(input.workspaceId),
        scopeType: 'WORKSPACE',
      },
      take: 1,
    });
    const limit = Number(budgets[0]?.capCents ?? 0) / 100;
    const spentRow = await this.db.mnCostEvent.aggregate({
      where: { workspaceId: String(input.workspaceId) },
      _sum: { costCents: true },
    });
    const spentCents = spentRow._sum?.costCents ?? 0;
    const remaining = Math.max(0, limit - Number(spentCents) / 100);
    return { remaining, limit };
  }

  private async getSecret(_params: unknown): Promise<{ value: string } | null> {
    // M6a does not expose real secret storage to plugins. Returning
    // `null` keeps the contract honest; M6c will wire HashiCorp
    // Vault / GCP Secret Manager bridges here.
    return null;
  }

  private async networkFetch(params: unknown): Promise<{
    status: number;
    headers: Record<string, string>;
    body: string;
  }> {
    const input = expectObject(params, ['url']);
    const url = String(input.url);
    if (!/^https?:\/\//i.test(url)) {
      throw new HostRpcError(
        'invalid_url',
        'network.fetch requires an http(s) URL'
      );
    }
    const method =
      typeof input.method === 'string' ? input.method.toUpperCase() : 'GET';
    const headers =
      input.headers && typeof input.headers === 'object'
        ? (input.headers as Record<string, string>)
        : {};
    const body = typeof input.body === 'string' ? input.body : undefined;
    const res = await fetch(url, { method, headers, body });
    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    return {
      status: res.status,
      headers: responseHeaders,
      body: await res.text(),
    };
  }

  private async ensureDefaultProject(workspaceId: string): Promise<string> {
    const existing = await this.db.mnProject.findFirst({
      where: { workspaceId },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing.id;
    const created = await this.db.mnProject.create({
      data: {
        id: randomUUID(),
        workspaceId,
        name: 'Plugin Tasks',
      },
    });
    return created.id;
  }
}

function isKnownRpcMethod(method: string): method is HostRpcMethod {
  return method in HOST_RPC_CAPABILITIES;
}

function expectObject(
  params: unknown,
  requiredKeys: string[]
): Record<string, unknown> {
  if (typeof params !== 'object' || params === null) {
    throw new HostRpcError(
      'invalid_params',
      `expected object, got ${typeof params}`
    );
  }
  const obj = params as Record<string, unknown>;
  for (const key of requiredKeys) {
    if (!(key in obj)) {
      throw new HostRpcError('invalid_params', `missing required key '${key}'`);
    }
  }
  return obj;
}

export class HostRpcError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'HostRpcError';
  }
}
