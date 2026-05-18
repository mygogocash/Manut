/**
 * M11 — Enforced Outcomes verifier spec.
 *
 * Each predicate kind has its own happy + sad path. URL_REACHABLE
 * mocks the fetcher via the test-only setter. WORK_PRODUCT_EXISTS
 * also covers the "M10 not deployed" branch — the verifier MUST NOT
 * crash on a Prisma client that doesn't yet expose `mnWorkProduct`
 * (CLAUDE.md scope-drift discipline: defensive runtime detection).
 *
 * The status-transition gate is exercised at the verifier boundary
 * (`assertCanTransitionToDone`) so it can be unit-tested without
 * booting the resolver. The PM resolver test that wires the gate
 * end-to-end lives elsewhere.
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import test from 'ava';

import { MnDoDPredicateKind } from '../../plugins/manut/manut-outcome-verifier.dto';
import type { FetchLike } from '../../plugins/manut/manut-outcome-verifier.service';
import { MnOutcomeVerifierService } from '../../plugins/manut/manut-outcome-verifier.service';

// ---------------------------------------------------------------------------
// Fake DB
// ---------------------------------------------------------------------------

interface FakeTask {
  id: string;
  definitionOfDone: unknown;
}

interface FakeWorkspaceDoc {
  workspaceId: string;
  docId: string;
  title: string | null;
}

interface FakeWorkProduct {
  id: string;
  taskId: string;
  kind: string;
}

interface FakeDbOptions {
  /** Pretend the deployment hasn't shipped M10 yet. */
  withoutMnWorkProduct?: boolean;
}

function createFakeDb(
  initialTasks: FakeTask[] = [],
  initialDocs: FakeWorkspaceDoc[] = [],
  initialWorkProducts: FakeWorkProduct[] = [],
  options: FakeDbOptions = {}
) {
  const tasks = new Map(initialTasks.map(t => [t.id, { ...t }]));
  const docs = [...initialDocs];
  const workProducts = [...initialWorkProducts];

  const db: Record<string, unknown> = {
    mnTask: {
      findUnique: async ({
        where,
        select: _select,
      }: {
        where: { id: string };
        select?: Record<string, boolean>;
      }) => {
        const t = tasks.get(where.id);
        if (!t) return null;
        return { id: t.id, definitionOfDone: t.definitionOfDone };
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { definitionOfDone?: unknown };
      }) => {
        const t = tasks.get(where.id);
        if (!t) throw new Error(`task ${where.id} not found in fake db`);
        // Map `Prisma.JsonNull` (the sentinel that means "write SQL
        // NULL into the JSONB column") back to JS `null` so the
        // round-trip from setDefinitionOfDone(taskId, null) ends with
        // a stored null. This mirrors how Postgres + Prisma actually
        // round-trip the column.
        let next: unknown;
        if (data.definitionOfDone === undefined) {
          next = t.definitionOfDone;
        } else if (data.definitionOfDone === Prisma.JsonNull) {
          next = null;
        } else {
          next = data.definitionOfDone;
        }
        const updated: FakeTask = { ...t, definitionOfDone: next };
        tasks.set(where.id, updated);
        return updated;
      },
    },
    workspaceDoc: {
      findFirst: async ({
        where,
      }: {
        where: { docId: string };
        select?: Record<string, boolean>;
      }) => {
        const hit = docs.find(d => d.docId === where.docId);
        return hit ?? null;
      },
    },
  };

  if (!options.withoutMnWorkProduct) {
    db.mnWorkProduct = {
      findFirst: async ({
        where,
      }: {
        where: { taskId: string; kind?: string };
      }) => {
        const hit = workProducts.find(
          wp =>
            wp.taskId === where.taskId &&
            (where.kind === undefined || wp.kind === where.kind)
        );
        return hit ?? null;
      },
    };
  }

  return {
    db,
    setDefinitionOfDone: (id: string, dod: unknown) => {
      const t = tasks.get(id);
      if (t) tasks.set(id, { ...t, definitionOfDone: dod });
    },
    getTaskDoD: (id: string) => tasks.get(id)?.definitionOfDone,
  };
}

