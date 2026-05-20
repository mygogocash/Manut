/**
 * `calendar_search` — AI tool wrapping the existing
 * `CalendarService.listWorkspaceEvents` query path.
 *
 * Events come from the Postgres-cached `calendarEvent` table — the
 * CalendarService maintains the cache via its sync workers, so this
 * tool returns whatever is currently synced (no live Google Calendar
 * round-trip per AI invocation). On-demand resync of stale
 * subscriptions is kicked off in the background by
 * `listWorkspaceEvents` itself; we do not block on it.
 *
 * Time window:
 *  - `timeMin` / `timeMax` ISO strings parsed via `Date`. Default
 *    window is `now - 1 day` → `now + 30 days` to cover "what's on
 *    my calendar today / this month" prompts cheaply.
 *
 * Graceful degradation contract:
 *  - No workspace calendar configured  → "Calendar not connected …"
 *  - Calendar accounts disconnected     → empty `events: []`
 *  - Date parsing failure               → toolError with format hint
 *  - Any internal exception             → toolError, never throws
 */

import { Logger } from '@nestjs/common';
import { z } from 'zod';

import type { CalendarService } from '../../calendar/service';
import { toolError } from './error';
import { defineTool } from './tool';
import type { CopilotChatOptions } from './types';

const logger = new Logger('CalendarSearchTool');

const DEFAULT_PAST_DAYS = 1;
const DEFAULT_FUTURE_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const CalendarSearchInputSchema = z.object({
  query: z
    .string()
    .optional()
    .describe(
      'Optional case-insensitive substring filter applied to event title, ' +
        'location, and attendee list.'
    ),
  timeMin: z
    .string()
    .optional()
    .describe(
      'ISO-8601 lower bound (e.g. `2026-05-20T00:00:00Z`). ' +
        'Defaults to 1 day ago.'
    ),
  timeMax: z
    .string()
    .optional()
    .describe('ISO-8601 upper bound. Defaults to 30 days from now.'),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe('How many events to return (max 50). Defaults to 10.'),
});

type CalendarSearchInput = z.infer<typeof CalendarSearchInputSchema>;

export interface CalendarSearchHit {
  id: string;
  summary: string;
  start: string;
  end: string;
  location: string | null;
  attendees: string[];
  htmlLink: string | null;
  allDay: boolean;
}

// Structural shape of `calendarEvent` rows returned from
// `CalendarService.listWorkspaceEvents`. Pulled inline so the tool
// doesn't depend on the Prisma type re-export surface.
interface CalendarEventRow {
  id: string;
  title: string | null;
  location: string | null;
  startAtUtc: Date;
  endAtUtc: Date;
  allDay: boolean;
  raw: unknown;
}

/**
 * Bind the tool handler with its CalendarService dependency at
 * registration time. Mirrors `buildImageGenHandler` / `buildGmailSearchHandler`.
 */
