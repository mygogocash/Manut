import {
  WorkspaceMemberSource,
  WorkspaceMemberStatus,
  type WorkspaceUserRole,
} from '@prisma/client';

import { InvalidInvitation } from '../../../base';

export function getResendInvitePayload(
  role: WorkspaceUserRole | null,
  workspaceId: string,
  actorId: string
) {
  if (
    !role ||
    role.workspaceId !== workspaceId ||
    role.status !== WorkspaceMemberStatus.Pending ||
    role.source !== WorkspaceMemberSource.Email
  ) {
    throw new InvalidInvitation();
  }

  return {
    inviteId: role.id,
    inviterId: role.inviterId ?? actorId,
  };
}
