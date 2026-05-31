import { WorkspaceMemberSource, WorkspaceMemberStatus } from '@prisma/client';
import test from 'ava';

import { InvalidInvitation } from '../../../base';
import { WorkspaceRole } from '../../../models';
import { getResendInvitePayload } from './member-resend';

test('workspace invitation resend > given pending email invite > then returns invitation event payload', t => {
  const payload = getResendInvitePayload(
    {
      id: 'invite-1',
      inviterId: 'original-inviter',
      source: WorkspaceMemberSource.Email,
      status: WorkspaceMemberStatus.Pending,
      type: WorkspaceRole.Collaborator,
      userId: 'invitee',
      workspaceId: 'workspace-1',
    } as any,
    'workspace-1',
    'owner-1'
  );

  t.deepEqual(payload, {
    inviteId: 'invite-1',
    inviterId: 'original-inviter',
  });
});

test('workspace invitation resend > given missing inviter > then falls back to actor', t => {
  const payload = getResendInvitePayload(
    {
      id: 'invite-1',
      inviterId: null,
      source: WorkspaceMemberSource.Email,
      status: WorkspaceMemberStatus.Pending,
      type: WorkspaceRole.Collaborator,
      userId: 'invitee',
      workspaceId: 'workspace-1',
    } as any,
    'workspace-1',
    'owner-1'
  );

  t.deepEqual(payload, {
    inviteId: 'invite-1',
    inviterId: 'owner-1',
  });
});

test('workspace invitation resend > given accepted email invite > then rejects', t => {
  t.throws(
    () =>
      getResendInvitePayload(
        {
          id: 'invite-1',
          inviterId: 'original-inviter',
          source: WorkspaceMemberSource.Email,
          status: WorkspaceMemberStatus.Accepted,
          type: WorkspaceRole.Collaborator,
          userId: 'invitee',
          workspaceId: 'workspace-1',
        } as any,
        'workspace-1',
        'owner-1'
      ),
    {
      instanceOf: InvalidInvitation,
    }
  );
});
