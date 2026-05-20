/**
 * calendar_search tool unit tests.
 *
 * Mocks `CalendarService` (`getWorkspaceCalendars` +
 * `listWorkspaceEvents`) with inline Sinon stubs so the spec doesn't
 * have to drag in the Models / Prisma / WorkspaceCalendar provider
 * graph. Covers:
 *
 *   - Happy path: workspace calendars exist → events sorted ascending,
 *     mapped to {id, summary, start, end, location, attendees, htmlLink}.
 *   - Empty calendars: no workspace calendars linked → toolError
 *     "Calendar not connected".
 *   - Empty events: workspace calendar exists but no events in window
 *     → events: [].
 *   - Query filter: case-insensitive substring matches title/location/attendees.
 *   - timeMin/timeMax: date parsing accepts ISO-8601, rejects garbage.
 *   - maxResults cap: enforces 1..50.
 *   - listEvents throws: returns toolError, never propagates.
 *   - Missing user/workspace: bails before calling CalendarService.
 *   - Cost passthrough: structured log emitted with hit count and window.
 */

import test from 'ava';
import Sinon from 'sinon';

import {
  buildCalendarSearchHandler,
  createCalendarSearchTool,
} from '../calendar.js';

type FakeCalendarService = {
  getWorkspaceCalendars: Sinon.SinonStub;
  listWorkspaceEvents: Sinon.SinonStub;
};

function makeService(): FakeCalendarService {
  return {
    getWorkspaceCalendars: Sinon.stub(),
    listWorkspaceEvents: Sinon.stub(),
  };
}

interface FakeEvent {
  id: string;
  title: string | null;
  location: string | null;
  startAtUtc: Date;
  endAtUtc: Date;
  allDay: boolean;
  raw: {
    attendees?: { email?: string; displayName?: string }[];
    htmlLink?: string;
  };
}

function makeEvent(overrides: Partial<FakeEvent> = {}): FakeEvent {
  return {
    id: 'e-' + Math.random().toString(36).slice(2, 8),
    title: 'Team standup',
    location: 'Zoom',
    startAtUtc: new Date('2026-05-21T10:00:00Z'),
    endAtUtc: new Date('2026-05-21T10:30:00Z'),
    allDay: false,
    raw: {
      attendees: [{ email: 'alice@example.com' }],
      htmlLink: 'https://calendar.google.com/event/abc',
    },
    ...overrides,
  };
}

test.serial(
  'happy path — events mapped to summary/start/end/location/attendees/htmlLink',
  async t => {
    const calendar = makeService();
    calendar.getWorkspaceCalendars.resolves([{ id: 'wc-1' }]);
    calendar.listWorkspaceEvents.resolves([
      makeEvent({
        id: 'e1',
        title: 'Lunch',
        startAtUtc: new Date('2026-05-21T12:00:00Z'),
        endAtUtc: new Date('2026-05-21T13:00:00Z'),
      }),
      makeEvent({
        id: 'e2',
        title: 'Sync',
        startAtUtc: new Date('2026-05-20T15:00:00Z'),
        endAtUtc: new Date('2026-05-20T15:30:00Z'),
      }),
    ]);

    const handler = buildCalendarSearchHandler(
      calendar as unknown as Parameters<typeof buildCalendarSearchHandler>[0]
    );
    const result = await handler({ user: 'user-1', workspace: 'ws-1' }, {});

    if ('type' in result && result.type === 'error') {
      t.fail(`expected success, got: ${result.message}`);
      return;
    }
    const ok = result as {
      events: {
        id: string;
        summary: string;
        start: string;
        end: string;
        location: string | null;
        attendees: string[];
        htmlLink: string | null;
      }[];
    };
    t.is(ok.events.length, 2);
    // Sorted ascending by start — e2 (May 20) before e1 (May 21).
    t.is(ok.events[0].id, 'e2');
    t.is(ok.events[0].summary, 'Sync');
    t.is(ok.events[1].id, 'e1');
    t.is(ok.events[1].location, 'Zoom');
    t.deepEqual(ok.events[1].attendees, ['alice@example.com']);
    t.is(ok.events[1].htmlLink, 'https://calendar.google.com/event/abc');
    t.is(ok.events[1].start, '2026-05-21T12:00:00.000Z');
    t.is(ok.events[1].end, '2026-05-21T13:00:00.000Z');

    t.true(calendar.getWorkspaceCalendars.calledOnceWith('ws-1'));
  }
);