export const buildCalendarSearchHandler = (calendar: CalendarService) => {
  return async (
    options: CopilotChatOptions,
    input: CalendarSearchInput
  ): Promise<
    { events: CalendarSearchHit[] } | ReturnType<typeof toolError>
  > => {
    const userId = options?.user;
    const workspaceId = options?.workspace;

    if (!userId || !workspaceId) {
      return toolError(
        'Calendar Search Failed',
        'Calendar search requires a user + workspace context.'
      );
    }

    // Resolve the workspace's calendar surface. `getWorkspaceCalendars`
    // returns an empty array when nothing is linked — that's our
    // "not connected" signal.
    let workspaceCalendars: Array<{ id: string }>;
    try {
      workspaceCalendars = await calendar.getWorkspaceCalendars(workspaceId);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unexpected error';
      logger.warn(
        `calendar_search lookup failed workspace=${workspaceId}: ${message}`
      );
      return toolError('Calendar Search Failed', message);
    }

    if (workspaceCalendars.length === 0) {
      return toolError(
        'Calendar Search Failed',
        'Calendar not connected. Link a calendar from Settings > Integrations.'
      );
    }

    const now = Date.now();
    const from = parseDateOrDefault(
      input.timeMin,
      new Date(now - DEFAULT_PAST_DAYS * MS_PER_DAY)
    );
    if (!from.ok) {
      return toolError(
        'Calendar Search Failed',
        `Invalid timeMin: ${from.message}`
      );
    }
    const to = parseDateOrDefault(
      input.timeMax,
      new Date(now + DEFAULT_FUTURE_DAYS * MS_PER_DAY)
    );
    if (!to.ok) {
      return toolError(
        'Calendar Search Failed',
        `Invalid timeMax: ${to.message}`
      );
    }
    if (from.date.getTime() >= to.date.getTime()) {
      return toolError(
        'Calendar Search Failed',
        'timeMin must be earlier than timeMax.'
      );
    }

    const maxResults = Math.min(Math.max(input.maxResults ?? 10, 1), 50);
    const queryLower = input.query?.trim().toLowerCase();

    try {
      // Fan out across every workspace calendar surface. Each query is
      // already capped by from/to so the total event count stays small.
      const eventBatches = await Promise.all(
        workspaceCalendars.map(wc =>
          calendar.listWorkspaceEvents({
            workspaceCalendarId: wc.id,
            from: from.date,
            to: to.date,
          })
        )
      );

      const flattened: CalendarEventRow[] = [];
      for (const batch of eventBatches) {
        for (const event of batch) {
          flattened.push(event as CalendarEventRow);
        }
      }

      // Sort by start ascending so "what's next?" queries return the
      // soonest event first.
      flattened.sort((a, b) => a.startAtUtc.getTime() - b.startAtUtc.getTime());

      const hits: CalendarSearchHit[] = [];
      for (const event of flattened) {
        const hit = toHit(event);
        if (queryLower && !matchesQuery(hit, queryLower)) {
          continue;
        }
        hits.push(hit);
        if (hits.length >= maxResults) break;
      }

      logger.log(
        `calendar_search ok workspace=${workspaceId} user=${userId} ` +
          `hits=${hits.length} window=[${from.date.toISOString()}..${to.date.toISOString()}]`
      );

      return { events: hits };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unexpected error';
      logger.warn(
        `calendar_search query failed workspace=${workspaceId}: ${message}`
      );
      return toolError('Calendar Search Failed', message);
    }
  };
};

function toHit(event: CalendarEventRow): CalendarSearchHit {
  const raw = (event.raw ?? {}) as {
    attendees?: { email?: string; displayName?: string }[];
    htmlLink?: string;
  };
  const attendees: string[] = [];
  if (Array.isArray(raw.attendees)) {
    for (const a of raw.attendees) {
      const label = a.email ?? a.displayName;
      if (label) attendees.push(label);
    }
  }
  return {
    id: event.id,
    summary: event.title ?? '',
    start: event.startAtUtc.toISOString(),
    end: event.endAtUtc.toISOString(),
    location: event.location ?? null,
    attendees,
    htmlLink: raw.htmlLink ?? null,
    allDay: event.allDay,
  };
}

function matchesQuery(hit: CalendarSearchHit, q: string): boolean {
  if (hit.summary.toLowerCase().includes(q)) return true;
  if (hit.location && hit.location.toLowerCase().includes(q)) return true;
  for (const a of hit.attendees) {
    if (a.toLowerCase().includes(q)) return true;
  }
  return false;
}

function parseDateOrDefault(
  input: string | undefined,
  fallback: Date
): { ok: true; date: Date } | { ok: false; message: string } {
  if (!input) return { ok: true, date: fallback };
  const parsed = new Date(input);
  if (isNaN(parsed.getTime())) {
    return {
      ok: false,
      message: `expected ISO-8601 date, got "${input.slice(0, 40)}"`,
    };
  }
  return { ok: true, date: parsed };
}

/**
 * Tool factory.
 */
export const createCalendarSearchTool = (
  handler: (input: CalendarSearchInput) => Promise<unknown>
) => {
  return defineTool({
    description:
      "Search the user's linked Google Calendar / CalDAV calendars for events in a given time " +
      'window. Supports an optional case-insensitive query filter (matches title, location, ' +
      'attendees). Defaults to 1 day before now → 30 days after now. Returns up to 50 events.',
    inputSchema: CalendarSearchInputSchema,
    execute: async input => {
      try {
        return await handler(input);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unexpected error';
        logger.error(`calendar_search tool execute failed: ${message}`);
        return toolError('Calendar Search Failed', message);
      }
    },
  });
};
