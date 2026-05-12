/**
 * Local Superflow Reminders DTOs.
 *
 * Mirrors `SfReminderObjectType` from the backend
 * (`packages/backend/server/src/plugins/superflow/superflow-reminder.dto.ts`)
 * so the Reminders v0 page can ship before `@affine/graphql` regenerates
 * an upstream-aware codegen result.
 */

export type SfReminderStatus =
  | 'SCHEDULED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED';

export type SfNotificationChannel = 'EMAIL';

export interface SfReminderDto {
  id: string;
  workspaceId: string;
  userId: string;
  title: string;
  body: string | null;
  fireAt: string;
  channel: SfNotificationChannel;
  status: SfReminderStatus;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  ruleId: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSfReminderInput {
  title: string;
  body?: string | null;
  fireAt: string;
  channel?: SfNotificationChannel;
}
