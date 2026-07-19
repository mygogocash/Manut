import { describe, it } from "vitest";

/**
 * Epic 1.3 / Phase 1 AC stubs.
 * Promote each `it.todo` to a real test when createHarness() is implemented.
 *
 * Related: https://github.com/mygogocash/Manut/issues/235
 *          https://github.com/mygogocash/Manut/issues/236
 *          https://github.com/mygogocash/Manut/issues/239
 */

describe("d1 money/approval concurrency spike", () => {
  it.todo(
    "C1 > given two identical approve POSTs with same idempotency key > then one applied command and replay-safe HTTP outcome",
  );

  it.todo(
    "C2 > given concurrent approve and reject with different keys > then exactly one terminal decision and one conflict",
  );

  it.todo(
    "C3 > given approve after already-final request > then no second state transition",
  );

  it.todo(
    "C4 > given crash after successful D1 batch before HTTP response > then retry with same key does not duplicate outbox",
  );

  it.todo(
    "C5 > given omitted batch atomicity (negative control) > then harness surfaces lost-update or partial-write failure",
  );

  it.todo(
    "C6 > given retryable D1 overload errors > then classification allows safe retry without double apply",
  );

  it.todo(
    "C7 > given tenant-A command targeting tenant-B aggregate id > then reject with zero cross-tenant rows",
  );
});
