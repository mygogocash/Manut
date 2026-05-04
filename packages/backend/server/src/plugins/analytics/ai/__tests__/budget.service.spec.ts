import { NotificationType, PrismaClient } from '@prisma/client';
import test from 'ava';

import { createModule } from '../../../../__tests__/create-module';
import { Mockers } from '../../../../__tests__/mocks';
import { NotificationModule } from '../../../../core/notification';
import { WorkspaceRole } from '../../../../models';
import { BudgetService } from '../budget.service';

const module = await createModule({
  imports: [NotificationModule],
  providers: [BudgetService],
});

const budgetService = module.get(BudgetService);
const db = module.get(PrismaClient);

test.afterEach.always(async () => {
  await db.notification.deleteMany({
    where: { type: NotificationType.BudgetSoftCap },
  });
  await db.socialAiBudget.deleteMany({});
});

test.after.always(async () => {
  await module.close();
});

test('record() crossing the soft cap threshold creates an in-app notification for the workspace owner exactly once', async t => {
  const owner = await module.create(Mockers.User);
  const workspace = await module.create(Mockers.Workspace);
  await module.create(Mockers.WorkspaceUser, {
    workspaceId: workspace.id,
    userId: owner.id,
    type: WorkspaceRole.Owner,
  });

  // First record stays under the soft cap (80% of $100 = $80) — no
  // notification should be emitted yet.
  await budgetService.record(workspace.id, 50);
  let notifications = await db.notification.findMany({
    where: { userId: owner.id, type: NotificationType.BudgetSoftCap },
  });
  t.is(notifications.length, 0, 'no notification before crossing the soft cap');

  // Second record pushes the total to $90 — crossing the $80 soft cap.
  // Exactly one notification should land in the owner's feed and the
  // budget row should flip alertSent.
  await budgetService.record(workspace.id, 40);
  notifications = await db.notification.findMany({
    where: { userId: owner.id, type: NotificationType.BudgetSoftCap },
  });
  t.is(notifications.length, 1, 'one notification after crossing the soft cap');
  const body = notifications[0].body as {
    workspaceId: string;
    spentUsd: number;
    capUsd: number;
    monthYear: string;
  };
  t.is(body.workspaceId, workspace.id);
  t.is(body.spentUsd, 90);
  t.is(body.capUsd, 100);
  t.regex(body.monthYear, /^\d{4}-\d{2}$/);

  const budgetRow = await db.socialAiBudget.findUniqueOrThrow({
    where: {
      workspaceId_monthYear: {
        workspaceId: workspace.id,
        monthYear: body.monthYear,
      },
    },
  });
  t.true(budgetRow.alertSent, 'alertSent flipped after the alert is delivered');

  // A third record that stays above the cap must NOT emit a second
  // notification (idempotency guard via alertSent).
  await budgetService.record(workspace.id, 5);
  notifications = await db.notification.findMany({
    where: { userId: owner.id, type: NotificationType.BudgetSoftCap },
  });
  t.is(
    notifications.length,
    1,
    'subsequent records over the cap do not re-notify'
  );
});

test('record() does not throw when the workspace has no Accepted Owner', async t => {
  const workspace = await module.create(Mockers.Workspace);

  // Owner row exists but is not in Accepted status — fireSoftCapAlert
  // should swallow this gracefully and only emit the audit log line.
  const pendingOwner = await module.create(Mockers.User);
  await module.create(Mockers.WorkspaceUser, {
    workspaceId: workspace.id,
    userId: pendingOwner.id,
    type: WorkspaceRole.Owner,
    status: 'Pending',
  });

  await t.notThrowsAsync(
    () => budgetService.record(workspace.id, 90),
    'crossing the soft cap with no accepted owner should not throw'
  );

  const notifications = await db.notification.findMany({
    where: { type: NotificationType.BudgetSoftCap },
  });
  t.is(
    notifications.length,
    0,
    'no notification is created when no accepted owner is found'
  );
});
