import { describe, expect, it, vi } from "vitest";

import {
  type DeadLetterEnvelope,
  type EdgeJobEnvelope,
  PermanentJobError,
  processQueueBatch,
  type QueueConsumerDependencies,
  type QueueMessageLike,
} from "../src/queue";

interface MessageState {
  acknowledged: boolean;
  retryDelay: number | null;
}

function queueMessage(
  body: unknown,
  id: string,
): {
  message: QueueMessageLike;
  state: MessageState;
} {
  const state: MessageState = { acknowledged: false, retryDelay: null };
  return {
    message: {
      attempts: 1,
      body,
      id,
      ack: () => {
        state.acknowledged = true;
      },
      retry: (options) => {
        state.retryDelay = options?.delaySeconds ?? 0;
      },
    },
    state,
  };
}

function job(idempotencyKey = "job-1"): EdgeJobEnvelope {
  return {
    idempotencyKey,
    kind: "maintenance.cron",
    occurredAt: "2026-07-17T00:00:00.000Z",
    payload: { cron: "0 * * * *" },
    version: 1,
  };
}

describe("queue admission", () => {
  it("processes an idempotency key once and acknowledges its replay", async () => {
    let completed = false;
    const process = vi.fn(async () => undefined);
    const complete = vi.fn(async () => {
      completed = true;
    });
    const dependencies: QueueConsumerDependencies = {
      claim: vi.fn(async () =>
        completed ? ("duplicate" as const) : ("claimed" as const),
      ),
      complete,
      deadLetter: vi.fn(async () => undefined),
      now: () => Date.parse("2026-07-17T00:00:00.000Z"),
      process,
      release: vi.fn(async () => undefined),
    };
    const first = queueMessage(job(), "message-1");
    const replay = queueMessage(job(), "message-2");

    await processQueueBatch({ messages: [first.message] }, dependencies);
    await processQueueBatch({ messages: [replay.message] }, dependencies);

    expect(process).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledOnce();
    expect(first.state).toEqual({ acknowledged: true, retryDelay: null });
    expect(replay.state).toEqual({ acknowledged: true, retryDelay: null });
  });

  it("dead-letters malformed jobs without copying their body", async () => {
    const deadLetters: DeadLetterEnvelope[] = [];
    const dependencies: QueueConsumerDependencies = {
      claim: vi.fn(async () => "claimed" as const),
      complete: vi.fn(async () => undefined),
      deadLetter: vi.fn(async (envelope) => {
        deadLetters.push(envelope);
      }),
      now: () => Date.parse("2026-07-17T00:00:00.000Z"),
      process: vi.fn(async () => undefined),
      release: vi.fn(async () => undefined),
    };
    const invalid = queueMessage(
      { credential: "must-not-be-copied" },
      "message-invalid",
    );

    await processQueueBatch({ messages: [invalid.message] }, dependencies);

    expect(invalid.state.acknowledged).toBe(true);
    expect(deadLetters).toHaveLength(1);
    expect(deadLetters[0]).toMatchObject({
      originalMessageId: "message-invalid",
      reasonCode: "INVALID_JOB_ENVELOPE",
    });
    expect(deadLetters[0]).not.toHaveProperty("body");
    expect(JSON.stringify(deadLetters[0])).not.toContain("must-not-be-copied");
  });

  it("completes permanent failures only after the dead letter is accepted", async () => {
    const complete = vi.fn(async () => undefined);
    const release = vi.fn(async () => undefined);
    const dependencies: QueueConsumerDependencies = {
      claim: vi.fn(async () => "claimed" as const),
      complete,
      deadLetter: vi.fn(async () => undefined),
      now: () => Date.parse("2026-07-17T00:00:00.000Z"),
      process: vi.fn(async () => {
        throw new PermanentJobError("UNSUPPORTED_JOB");
      }),
      release,
    };
    const failed = queueMessage(job(), "message-failed");

    await processQueueBatch({ messages: [failed.message] }, dependencies);

    expect(failed.state.acknowledged).toBe(true);
    expect(complete).toHaveBeenCalledOnce();
    expect(release).not.toHaveBeenCalled();
  });

  it("requests a retry even when releasing the processing lease fails", async () => {
    const failed = queueMessage(job(), "message-transient");
    await processQueueBatch(
      { messages: [failed.message] },
      {
        claim: vi.fn(async () => "claimed" as const),
        complete: vi.fn(async () => undefined),
        deadLetter: vi.fn(async () => undefined),
        now: () => Date.parse("2026-07-17T00:00:00.000Z"),
        process: vi.fn(async () => {
          throw new Error("temporary downstream failure");
        }),
        release: vi.fn(async () => {
          throw new Error("temporary ledger failure");
        }),
      },
    );

    expect(failed.state).toEqual({ acknowledged: false, retryDelay: 60 });
  });
});
