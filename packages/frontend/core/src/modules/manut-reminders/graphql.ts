/**
 * Temporary local GraphQL operations for the Superflow Reminders page.
 *
 * Mirrors the codegen operation-object shape (`{ id, op, query }`) so the
 * page can ship alongside the backend resolver before `@affine/graphql`
 * has been regenerated.
 *
 * Resolver: `packages/backend/server/src/plugins/manut/manut-reminder.resolver.ts`.
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

/**
 * The rule resolvers are reserved on the backend (the Prisma model
 * `MnReminderRule` plus the cron + job pipeline already exist) — these
 * operations target the names we expect once the resolver lands. While
 * the resolver is unimplemented the queries surface a clean error to
 * the existing ErrorState, the same way the rest of this module behaves
 * before codegen catches up.
 */

const RULE_FIELDS = `
    id
    workspaceId
    name
    enabled
    trigger
    cronExpression
    timezone
    config
    lastEvaluatedAt
    nextRunAt
    createdByUserId
    createdAt
    updatedAt`;

export const mnReminderRulesQuery = {
  id: 'mnReminderRulesQuery' as const,
  op: 'mnReminderRules',
  query: `query mnReminderRules($workspaceId: String!) {
  mnReminderRules(workspaceId: $workspaceId) {${RULE_FIELDS}
  }
}`,
};

export const createMnReminderRuleMutation = {
  id: 'createMnReminderRuleMutation' as const,
  op: 'createMnReminderRule',
  query: `mutation createMnReminderRule($workspaceId: String!, $input: CreateMnReminderRuleInput!) {
  createMnReminderRule(workspaceId: $workspaceId, input: $input) {${RULE_FIELDS}
  }
}`,
};

export const updateMnReminderRuleMutation = {
  id: 'updateMnReminderRuleMutation' as const,
  op: 'updateMnReminderRule',
  query: `mutation updateMnReminderRule($ruleId: ID!, $input: UpdateMnReminderRuleInput!) {
  updateMnReminderRule(ruleId: $ruleId, input: $input) {${RULE_FIELDS}
  }
}`,
};

export const deleteMnReminderRuleMutation = {
  id: 'deleteMnReminderRuleMutation' as const,
  op: 'deleteMnReminderRule',
  query: `mutation deleteMnReminderRule($ruleId: ID!) {
  deleteMnReminderRule(ruleId: $ruleId)
}`,
};