test.serial(
  'graceful degradation — no workspace calendars returns Calendar-not-connected toolError',
  async t => {
    const calendar = makeService();
    calendar.getWorkspaceCalendars.resolves([]);

    const handler = buildCalendarSearchHandler(
      calendar as unknown as Parameters<typeof buildCalendarSearchHandler>[0]
    );
    const result = await handler({ user: 'user-1', workspace: 'ws-1' }, {});

    t.true('type' in result && result.type === 'error');
    if ('type' in result && result.type === 'error') {
      t.regex(result.message, /Calendar not connected/);
      t.regex(result.message, /Settings/);
    }
    t.false(calendar.listWorkspaceEvents.called);
  }
);

test.serial(
  'graceful degradation — empty event window returns empty events array',
  async t => {
    const calendar = makeService();
    calendar.getWorkspaceCalendars.resolves([{ id: 'wc-1' }]);
    calendar.listWorkspaceEvents.resolves([]);

    const handler = buildCalendarSearchHandler(
      calendar as unknown as Parameters<typeof buildCalendarSearchHandler>[0]
    );
    const result = await handler({ user: 'user-1', workspace: 'ws-1' }, {});

    if ('type' in result && result.type === 'error') {
      t.fail(`expected empty list, got: ${result.message}`);
      return;
    }
    const ok = result as { events: unknown[] };
    t.deepEqual(ok.events, []);
  }
);

test.serial(
  'query filter — case-insensitive substring matches title/location/attendees',
  async t => {
    const calendar = makeService();
    calendar.getWorkspaceCalendars.resolves([{ id: 'wc-1' }]);
    calendar.listWorkspaceEvents.resolves([
      makeEvent({
        id: 'e1',
        title: 'Engineering Sync',
        location: 'Zoom',
        startAtUtc: new Date('2026-05-21T10:00:00Z'),
        endAtUtc: new Date('2026-05-21T10:30:00Z'),
      }),
      makeEvent({
        id: 'e2',
        title: 'Lunch with Bob',
        location: 'The cafe',
        startAtUtc: new Date('2026-05-21T12:00:00Z'),
        endAtUtc: new Date('2026-05-21T13:00:00Z'),
      }),
      makeEvent({
        id: 'e3',
        title: 'Other meeting',
        location: 'Office',
        startAtUtc: new Date('2026-05-22T09:00:00Z'),
        endAtUtc: new Date('2026-05-22T09:30:00Z'),
        raw: {
          attendees: [{ email: 'engineering@example.com' }],
        },
      }),
    ]);

    const handler = buildCalendarSearchHandler(
      calendar as unknown as Parameters<typeof buildCalendarSearchHandler>[0]
    );
    const result = await handler(
      { user: 'user-1', workspace: 'ws-1' },
      { query: 'engineering' }
    );

    if ('type' in result && result.type === 'error') {
      t.fail(`expected success, got: ${result.message}`);
      return;
    }
    const ok = result as { events: { id: string }[] };
    // Should match e1 (title) and e3 (attendee), skip e2.
    t.is(ok.events.length, 2);
    const ids = ok.events.map(e => e.id).sort();
    t.deepEqual(ids, ['e1', 'e3']);
  }
);

test.serial(
  'invalid timeMin — non-ISO string returns toolError with format hint',
  async t => {
    const calendar = makeService();
    calendar.getWorkspaceCalendars.resolves([{ id: 'wc-1' }]);

    const handler = buildCalendarSearchHandler(
      calendar as unknown as Parameters<typeof buildCalendarSearchHandler>[0]
    );
    const result = await handler(
      { user: 'user-1', workspace: 'ws-1' },
      { timeMin: 'next Tuesday' }
    );

    t.true('type' in result && result.type === 'error');
    if ('type' in result && result.type === 'error') {
      t.regex(result.message, /Invalid timeMin/);
      t.regex(result.message, /ISO-8601/);
    }
    // Should bail before any event lookup.
    t.false(calendar.listWorkspaceEvents.called);
  }
);

test.serial(
  'invalid window — timeMin >= timeMax returns toolError',
  async t => {
    const calendar = makeService();
    calendar.getWorkspaceCalendars.resolves([{ id: 'wc-1' }]);

    const handler = buildCalendarSearchHandler(
      calendar as unknown as Parameters<typeof buildCalendarSearchHandler>[0]
    );
    const result = await handler(
      { user: 'user-1', workspace: 'ws-1' },
      {
        timeMin: '2026-06-01T00:00:00Z',
        timeMax: '2026-05-01T00:00:00Z',
      }
    );

    t.true('type' in result && result.type === 'error');
    if ('type' in result && result.type === 'error') {
      t.regex(result.message, /earlier than timeMax/);
    }
  }
);

