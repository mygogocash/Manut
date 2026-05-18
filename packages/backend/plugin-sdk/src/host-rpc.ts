import type { PluginCapability } from './capabilities.js';

/**
 * Type contract for the host RPC surface that plugins call back into.
 *
 * Each method documents the capability the host requires before
 * serving the call. The plugin worker imports these types but does
 * NOT see the implementation — implementation lives in
 * `manut-plugin-host-rpc.service.ts` on the server side.
 *
 * Method signatures are intentionally JSON-friendly: only primitive
 * types, arrays, and plain objects cross the IPC boundary so the
 * wire format stays portable.
 */
export interface HostWorkspaceSummary {
  id: string;
  slug: string;
  name: string | null;
}

export interface HostDocSummary {
  workspaceId: string;
  docId: string;
  title: string | null;
  summary: string | null;
  updatedAt: string;
}

export interface HostTaskInput {
  workspaceId: string;
  projectId?: string;
  title: string;
  description?: string;
  assigneeId?: string;
  dueAt?: string;
}

export interface HostTaskSummary {
  id: string;
  workspaceId: string;
  projectId: string | null;
  title: string;
  status: string;
  assigneeId: string | null;
  createdAt: string;
}

/**
 * Each entry pairs the RPC method name with the capability needed.
 * The host RPC bridge uses this map to look up the requirement
 * BEFORE dispatching to the implementation, so a request can be
 * rejected without the implementation method ever running.
 */
export const HOST_RPC_CAPABILITIES = {
  'workspaces.list': 'read.workspace',
  'docs.read': 'read.workspace',
  'docs.write': 'write.doc',
  'tasks.create': 'tasks.create',
  'tasks.list': 'read.workspace',
  'agents.invoke': 'agents.invoke',
  'budget.snapshot': 'budget.read',
  'secrets.get': 'secrets.read',
  'network.fetch': 'network.outbound',
} as const satisfies Record<string, PluginCapability>;

export type HostRpcMethod = keyof typeof HOST_RPC_CAPABILITIES;

/**
 * Strongly-typed host RPC surface. Plugins import this type to call
 * `host.workspaces.list(...)` etc. Each method is async since the
 * underlying transport is IPC.
 *
 * The structure is grouped by domain so the call sites read like
 * `host.tasks.create(input)` rather than `hostRpc('tasks.create', input)`.
 */
export interface HostRPC {
  workspaces: {
    list(): Promise<HostWorkspaceSummary[]>;
  };
  docs: {
    read(input: {
      workspaceId: string;
      docId: string;
    }): Promise<HostDocSummary | null>;
    write(input: {
      workspaceId: string;
      docId: string;
      title?: string;
      markdown: string;
    }): Promise<{ ok: true }>;
  };
  tasks: {
    create(input: HostTaskInput): Promise<HostTaskSummary>;
    list(input: {
      workspaceId: string;
      projectId?: string;
    }): Promise<HostTaskSummary[]>;
  };
  agents: {
    invoke(input: {
      workspaceId: string;
      agentId: string;
      prompt: string;
    }): Promise<{ runId: string }>;
  };
  budget: {
    snapshot(input: {
      workspaceId: string;
    }): Promise<{ remaining: number; limit: number }>;
  };
  secrets: {
    get(input: { key: string }): Promise<{ value: string } | null>;
  };
  network: {
    fetch(input: {
      url: string;
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      headers?: Record<string, string>;
      body?: string;
    }): Promise<{
      status: number;
      headers: Record<string, string>;
      body: string;
    }>;
  };
}

/**
 * Wire-level shape for an RPC call. Plain JSON, no class instances.
 */
export interface HostRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: HostRpcMethod;
  params: unknown;
}

export interface HostRpcSuccess {
  jsonrpc: '2.0';
  id: number;
  result: unknown;
}

export interface HostRpcError {
  jsonrpc: '2.0';
  id: number;
  error: {
    code: string;
    message: string;
    data?: unknown;
  };
}

export type HostRpcResponse = HostRpcSuccess | HostRpcError;

/**
 * Plugin -> Host direction (capability-checked RPC) and Host -> Plugin
 * direction (tool/route dispatch). Both share a JSON-RPC 2.0 envelope.
 */
export interface PluginRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: 'tool.call' | 'route.call';
  params:
    | { name: string; input: unknown }
    | {
        method: string;
        path: string;
        headers: Record<string, string>;
        body: unknown;
      };
}

export type PluginRpcResponse = HostRpcResponse;
