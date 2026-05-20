import { Logger } from '@nestjs/common';
import test from 'ava';

import { ActionForbidden, type Config, UserFriendlyError } from '../../../base';
import type { CurrentUser } from '../../../core/auth';
import type { UserType } from '../../../core/user';
import { CalendarProviderFactory } from '../providers';
import {
  CalendarAccountResolver,
  CalendarServerConfigResolver,
  UserCalendarResolver,
} from '../resolver';
import type { CalendarService } from '../service';

function makeUser(id = 'user-1'): CurrentUser {
  return {
    id,
    email: 'user@example.com',
    avatarUrl: null,
    name: 'Test User',
    disabled: false,
    hasPassword: true,
    emailVerified: true,
    completedOnboarding: true,
  };
}

function makeService(
  overrides: Partial<CalendarService> = {}
): CalendarService {
  return overrides as unknown as CalendarService;
}

test.beforeEach(() => {
  // silence expected error logs from defensive catches
  Logger.overrideLogger(false);
});

test.afterEach(() => {
  Logger.overrideLogger(['log', 'warn', 'error']);
});

test('UserCalendarResolver.calendarAccounts returns [] when listAccounts throws unknown error', async t => {
  const user = makeUser();
  const service = makeService({
    listAccounts: async () => {
      throw new Error('PrismaClientKnownRequestError: relation does not exist');
    },
  });
  const resolver = new UserCalendarResolver(service);

  const result = await resolver.calendarAccounts(user, user as UserType);
  t.deepEqual(result, []);
});

test('UserCalendarResolver.calendarAccounts re-throws UserFriendlyError subclasses', async t => {
  const user = makeUser();
  const service = makeService({
    listAccounts: async () => {
      throw new ActionForbidden();
    },
  });
  const resolver = new UserCalendarResolver(service);

  await t.throwsAsync(() => resolver.calendarAccounts(user, user as UserType), {
    instanceOf: UserFriendlyError,
  });
});

test('UserCalendarResolver.calendarAccounts forbids cross-user access before service call', async t => {
  const user = makeUser('user-1');
  const otherUser = makeUser('user-2');
  let called = false;
  const service = makeService({
    listAccounts: async () => {
      called = true;
      return [];
    },
  });
  const resolver = new UserCalendarResolver(service);

  await t.throwsAsync(
    () => resolver.calendarAccounts(user, otherUser as UserType),
    { instanceOf: ActionForbidden }
  );
  t.false(called);
});

test('CalendarAccountResolver.calendars returns [] when listAccountCalendars throws', async t => {
  const user = makeUser();
  const service = makeService({
    listAccountCalendars: async () => {
      throw new Error('boom');
    },
  });
  const resolver = new CalendarAccountResolver(service);

  const result = await resolver.calendars(user, {
    id: 'account-1',
  } as never);
  t.deepEqual(result, []);
});

test('CalendarAccountResolver.calendarsCount returns 0 when listAccountCalendars throws', async t => {
  const user = makeUser();
  const service = makeService({
    listAccountCalendars: async () => {
      throw new Error('boom');
    },
  });
  const resolver = new CalendarAccountResolver(service);

  const result = await resolver.calendarsCount(user, {
    id: 'account-1',
  } as never);
  t.is(result, 0);
});

test('CalendarAccountResolver.calendarsCount uses precomputed count when available', async t => {
  const user = makeUser();
  let called = false;
  const service = makeService({
    listAccountCalendars: async () => {
      called = true;
      return [];
    },
  });
  const resolver = new CalendarAccountResolver(service);

  const result = await resolver.calendarsCount(user, {
    id: 'account-1',
    calendarsCount: 7,
  } as never);
  t.is(result, 7);
  t.false(called);
});

test('CalendarServerConfigResolver.calendarCalDAVProviders returns [] when calendar config is missing', t => {
  const resolver = new CalendarServerConfigResolver(
    new CalendarProviderFactory(),
    {} as Config
  );

  t.deepEqual(resolver.calendarCalDAVProviders(), []);
});

test('CalendarServerConfigResolver.calendarCalDAVProviders maps enabled presets', t => {
  const resolver = new CalendarServerConfigResolver(
    new CalendarProviderFactory(),
    {
      calendar: {
        caldav: {
          enabled: true,
          providers: [
            {
              id: 'icloud',
              label: 'iCloud',
              serverUrl: 'https://caldav.icloud.com',
            },
          ],
        },
      },
    } as Config
  );

  t.deepEqual(resolver.calendarCalDAVProviders(), [
    {
      id: 'icloud',
      label: 'iCloud',
      requiresAppPassword: null,
      docsUrl: null,
    },
  ]);
});
