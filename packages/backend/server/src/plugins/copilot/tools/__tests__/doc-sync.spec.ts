import test from 'ava';

import {
  DOCUMENT_SYNC_PENDING_MESSAGE,
  LOCAL_WORKSPACE_SYNC_REQUIRED_MESSAGE,
} from '../doc-sync.js';

test('doc sync tool-facing messages use Manut Cloud branding', t => {
  const messages = [
    LOCAL_WORKSPACE_SYNC_REQUIRED_MESSAGE,
    DOCUMENT_SYNC_PENDING_MESSAGE('doc-1'),
  ];

  for (const message of messages) {
    t.true(message.includes('Manut Cloud'));
    t.false(message.includes('AFFiNE'));
    t.false(message.includes('Superflow'));
  }
});
