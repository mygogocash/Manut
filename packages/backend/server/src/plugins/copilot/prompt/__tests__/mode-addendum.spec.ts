import test from 'ava';

import {
  appendPermissionModeAddendum,
  getPermissionModeAddendum,
} from '../mode-addendum.js';

test('getPermissionModeAddendum__given_no_write_flags__then_returns_read_mode_guidance', t => {
  const addendum = getPermissionModeAddendum({
    editingDocs: false,
    composingDocs: false,
    editingDataViews: false,
  });

  t.regex(addendum, /Read mode/);
  t.regex(addendum, /Do not call write tools/);
  t.regex(addendum, /cite/i);
});

test('getPermissionModeAddendum__given_edit_doc_flags__then_returns_current_doc_guidance', t => {
  const addendum = getPermissionModeAddendum({
    editingDocs: true,
    composingDocs: false,
    editingDataViews: false,
  });

  t.regex(addendum, /Edit current doc mode/);
  t.regex(addendum, /current document/);
  t.notRegex(addendum, /Full Agent mode/);
});

test('getPermissionModeAddendum__given_full_agent_flags__then_returns_agent_guidance', t => {
  const addendum = getPermissionModeAddendum({
    editingDocs: true,
    composingDocs: true,
    editingDataViews: true,
  });

  t.regex(addendum, /Full Agent mode/);
  t.regex(addendum, /tool results/);
  t.regex(addendum, /source-grounded/);
  t.regex(addendum, /short executable plan/);
  t.regex(addendum, /Read evidence before writes/);
  t.regex(addendum, /produced work/);
});

test('appendPermissionModeAddendum__given_system_message__then_appends_mode_guidelines_without_mutating_original', t => {
  const messages = [
    {
      role: 'system' as const,
      content: 'Base system prompt.',
    },
    {
      role: 'user' as const,
      content: 'hello',
    },
  ];

  const next = appendPermissionModeAddendum(messages, {
    editingDocs: false,
    composingDocs: false,
    editingDataViews: false,
  });

  t.not(next, messages);
  t.is(messages[0].content, 'Base system prompt.');
  t.regex(next[0].content, /Base system prompt/);
  t.regex(next[0].content, /<mode_guidelines>/);
  t.regex(next[0].content, /Read mode/);
  t.is(next[1], messages[1]);
});

test('appendPermissionModeAddendum__given_no_system_message__then_inserts_system_guidelines', t => {
  const messages = [
    {
      role: 'user' as const,
      content: 'hello',
    },
  ];

  const next = appendPermissionModeAddendum(messages, {
    editingDocs: true,
    composingDocs: true,
    editingDataViews: true,
  });

  t.is(next[0].role, 'system');
  t.regex(next[0].content, /Full Agent mode/);
  t.is(next[1], messages[0]);
});
