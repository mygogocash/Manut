import { createCrmWorkspaceList } from "../crm/create-crm-workspace-list";

const api = createCrmWorkspaceList({
  apiBasePath: "/it-crm",
  queryRoot: ["it-crm", "list"],
});

export const IT_CRM_QUERY_ROOT = api.QUERY_ROOT;
export const itCrmProjectSchema = api.projectSchema;
export const itCrmListParamsSchema = api.listParamsSchema;
export const itCrmProjectsQueryKey = api.queryKey;
export const listItCrmProjects = api.list;

export type {
  CrmWorkspaceListParams as ItCrmListParams,
  CrmWorkspaceProject as ItCrmProject,
} from "../crm/create-crm-workspace-list";
export type ItCrmList = Awaited<ReturnType<typeof listItCrmProjects>>;
