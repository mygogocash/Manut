/**
 * Local Superflow Reminders DTOs.
 *
 * Mirrors `MnReminderObjectType` from the backend
 * (`packages/backend/server/src/plugins/superflow/superflow-reminder.dto.ts`)
 * so the Reminders v0 page can ship before `@affine/graphql` regenerates
 * an upstream-aware codegen result.
 */

export type MnReminderStatus =
  | 'SCHEDULED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED';

export type MnNotificationChannel = 'EMAIL';

export interface MnReminderDto {
  id: string;
  workspaceId: string;
  userId: string;
  title: string;
  body: string | null;
  fireAt: string;
  channel: MnNotificationChannel;
  status: MnReminderStatus;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  ruleId: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMnReminderInput {
  title: string;
  body?: string | null;
  fireAt: string;
  channel?: MnNotificationChannel;
}
