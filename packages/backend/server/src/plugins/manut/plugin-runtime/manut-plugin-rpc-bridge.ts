import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

/**
 * JSON-RPC 2.0 bridge over Node IPC (`process.send` / `.on('message')`).
 *
 * The bridge enforces:
 *   - Strict JSON-RPC 2.0 envelope shape on both directions
 *   - A bounded outbound queue (default 1000); flooding kills the child
 *     with OVERFLOW so the host's event loop never gets buried
 *   - Per-id callback registry so concurrent in-flight calls cannot
 *     collide
 *   - A teardown path that rejects every pending caller when the
 *     transport dies, preventing dangling promises
 *
 * The bridge is transport-agnostic at the type level — we accept any
 * object with `send`, `on('message')`, `kill`, and `pid`. Tests pass
 * a fake duplex; production passes a `ChildProcess`.
 */

export interface RpcTransport extends EventEmitter {
  readonly pid?: number;
  readonly connected?: boolean;
  send(message: unknown, cb?: (err: Error | null) => void): boolean;
  kill(signal?: NodeJS.Signals | number): boolean;
}

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: unknown;
}

export interface JsonRpcSuccess {
  jsonrpc: '2.0';
  id: number;
  result: unknown;
}

export interface JsonRpcError {
  jsonrpc: '2.0';
  id: number;
  error: {
    code: string;
    message: string;
    data?: unknown;
  };
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

export type IncomingHandler = (
  method: string,
  params: unknown
) => Promise<unknown>;

export interface RpcBridgeOptions {
  /** Max outbound messages buffered before we kill the child. */
  queueLimit?: number;
  /** Default per-call timeout, ms. */
  callTimeoutMs?: number;
  /** Logger hook for telemetry. */
  log?: (event: string, data: Record<string, unknown>) => void;
}

const DEFAULT_QUEUE_LIMIT = 1000;
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Tracks one in-flight outbound RPC. Resolved when a matching response
 * id arrives; rejected by `dispose()` on transport teardown.
 */
interface PendingCall {
  resolve(result: unknown): void;
  reject(err: Error): void;
  timer: NodeJS.Timeout;
  method: string;
}

export class ManutPluginRpcBridge {
  private readonly pending = new Map<number, PendingCall>();
  private incomingHandler: IncomingHandler | null = null;
  private nextId = 1;
  private outboundQueueDepth = 0;
  private disposed = false;
  private readonly queueLimit: number;
  private readonly callTimeoutMs: number;
  private readonly log: NonNullable<RpcBridgeOptions['log']>;
  private readonly onMessage = (raw: unknown): void => this.handleMessage(raw);

  constructor(
    private readonly transport: RpcTransport,
    options: RpcBridgeOptions = {}
  ) {
    this.queueLimit = options.queueLimit ?? DEFAULT_QUEUE_LIMIT;
    this.callTimeoutMs = options.callTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.log = options.log ?? (() => {});
    this.transport.on('message', this.onMessage);
  }

  /**
   * Register the handler that services inbound RPC requests. Calling
   * this twice replaces the handler — useful for re-binding after a
   * reload, but the host runtime currently only registers once at
   * spawn time.
   */
  setIncomingHandler(handler: IncomingHandler): void {
    this.incomingHandler = handler;
  }