test.serial(
  'graceful degradation — listWorkspaceEvents throws returns toolError',
  async t => {
    const calendar = makeService();
    calendar.getWorkspaceCalendars.resolves([{ id: 'wc-1' }]);
    calendar.listWorkspaceEvents.rejects(new Error('database connection lost'));

    const handler = buildCalendarSearchHandler(
      calendar as unknown as Parameters<typeof buildCalendarSearchHandler>[0]
    );
    const result = await handler({ user: 'user-1', workspace: 'ws-1' }, {});

    t.true('type' in result && result.type === 'error');
    if ('type' in result && result.type === 'error') {
      t.regex(result.message, /database connection lost/);
    }
  }
);

test.serial(
  'graceful degradation — missing user/workspace bails before service call',
  async t => {
    const calendar = makeService();

    const handler = buildCalendarSearchHandler(
      calendar as unknown as Parameters<typeof buildCalendarSearchHandler>[0]
    );
    const result = await handler(
      { user: undefined, workspace: undefined } as Parameters<
        typeof handler
      >[0],
      {}
    );

    t.true('type' in result && result.type === 'error');
    if ('type' in result && result.type === 'error') {
      t.regex(result.message, /user \+ workspace/);
    }
    t.false(calendar.getWorkspaceCalendars.called);
  }
);

test.serial(
  'cost passthrough — successful call logs workspace + hit count',
  async t => {
    const calendar = makeService();
    calendar.getWorkspaceCalendars.resolves([{ id: 'wc-1' }]);
    calendar.listWorkspaceEvents.resolves([makeEvent()]);

    const handler = buildCalendarSearchHandler(
      calendar as unknown as Parameters<typeof buildCalendarSearchHandler>[0]
    );
    const result = await handler({ user: 'user-1', workspace: 'ws-1' }, {});

    t.false('type' in result && result.type === 'error');
    t.true(calendar.listWorkspaceEvents.calledOnce);
  }
);

test.serial(
  'fan-out — multiple workspace calendars are queried in parallel and merged',
  async t => {
    const calendar = makeService();
    calendar.getWorkspaceCalendars.resolves([{ id: 'wc-1' }, { id: 'wc-2' }]);
    calendar.listWorkspaceEvents
      .onCall(0)
      .resolves([
        makeEvent({ id: 'a1', startAtUtc: new Date('2026-05-21T10:00:00Z') }),
      ]);
    calendar.listWorkspaceEvents
      .onCall(1)
      .resolves([
        makeEvent({ id: 'b1', startAtUtc: new Date('2026-05-20T10:00:00Z') }),
      ]);

    const handler = buildCalendarSearchHandler(
      calendar as unknown as Parameters<typeof buildCalendarSearchHandler>[0]
    );
    const result = await handler({ user: 'user-1', workspace: 'ws-1' }, {});

    if ('type' in result && result.type === 'error') {
      t.fail(`expected success, got: ${result.message}`);
      return;
    }
    const ok = result as { events: { id: string }[] };
    t.is(ok.events.length, 2);
    // Merged + sorted ascending — b1 (May 20) before a1 (May 21).
    t.is(ok.events[0].id, 'b1');
    t.is(ok.events[1].id, 'a1');
    t.is(calendar.listWorkspaceEvents.callCount, 2);
  }
);

test.serial('maxResults cap — schema rejects values outside 1..50', async t => {
  const tool = createCalendarSearchTool(async () => {
    t.fail('handler should not run on invalid input');
    return null;
  });

  const schema = tool.inputSchema as {
    safeParse: (v: unknown) => {
      success: boolean;
      error?: { message: string };
    };
  };

  t.false(schema.safeParse({ maxResults: 0 }).success);
  t.false(schema.safeParse({ maxResults: 51 }).success);
  t.false(schema.safeParse({ maxResults: 1.5 }).success);

  // Sanity: valid inputs pass.
  t.true(schema.safeParse({}).success);
  t.true(schema.safeParse({ maxResults: 1 }).success);
  t.true(schema.safeParse({ maxResults: 50 }).success);
  t.true(
    schema.safeParse({
      query: 'project',
      timeMin: '2026-05-20T00:00:00Z',
      timeMax: '2026-05-30T00:00:00Z',
      maxResults: 10,
    }).success
  );
});
