import { DurableObject } from "cloudflare:workers";

import { sha256Base64Url } from "./crypto";
import { isRecord } from "./http-error";
import type { RuntimeBindings } from "./runtime";

export type EdgeJobKind = "maintenance.cron" | "upload.finalized";

export interface EdgeJobEnvelope {
  idempotencyKey: string;
  kind: EdgeJobKind;
  occurredAt: string;
  payload: Record<string, unknown>;
  version: 1;
}

export interface DeadLetterEnvelope {
  attempts: number;
  bodyDigest: string;
  failedAt: string;
  originalMessageId: string;
  reasonCode: string;
  version: 1;
}

export interface QueueMessageLike {
  readonly attempts: number;
  readonly body: unknown;
  readonly id: string;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
}

export interface QueueBatchLike {
  readonly messages: readonly QueueMessageLike[];
}

export type LedgerClaim = "busy" | "claimed" | "duplicate";

interface LedgerRecord {
  completedAt?: number;
  idempotencyKey: string;
  leaseUntil?: number;
  status: "completed" | "processing";
}

export class QueueLedger extends DurableObject<RuntimeBindings> {
  async claim(idempotencyKey: string, now: number): Promise<LedgerClaim> {
    if (
      !idempotencyKey ||
      idempotencyKey.length > 200 ||
      !Number.isSafeInteger(now)
    ) {
      throw new Error("Invalid idempotency claim.");
    }
    const existing = await this.ctx.storage.get<LedgerRecord>("record");
    if (existing?.status === "completed") return "duplicate";
    if (existing?.status === "processing" && (existing.leaseUntil ?? 0) > now) {
      return "busy";
    }

    await this.ctx.storage.put<LedgerRecord>("record", {
      idempotencyKey,
      leaseUntil: now + 5 * 60 * 1000,
      status: "processing",
    });
    return "claimed";
  }

  async complete(idempotencyKey: string, now: number): Promise<void> {
    const existing = await this.ctx.storage.get<LedgerRecord>("record");
    if (existing?.idempotencyKey !== idempotencyKey) {
      throw new Error("Idempotency ownership changed.");
    }
    await this.ctx.storage.put<LedgerRecord>("record", {
      completedAt: now,
      idempotencyKey,
      status: "completed",
    });
  }

  async release(idempotencyKey: string): Promise<void> {
    const existing = await this.ctx.storage.get<LedgerRecord>("record");
    if (
      existing?.idempotencyKey === idempotencyKey &&
      existing.status === "processing"
    ) {
      await this.ctx.storage.delete("record");
    }
  }
}

export class PermanentJobError extends Error {
  constructor(readonly reasonCode: string) {
    super(reasonCode);
    this.name = "PermanentJobError";
  }
}

function parseJobEnvelope(value: unknown): EdgeJobEnvelope | null {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    (value.kind !== "maintenance.cron" && value.kind !== "upload.finalized") ||
    typeof value.idempotencyKey !== "string" ||
    value.idempotencyKey.length < 1 ||
    value.idempotencyKey.length > 200 ||
    typeof value.occurredAt !== "string" ||
    !Number.isFinite(Date.parse(value.occurredAt)) ||
    !isRecord(value.payload)
  ) {
    return null;
  }
  return {
    idempotencyKey: value.idempotencyKey,
    kind: value.kind,
    occurredAt: value.occurredAt,
    payload: value.payload,
    version: 1,
  };
}

function stableBody(value: unknown): string {
  try {
    const serialized = JSON.stringify(value);
    return serialized.length <= 32 * 1024
      ? serialized
      : serialized.slice(0, 32 * 1024);
  } catch {
    return "[unserializable]";
  }
}

async function deadLetterFor(
  message: QueueMessageLike,
  reasonCode: string,
  now: number,
): Promise<DeadLetterEnvelope> {
  return {
    attempts: message.attempts,
    bodyDigest: await sha256Base64Url(stableBody(message.body)),
    failedAt: new Date(now).toISOString(),
    originalMessageId: message.id,
    reasonCode,
    version: 1,
  };
}

