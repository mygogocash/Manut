/**
 * Stub harness for Epic 1.3 D1 money/approval concurrency.
 * Replace createHarness() with a real D1/miniflare fixture in a follow-up PR.
 */

export type TenantId = "tenant-a" | "tenant-b";

export type MoneyApprovalAggregate = {
  id: string;
  tenantId: TenantId;
  /** Optimistic concurrency token (integer version). */
  version: number;
  status: "pending" | "approved" | "rejected";
  /** THB as integer satang. */
  amountSatang: number;
};

export type ApplyCommandInput = {
  tenantId: TenantId;
  aggregateId: string;
  type: "approve" | "reject";
  idempotencyKey: string;
  expectedVersion: number;
  actorUserId: string;
};

export type ApplyCommandResult = {
  outcome: "applied" | "replayed" | "conflict" | "rejected";
  aggregate: MoneyApprovalAggregate | null;
  commandId: string | null;
};

export type D1MoneyApprovalHarness = {
  seedPending(aggregate: MoneyApprovalAggregate): Promise<void>;
  apply(input: ApplyCommandInput): Promise<ApplyCommandResult>;
  /** Fire N concurrent applies; used by C1/C2. */
  applyConcurrent(
    inputs: ApplyCommandInput[],
  ): Promise<ApplyCommandResult[]>;
  getAggregate(
    tenantId: TenantId,
    aggregateId: string,
  ): Promise<MoneyApprovalAggregate | null>;
  countCommands(tenantId: TenantId, aggregateId: string): Promise<number>;
  countOutbox(tenantId: TenantId, aggregateId: string): Promise<number>;
  dispose(): Promise<void>;
};

export type CreateHarnessOptions = {
  /** When true, deliberately omit batch atomicity (C5 negative control). */
  omitBatchAtomicity?: boolean;
};

/**
 * Not implemented — spike scaffold only.
 * @throws always until D1 fixture lands
 */
export function createHarness(
  _options: CreateHarnessOptions = {},
): Promise<D1MoneyApprovalHarness> {
  return Promise.reject(
    new Error(
      "d1-money-approval harness not implemented — see docs/architecture/d1-money-approval-concurrency-spike.md",
    ),
  );
}