function makeTask(id: string, dod: unknown = null): FakeTask {
  return { id, definitionOfDone: dod };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('verifyTaskDone: task with no DoD → hasDefinition=false, satisfied=true', async t => {
  const { db } = createFakeDb([makeTask('t1', null)]);
  const svc = new MnOutcomeVerifierService(db as never);

  const outcome = await svc.verifyTaskDone('t1');

  t.false(outcome.hasDefinition);
  t.true(outcome.satisfied);
  t.deepEqual(outcome.results, []);
});

test('verifyTaskDone: missing task throws NotFoundException', async t => {
  const { db } = createFakeDb([]);
  const svc = new MnOutcomeVerifierService(db as never);

  await t.throwsAsync(svc.verifyTaskDone('missing'), {
    instanceOf: NotFoundException,
  });
});

test('verifyTaskDone: empty taskId throws BadRequestException', async t => {
  const { db } = createFakeDb([]);
  const svc = new MnOutcomeVerifierService(db as never);

  await t.throwsAsync(svc.verifyTaskDone(''), {
    instanceOf: BadRequestException,
  });
});

test('DOC_EXISTS happy path: existing doc is satisfied with evidence', async t => {
  const { db } = createFakeDb(
    [makeTask('t1', [{ kind: MnDoDPredicateKind.DOC_EXISTS, docId: 'doc-A' }])],
    [{ workspaceId: 'w1', docId: 'doc-A', title: 'Spec' }]
  );
  const svc = new MnOutcomeVerifierService(db as never);

  const outcome = await svc.verifyTaskDone('t1');

  t.true(outcome.satisfied);
  t.true(outcome.hasDefinition);
  t.is(outcome.results.length, 1);
  t.true(outcome.results[0].satisfied);
  t.is(outcome.results[0].evidence?.docId, 'doc-A');
  t.is(outcome.results[0].evidence?.title, 'Spec');
});

test('DOC_EXISTS sad path: missing doc reports reason', async t => {
  const { db } = createFakeDb([
    makeTask('t1', [
      { kind: MnDoDPredicateKind.DOC_EXISTS, docId: 'doc-missing' },
    ]),
  ]);
  const svc = new MnOutcomeVerifierService(db as never);

  const outcome = await svc.verifyTaskDone('t1');

  t.false(outcome.satisfied);
  t.is(outcome.results.length, 1);
  t.false(outcome.results[0].satisfied);
  t.regex(outcome.results[0].reason!, /No WorkspaceDoc with id=doc-missing/);
});

test('URL_REACHABLE happy path: mocked 200 fetch is satisfied', async t => {
  const { db } = createFakeDb([
    makeTask('t1', [
      { kind: MnDoDPredicateKind.URL_REACHABLE, url: 'https://example.test/x' },
    ]),
  ]);
  const svc = new MnOutcomeVerifierService(db as never);

  const fakeFetch: FetchLike = async (input, _init) => {
    t.is(input, 'https://example.test/x');
    return new Response(null, { status: 200 });
  };
  svc.setFetcherForTesting(fakeFetch);

  const outcome = await svc.verifyTaskDone('t1');

  t.true(outcome.satisfied);
  t.is(outcome.results[0].evidence?.status, 200);
});

test('URL_REACHABLE sad path: 500 fetch fails verification', async t => {
  const { db } = createFakeDb([
    makeTask('t1', [
      { kind: MnDoDPredicateKind.URL_REACHABLE, url: 'https://broken.test/' },
    ]),
  ]);
  const svc = new MnOutcomeVerifierService(db as never);
  svc.setFetcherForTesting(async () => new Response(null, { status: 500 }));

  const outcome = await svc.verifyTaskDone('t1');

  t.false(outcome.satisfied);
  t.regex(outcome.results[0].reason!, /Expected 2xx, got 500/);
});

test('URL_REACHABLE: expectedStatus override is honored', async t => {
  const { db } = createFakeDb([
    makeTask('t1', [
      {
        kind: MnDoDPredicateKind.URL_REACHABLE,
        url: 'https://redirect.test/',
        expectedStatus: 301,
      },
    ]),
  ]);
  const svc = new MnOutcomeVerifierService(db as never);
  svc.setFetcherForTesting(async () => new Response(null, { status: 301 }));

  const outcome = await svc.verifyTaskDone('t1');
  t.true(outcome.satisfied);
});

test('WORK_PRODUCT_EXISTS happy path: matching product is satisfied', async t => {
  const { db } = createFakeDb(
    [
      makeTask('t1', [
        { kind: MnDoDPredicateKind.WORK_PRODUCT_EXISTS, taskId: 't1' },
      ]),
    ],
    [],
    [{ id: 'wp1', taskId: 't1', kind: 'doc' }]
  );
  const svc = new MnOutcomeVerifierService(db as never);

  const outcome = await svc.verifyTaskDone('t1');

  t.true(outcome.satisfied);
  t.is(outcome.results[0].evidence?.id, 'wp1');
});

test('WORK_PRODUCT_EXISTS sad path: no row → unsatisfied', async t => {
  const { db } = createFakeDb([
    makeTask('t1', [
      { kind: MnDoDPredicateKind.WORK_PRODUCT_EXISTS, taskId: 't1' },
    ]),
  ]);
  const svc = new MnOutcomeVerifierService(db as never);

  const outcome = await svc.verifyTaskDone('t1');

  t.false(outcome.satisfied);
  t.regex(outcome.results[0].reason!, /No MnWorkProduct for taskId=t1/);
});

test('WORK_PRODUCT_EXISTS: M10 not deployed → graceful unsatisfied (defensive)', async t => {
  // Verifier MUST NOT crash when prisma.mnWorkProduct is undefined.
  // It should report the predicate as unsatisfied with a clear reason
  // so operators can't accidentally bypass the gate (CLAUDE.md
  // §2.5 R0 — untested critical path).
  const { db } = createFakeDb(
    [
      makeTask('t1', [
        {
          kind: MnDoDPredicateKind.WORK_PRODUCT_EXISTS,
          taskId: 't1',
          productKind: 'doc',
        },
      ]),
    ],
    [],
    [],
    { withoutMnWorkProduct: true }
  );
  const svc = new MnOutcomeVerifierService(db as never);

  const outcome = await svc.verifyTaskDone('t1');

  t.false(outcome.satisfied);
  t.regex(outcome.results[0].reason!, /M10.*not yet deployed/);
});

test('EMBEDDING_SIMILARITY v1 stub: auto-satisfied with warning reason', async t => {
  const { db } = createFakeDb([
    makeTask('t1', [
      {
        kind: MnDoDPredicateKind.EMBEDDING_SIMILARITY,
        sourceText: 'hello',
        threshold: 0.8,
      },
    ]),
  ]);
  const svc = new MnOutcomeVerifierService(db as never);

  const outcome = await svc.verifyTaskDone('t1');

  t.true(outcome.satisfied);
  t.regex(outcome.results[0].reason!, /not yet implemented/);
});

test('CUSTOM: always unsatisfied, awaits manual review', async t => {
  const { db } = createFakeDb([
    makeTask('t1', [
      {
        kind: MnDoDPredicateKind.CUSTOM,
        description: 'Marketing sign-off',
      },
    ]),
  ]);
  const svc = new MnOutcomeVerifierService(db as never);

  const outcome = await svc.verifyTaskDone('t1');

  t.false(outcome.satisfied);
  t.regex(outcome.results[0].reason!, /Marketing sign-off/);
});

test('mixed predicates: aggregate is AND of per-predicate', async t => {
  const { db } = createFakeDb(
    [
      makeTask('t1', [
        { kind: MnDoDPredicateKind.DOC_EXISTS, docId: 'doc-A' },
        { kind: MnDoDPredicateKind.CUSTOM, description: 'review' },
      ]),
    ],
    [{ workspaceId: 'w1', docId: 'doc-A', title: 'Spec' }]
  );
  const svc = new MnOutcomeVerifierService(db as never);

  const outcome = await svc.verifyTaskDone('t1');
  t.false(outcome.satisfied);
  t.is(outcome.results.length, 2);
  t.true(outcome.results[0].satisfied);
  t.false(outcome.results[1].satisfied);
});

test('corrupt DoD JSON: degrades to hasDefinition=false (no crash)', async t => {
  // Stored value doesn't match the predicate schema — the parser must
  // log + drop rather than crash so the verifier stays resilient.
  const { db } = createFakeDb([
    makeTask('t1', [{ kind: 'NOT_A_KIND', whatever: true } as never]),
  ]);
  const svc = new MnOutcomeVerifierService(db as never);

  const outcome = await svc.verifyTaskDone('t1');

  t.false(outcome.hasDefinition);
  t.true(outcome.satisfied);
});

// ---------------------------------------------------------------------------
// Status-transition gate
// ---------------------------------------------------------------------------

test('assertCanTransitionToDone: passes when no DoD', async t => {
  const { db } = createFakeDb([makeTask('t1', null)]);
  const svc = new MnOutcomeVerifierService(db as never);

  await t.notThrowsAsync(svc.assertCanTransitionToDone('t1'));
});

test('assertCanTransitionToDone: blocks when predicates unsatisfied', async t => {
  const { db } = createFakeDb([
    makeTask('t1', [
      { kind: MnDoDPredicateKind.CUSTOM, description: 'PR review' },
    ]),
  ]);
  const svc = new MnOutcomeVerifierService(db as never);

  const err = await t.throwsAsync(svc.assertCanTransitionToDone('t1'), {
    instanceOf: BadRequestException,
  });
  t.regex(err!.message, /cannot transition to DONE/);
  t.regex(err!.message, /CUSTOM/);
});

test('assertCanTransitionToDone: passes when all predicates satisfied', async t => {
  const { db } = createFakeDb(
    [makeTask('t1', [{ kind: MnDoDPredicateKind.DOC_EXISTS, docId: 'doc-A' }])],
    [{ workspaceId: 'w1', docId: 'doc-A', title: 'Spec' }]
  );
  const svc = new MnOutcomeVerifierService(db as never);

  await t.notThrowsAsync(svc.assertCanTransitionToDone('t1'));
});

// ---------------------------------------------------------------------------
// setDefinitionOfDone — validation
// ---------------------------------------------------------------------------

test('setDefinitionOfDone: persists valid list and survives roundtrip', async t => {
  const { db, getTaskDoD } = createFakeDb([makeTask('t1', null)]);
  const svc = new MnOutcomeVerifierService(db as never);

  const written = await svc.setDefinitionOfDone('t1', [
    { kind: MnDoDPredicateKind.DOC_EXISTS, docId: 'doc-A' },
  ]);
  t.is(written.length, 1);
  t.is(written[0].kind, MnDoDPredicateKind.DOC_EXISTS);

  t.deepEqual(getTaskDoD('t1'), [{ kind: 'DOC_EXISTS', docId: 'doc-A' }]);
});

test('setDefinitionOfDone: null clears the DoD (column ← null)', async t => {
  const { db, getTaskDoD } = createFakeDb([
    makeTask('t1', [{ kind: 'DOC_EXISTS', docId: 'doc-A' }]),
  ]);
  const svc = new MnOutcomeVerifierService(db as never);

  await svc.setDefinitionOfDone('t1', null);
  t.is(getTaskDoD('t1'), null);
});

test('setDefinitionOfDone: invalid predicate (missing field) → BadRequestException', async t => {
  const { db } = createFakeDb([makeTask('t1', null)]);
  const svc = new MnOutcomeVerifierService(db as never);

  // Cast via `as never` because the TypeScript type would refuse a
  // DOC_EXISTS without `docId`. The verifier's Zod layer is the
  // runtime guard we're testing — pretend the input bypassed TS.
  await t.throwsAsync(
    svc.setDefinitionOfDone('t1', [
      { kind: MnDoDPredicateKind.DOC_EXISTS } as never,
    ]),
    { instanceOf: BadRequestException }
  );
});

test('setDefinitionOfDone: invalid kind → BadRequestException', async t => {
  const { db } = createFakeDb([makeTask('t1', null)]);
  const svc = new MnOutcomeVerifierService(db as never);

  await t.throwsAsync(
    svc.setDefinitionOfDone('t1', [
      // @ts-expect-error — intentional invalid kind for the test
      { kind: 'NOPE', docId: 'doc-A' },
    ]),
    { instanceOf: BadRequestException }
  );
});

test('setDefinitionOfDone: missing task → NotFoundException', async t => {
  const { db } = createFakeDb([]);
  const svc = new MnOutcomeVerifierService(db as never);

  await t.throwsAsync(svc.setDefinitionOfDone('missing', []), {
    instanceOf: NotFoundException,
  });
});

test('setDefinitionOfDone: URL_REACHABLE rejects non-http url at validation', async t => {
  const { db } = createFakeDb([makeTask('t1', null)]);
  const svc = new MnOutcomeVerifierService(db as never);

  await t.throwsAsync(
    svc.setDefinitionOfDone('t1', [
      { kind: MnDoDPredicateKind.URL_REACHABLE, url: 'javascript:alert(1)' },
    ]),
    {
      instanceOf: BadRequestException,
      message: /url must be a valid http\(s\) URL/,
    }
  );
});
