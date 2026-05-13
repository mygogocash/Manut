/**
 * Temporary local GraphQL operations for the Superflow Reminders v0 page.
 *
 * Mirrors the codegen operation-object shape (`{ id, op, query }`) so the
 * page can ship alongside the backend resolver before `@affine/graphql`
 * has been regenerated.
 *
 * Resolver: `packages/backend/server/src/plugins/superflow/superflow-reminder.resolver.ts`.
 */

export const mnRemindersQuery = {
  id: 'mnRemindersQuery' as const,
  op: 'mnReminders',
  query: `query mnReminders($workspaceId: String!) {
  mnReminders(workspaceId: $workspaceId) {
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

export const createMnReminderMutation = {
  id: 'createMnReminderMutation' as const,
  op: 'createMnReminder',
  query: `mutation createMnReminder($workspaceId: String!, $input: CreateMnReminderInput!) {
  createMnReminder(workspaceId: $workspaceId, input: $input) {
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

export const cancelMnReminderMutation = {
  id: 'cancelMnReminderMutation' as const,
  op: 'cancelMnReminder',
  query: `mutation cancelMnReminder($reminderId: ID!) {
  cancelMnReminder(reminderId: $reminderId) {
    id
    status
    completedAt
    updatedAt
  }
}`,
};