export interface QueueConsumerDependencies {
  claim(job: EdgeJobEnvelope, now: number): Promise<LedgerClaim>;
  complete(job: EdgeJobEnvelope, now: number): Promise<void>;
  deadLetter(envelope: DeadLetterEnvelope): Promise<void>;
  now(): number;
  process(job: EdgeJobEnvelope): Promise<void>;
  release(job: EdgeJobEnvelope): Promise<void>;
}

async function releaseForRetry(
  dependencies: QueueConsumerDependencies,
  job: EdgeJobEnvelope,
  message: QueueMessageLike,
  delaySeconds: number,
): Promise<void> {
  try {
    await dependencies.release(job);
  } catch {
    // A failed release leaves the short lease in place. The retry remains safe:
    // admission reports busy until that lease expires instead of processing twice.
  }
  message.retry({ delaySeconds });
}

export async function processQueueBatch(
  batch: QueueBatchLike,
  dependencies: QueueConsumerDependencies,
): Promise<void> {
  for (const message of batch.messages) {
    const now = dependencies.now();
    const job = parseJobEnvelope(message.body);
    if (!job) {
      try {
        await dependencies.deadLetter(
          await deadLetterFor(message, "INVALID_JOB_ENVELOPE", now),
        );
        message.ack();
      } catch {
        message.retry({ delaySeconds: 60 });
      }
      continue;
    }

    let claim: LedgerClaim;
    try {
      claim = await dependencies.claim(job, now);
    } catch {
      message.retry({ delaySeconds: 30 });
      continue;
    }
    if (claim === "duplicate") {
      message.ack();
      continue;
    }
    if (claim === "busy") {
      message.retry({ delaySeconds: 30 });
      continue;
    }

    try {
      await dependencies.process(job);
      await dependencies.complete(job, dependencies.now());
      message.ack();
    } catch (error) {
      if (error instanceof PermanentJobError) {
        try {
          await dependencies.deadLetter(
            await deadLetterFor(message, error.reasonCode, dependencies.now()),
          );
          await dependencies.complete(job, dependencies.now());
          message.ack();
        } catch {
          await releaseForRetry(dependencies, job, message, 60);
        }
      } else {
        await releaseForRetry(dependencies, job, message, 60);
      }
    }
  }
}

async function processEdgeJob(
  job: EdgeJobEnvelope,
  env: RuntimeBindings,
): Promise<void> {
  if (job.kind === "upload.finalized") {
    const manifestKey = job.payload.manifestKey;
    if (
      typeof manifestKey !== "string" ||
      !manifestKey.startsWith("manifests/")
    ) {
      throw new PermanentJobError("INVALID_UPLOAD_MANIFEST_KEY");
    }
    if (!(await env.UPLOADS.head(manifestKey))) {
      throw new Error("Upload manifest is not yet visible.");
    }
  }
  console.log(
    JSON.stringify({
      idempotencyKey: job.idempotencyKey,
      kind: job.kind,
      message: "edge job admitted",
    }),
  );
}

export async function consumeQueue(
  batch: MessageBatch<unknown>,
  env: RuntimeBindings,
): Promise<void> {
  const ledgerNamespace = env.QUEUE_LEDGER;
  const ledgerFor = async (job: EdgeJobEnvelope) =>
    ledgerNamespace.getByName(await sha256Base64Url(job.idempotencyKey));

  await processQueueBatch(batch, {
    claim: async (job, now) =>
      (await ledgerFor(job)).claim(job.idempotencyKey, now),
    complete: async (job, now) =>
      (await ledgerFor(job)).complete(job.idempotencyKey, now),
    deadLetter: async (envelope) => {
      await env.DEAD_LETTER_QUEUE.send(envelope);
    },
    now: () => Date.now(),
    process: (job) => processEdgeJob(job, env),
    release: async (job) => (await ledgerFor(job)).release(job.idempotencyKey),
  });
}
