/**
 * Agents GraphQL operations.
 *
 * Defined as raw query strings rather than importing from @affine/graphql
 * because those are codegen'd from the backend schema and the Agents schema
 * lands in the same change as this module — codegen hasn't run yet. Once the
 * backend deploy lands and codegen regenerates, these can be swapped for
 * generated typed helpers without changing AgentService callers.
 */

const AGENT_FIELDS = `
  id
  workspaceId
  ownerId
  parentAgentId
  name
  description
  instructions
  skills
  links { url label }
  files
  createdAt
  updatedAt
`;

interface RawQuery {
  query: string;
  id?: string;
  operationName?: string;
}

const make = (operationName: string, body: string): RawQuery => ({
  query: body,
  operationName,
});

export const listAgentsQuery = make(
  'listAgents',
  `query listAgents($workspaceId: String!, $parentAgentId: String) {
    agents(workspaceId: $workspaceId, parentAgentId: $parentAgentId) { ${AGENT_FIELDS} }
  }`
);

export const getAgentQuery = make(
  'getAgent',
  `query getAgent($id: String!) {
    agent(id: $id) { ${AGENT_FIELDS} }
  }`
);

export const createAgentMutation = make(
  'createAgent',
  `mutation createAgent($input: CreateAgentInput!) {
    createAgent(input: $input) { ${AGENT_FIELDS} }
  }`
);

export const updateAgentMutation = make(
  'updateAgent',
  `mutation updateAgent($id: String!, $input: UpdateAgentInput!) {
    updateAgent(id: $id, input: $input) { ${AGENT_FIELDS} }
  }`
);

export const deleteAgentMutation = make(
  'deleteAgent',
  `mutation deleteAgent($id: String!) { deleteAgent(id: $id) }`
);

export const addAgentSkillMutation = make(
  'addAgentSkill',
  `mutation addAgentSkill($id: String!, $skill: String!) {
    addAgentSkill(id: $id, skill: $skill) { ${AGENT_FIELDS} }
  }`
);

export const removeAgentSkillMutation = make(
  'removeAgentSkill',
  `mutation removeAgentSkill($id: String!, $skill: String!) {
    removeAgentSkill(id: $id, skill: $skill) { ${AGENT_FIELDS} }
  }`
);

export const addAgentLinkMutation = make(
  'addAgentLink',
  `mutation addAgentLink($id: String!, $url: String!, $label: String) {
    addAgentLink(id: $id, url: $url, label: $label) { ${AGENT_FIELDS} }
  }`
);

export const removeAgentLinkMutation = make(
  'removeAgentLink',
  `mutation removeAgentLink($id: String!, $url: String!) {
    removeAgentLink(id: $id, url: $url) { ${AGENT_FIELDS} }
  }`
);

export const addAgentFileMutation = make(
  'addAgentFile',
  `mutation addAgentFile($id: String!, $fileId: String!) {
    addAgentFile(id: $id, fileId: $fileId) { ${AGENT_FIELDS} }
  }`
);

export const removeAgentFileMutation = make(
  'removeAgentFile',
  `mutation removeAgentFile($id: String!, $fileId: String!) {
    removeAgentFile(id: $id, fileId: $fileId) { ${AGENT_FIELDS} }
  }`
);
