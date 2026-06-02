/**
 * @vitest-environment happy-dom
 */

import type { Member } from '@affine/core/modules/permissions';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const WorkspaceMembersServiceToken = vi.hoisted(
  () => class WorkspaceMembersService {}
);
const WorkspacePermissionServiceToken = vi.hoisted(
  () => class WorkspacePermissionService {}
);
const services = vi.hoisted(() => ({
  resendInvite: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock('@affine/graphql', () => ({
  Permission: {
    Admin: 'Admin',
    Collaborator: 'Collaborator',
    Owner: 'Owner',
  },
  WorkspaceMemberStatus: {
    Accepted: 'Accepted',
    NeedMoreSeat: 'NeedMoreSeat',
    NeedMoreSeatAndReview: 'NeedMoreSeatAndReview',
    Pending: 'Pending',
    UnderReview: 'UnderReview',
  },
}));

vi.mock('@affine/core/modules/permissions', () => ({
  WorkspaceMembersService: WorkspaceMembersServiceToken,
  WorkspacePermissionService: WorkspacePermissionServiceToken,
}));

vi.mock('@affine/component', () => ({
  MenuItem: ({
    children,
    disabled,
    onSelect,
  }: {
    children: ReactNode;
    disabled?: boolean;
    onSelect?: () => void;
  }) => (
    <button disabled={disabled} onClick={onSelect} role="menuitem">
      {children}
    </button>
  ),
  notify: {
    error: vi.fn(),
    success: vi.fn(),
  },
  useConfirmModal: () => ({
    openConfirmModal: vi.fn(),
  }),
}));

vi.mock('@affine/i18n', () => ({
  useI18n: () =>
    new Proxy(
      {},
      {
        get: (_, key: string) => {
          const translations: Record<string, string> = {
            'com.affine.payment.member.team.resend': 'Resend',
            'com.affine.payment.member.team.resend.notify.message':
              'Invite resent',
            'com.affine.payment.member.team.resend.notify.title': 'Sent',
            'com.affine.payment.member.team.revoke': 'Revoke',
          };

          return () => translations[key] ?? key;
        },
      }
    ),
}));

vi.mock('@toeverything/infra', () => ({
  useLiveData: () => true,
  useService: (token: unknown) => {
    if (token === WorkspaceMembersServiceToken) {
      return {
        members: {
          revalidate: services.revalidate,
        },
        resendInvite: services.resendInvite,
      };
    }

    if (token === WorkspacePermissionServiceToken) {
      return {
        permission: {
          ['isTeam$']: {},
        },
      };
    }

    return {};
  },
}));

import { Permission, WorkspaceMemberStatus } from '@affine/graphql';

import { MemberOptions } from '../member-option';

describe('MemberOptions', () => {
  beforeEach(() => {
    services.resendInvite.mockReset();
    services.revalidate.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test('MemberOptions > given pending invite resend is in flight > then ignores duplicate activation', async () => {
    let resolveResend: (value: boolean) => void = () => {};
    services.resendInvite.mockReturnValue(
      new Promise(resolve => {
        resolveResend = resolve;
      })
    );

    render(
      <MemberOptions
        goToTeamBilling={vi.fn()}
        isAdmin={true}
        isOwner={false}
        member={
          {
            email: 'pending@example.com',
            id: 'member-1',
            inviteId: 'invite-1',
            name: 'Pending Member',
            permission: Permission.Collaborator,
            status: WorkspaceMemberStatus.Pending,
          } as Member
        }
        openAssignModal={vi.fn()}
      />
    );

    const resend = screen.getByRole('menuitem', { name: 'Resend' });

    fireEvent.click(resend);
    fireEvent.click(resend);

    expect(services.resendInvite).toHaveBeenCalledTimes(1);
    expect(services.resendInvite).toHaveBeenCalledWith('invite-1');

    resolveResend(true);

    await waitFor(() => {
      expect((resend as HTMLButtonElement).disabled).toBe(false);
    });
  });
});
