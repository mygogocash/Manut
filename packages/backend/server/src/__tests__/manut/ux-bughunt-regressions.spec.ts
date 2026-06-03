import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import test from 'ava';

const repoRoot = resolve(import.meta.dirname, '../../../../../../');

function readSource(path: string) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

test('workspace invites > pending email role accepted through invite link returns before link review path', t => {
  const source = readSource(
    'packages/backend/server/src/core/workspaces/resolvers/member.ts'
  );

  t.regex(
    source,
    /if \(role\.status === WorkspaceMemberStatus\.Pending\) \{\s*await this\.acceptInvitationByEmail\(role\);\s*return true;\s*\}/,
    'acceptInviteById should not fall through to acceptInvitationByLink after accepting a pending email invite'
  );
});

test('google oauth resolver > friendly domain errors use UserFriendlyError subclasses', t => {
  const source = readSource(
    'packages/backend/server/src/plugins/google-oauth/google-oauth.resolver.ts'
  );

  t.regex(
    source,
    /import \{[^}]*BadRequest[^}]*\} from '..\/..\/base'/s,
    'resolver should import a UserFriendlyError subclass for client-visible OAuth failures'
  );
  t.false(
    /throw new Error\(\s*['"`]Google account is not connected/.test(source),
    'not-connected OAuth errors should not be rethrown as plain Error'
  );
  t.false(
    /throw new Error\(\s*['"`]Google OAuth client is not configured/.test(
      source
    ),
    'not-configured OAuth errors should not be rethrown as plain Error'
  );
  t.false(
    /throw new Error\(\s*['"`]Could not refresh Google access/.test(source),
    'refresh OAuth errors should not be rethrown as plain Error'
  );
});

test('copilot object stream > uses the same AI budget gate and spend record as text stream', t => {
  const source = readSource(
    'packages/backend/server/src/plugins/copilot/controller.ts'
  );
  const objectStream = source.slice(
    source.indexOf('async chatStreamObject('),
    source.indexOf("  @Sse('/chat/:sessionId/workflow')")
  );

  t.regex(
    objectStream,
    /const workspaceId = session\.config\.workspaceId;/,
    'object stream should capture the workspace id before streaming starts'
  );
  t.regex(
    objectStream,
    /const estimatedCents = this\.estimateChatCostCents\(model, finalMessage\);/,
    'object stream should estimate input-side cost before streaming starts'
  );
  t.regex(
    objectStream,
    /await this\.aiBudget\.assertWithinCap\(workspaceId, estimatedCents\);/,
    'object stream should preflight the workspace AI budget before calling the provider'
  );
  t.regex(
    objectStream,
    /this\.aiBudget\s*\.\s*recordSpend\(workspaceId, realisedCents\)/,
    'object stream should record realised spend after a completed non-aborted stream'
  );
});
