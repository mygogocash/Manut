import { createCrmWorkspaceList } from "../crm/create-crm-workspace-list";

const api = createCrmWorkspaceList({
  apiBasePath: "/qa-crm",
  queryRoot: ["qa-crm", "list"],
});

export const QA_CRM_QUERY_ROOT = api.QUERY_ROOT;
export const qaCrmProjectSchema = api.projectSchema;
export const qaCrmListParamsSchema = api.listParamsSchema;
export const qaCrmProjectsQueryKey = api.queryKey;
export const listQaCrmProjects = api.list;

export type {
  CrmWorkspaceListParams as QaCrmListParams,
  CrmWorkspaceProject as QaCrmProject,
} from "../crm/create-crm-workspace-list";
export type QaCrmList = Awaited<ReturnType<typeof listQaCrmProjects>>;
