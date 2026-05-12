/**
 * Temporary local GraphQL operations for the Superflow Reminders v0 page.
 *
 * Mirrors the codegen operation-object shape (`{ id, op, query }`) so the
 * page can ship alongside the backend resolver before `@affine/graphql`
 * has been regenerated.
 *
 * Resolver: `packages/backend/server/src/plugins/superflow/superflow-reminder.resolver.ts`.
 */

export const sfRemindersQuery = {
  id: 'sfRemindersQuery' as const,
  op: 'sfReminders',
  query: `query sfReminders($workspaceId: String!) {
  sfReminders(workspaceId: $workspaceId) {
    id
    workspaceId
    userId
    title
    body
    fireAt
    channel
    status
    relatedEntityType
    relatedEntityId
    ruleId
    completedAt
    createdAt
    updatedAt
  }
}`,
};

export const createSfReminderMutation = {
  id: 'createSfReminderMutation' as const,
  op: 'createSfReminder',
  query: `mutation createSfReminder($workspaceId: String!, $input: CreateSfReminderInput!) {
  createSfReminder(workspaceId: $workspaceId, input: $input) {
    id
    workspaceId
    userId
    title
    body
    fireAt
    channel
    status
    relatedEntityType
    relatedEntityId
    ruleId
    completedAt
    createdAt
    updatedAt
  }
}`,
};

export const cancelSfReminderMutation = {
  id: 'cancelSfReminderMutation' as const,
  op: 'cancelSfReminder',
  query: `mutation cancelSfReminder($reminderId: ID!) {
  cancelSfReminder(reminderId: $reminderId) {
    id
    status
    completedAt
    updatedAt
  }
}`,
};