  /**
   * Send a JSON-RPC request and wait for its response. Rejects with
   * `RpcOverflowError` when the outbound queue is saturated and with
   * `RpcTimeoutError` when the peer never responds within the budget.
   */
  async call(method: string, params: unknown): Promise<unknown> {
    if (this.disposed) {
      throw new RpcDisposedError(
        `bridge for pid=${this.transport.pid ?? '?'} is disposed`
      );
    }
    if (this.outboundQueueDepth >= this.queueLimit) {
      this.killWithOverflow();
      throw new RpcOverflowError(
        `outbound queue exceeded ${this.queueLimit} (method=${method})`
      );
    }

    const id = this.nextId++;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return await new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new RpcTimeoutError(
            `rpc '${method}' (id=${id}) timed out after ${this.callTimeoutMs}ms`
          )
        );
      }, this.callTimeoutMs);
      // Don't keep the host event loop alive on the timer alone — the
      // child process and bridge are the long-lived references.
      timer.unref?.();

      this.pending.set(id, { resolve, reject, timer, method });
      this.outboundQueueDepth++;
      try {
        const ok = this.transport.send(request, err => {
          this.outboundQueueDepth = Math.max(0, this.outboundQueueDepth - 1);
          if (err) {
            const pending = this.pending.get(id);
            if (pending) {
              clearTimeout(pending.timer);
              this.pending.delete(id);
              reject(err);
            }
          }
        });
        if (!ok) {
          // backpressure — IPC channel is full. Treat as overflow so
          // the supervisor can decide whether to restart.
          this.outboundQueueDepth = Math.max(0, this.outboundQueueDepth - 1);
          this.pending.delete(id);
          clearTimeout(timer);
          this.killWithOverflow();
          reject(
            new RpcOverflowError(
              `transport refused message; killed child with OVERFLOW`
            )
          );
        }
      } catch (err: unknown) {
        this.outboundQueueDepth = Math.max(0, this.outboundQueueDepth - 1);
        this.pending.delete(id);
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  /**
   * Tear down the bridge. Pending calls reject with `RpcDisposedError`.
   * Safe to call multiple times.
   */
  dispose(reason: string): void {
    if (this.disposed) return;
    this.disposed = true;
    this.transport.off?.('message', this.onMessage);
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(
        new RpcDisposedError(
          `bridge disposed (${reason}) while waiting on '${pending.method}' (id=${id})`
        )
      );
    }
    this.pending.clear();
  }

  private handleMessage(raw: unknown): void {
    if (this.disposed) return;

    if (!isJsonRpcEnvelope(raw)) {
      this.log('rpc.malformed', { raw });
      return;
    }

    if ('method' in raw && raw.method !== undefined) {
      // Inbound request from the plugin -> host RPC.
      this.dispatchIncoming(raw).catch(() => {
        /* dispatchIncoming swallows its own errors and sends a JSON-RPC
         * error response; this catch is purely defensive against an
         * unexpected throw before the response is sent. */
      });
      return;
    }

    // Response to a pending outbound call.
    const id = raw.id;
    const pending = this.pending.get(id);
    if (!pending) {
      this.log('rpc.orphan-response', { id });
      return;
    }
    clearTimeout(pending.timer);
    this.pending.delete(id);
    if ('error' in raw && raw.error) {
      pending.reject(
        Object.assign(new Error(raw.error.message), {
          code: raw.error.code,
          data: raw.error.data,
        })
      );
      return;
    }
    pending.resolve((raw as JsonRpcSuccess).result);
  }

  private async dispatchIncoming(req: JsonRpcRequest): Promise<void> {
    if (!this.incomingHandler) {
      this.sendResponse(req.id, {
        error: {
          code: 'no_handler',
          message: 'host has not registered an incoming handler',
        },
      });
      return;
    }
    try {
      const result = await this.incomingHandler(req.method, req.params);
      this.sendResponse(req.id, { result });
    } catch (err: unknown) {
      const error =
        err instanceof Error
          ? {
              code: (err as Error & { code?: string }).code ?? 'internal_error',
              message: err.message,
            }
          : { code: 'internal_error', message: String(err) };
      this.sendResponse(req.id, { error });
    }
  }

  private sendResponse(
    id: number,
    body: { result: unknown } | { error: { code: string; message: string } }
  ): void {
    if (this.disposed) return;
    const response: JsonRpcResponse =
      'error' in body
        ? { jsonrpc: '2.0', id, error: body.error }
        : { jsonrpc: '2.0', id, result: body.result };
    try {
      this.transport.send(response);
    } catch (err: unknown) {
      this.log('rpc.send-failed', { err: String(err) });
    }
  }

  private killWithOverflow(): void {
    this.log('rpc.overflow', {
      pid: this.transport.pid,
      depth: this.outboundQueueDepth,
    });
    try {
      // SIGTERM with code mapping happens in the supervisor; we just
      // signal that this child has misbehaved. Using SIGKILL guarantees
      // the supervisor's `exit` listener fires.
      this.transport.kill('SIGKILL');
    } catch {
      // Already dead; supervisor will clean up.
    }
  }
}

function isJsonRpcEnvelope(
  raw: unknown
): raw is JsonRpcRequest | JsonRpcResponse {
  if (typeof raw !== 'object' || raw === null) return false;
  const obj = raw as Record<string, unknown>;
  if (obj['jsonrpc'] !== '2.0') return false;
  if (typeof obj['id'] !== 'number') return false;
  return true;
}

export class RpcOverflowError extends Error {
  readonly code = 'rpc_overflow' as const;
  constructor(message: string) {
    super(message);
    this.name = 'RpcOverflowError';
  }
}

export class RpcTimeoutError extends Error {
  readonly code = 'rpc_timeout' as const;
  constructor(message: string) {
    super(message);
    this.name = 'RpcTimeoutError';
  }
}

export class RpcDisposedError extends Error {
  readonly code = 'rpc_disposed' as const;
  constructor(message: string) {
    super(message);
    this.name = 'RpcDisposedError';
  }
}

/**
 * Type guard re-exported for tests that need to manufacture transports.
 */
export type { ChildProcess };
