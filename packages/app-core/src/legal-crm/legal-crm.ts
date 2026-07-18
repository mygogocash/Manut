import { createCrmWorkspaceList } from "../crm/create-crm-workspace-list";

const api = createCrmWorkspaceList({
  apiBasePath: "/legal-crm",
  queryRoot: ["legal-crm", "list"],
});

export const LEGAL_CRM_QUERY_ROOT = api.QUERY_ROOT;
export const legalCrmProjectSchema = api.projectSchema;
export const legalCrmListParamsSchema = api.listParamsSchema;
export const legalCrmProjectsQueryKey = api.queryKey;
export const listLegalCrmProjects = api.list;

export type {
  CrmWorkspaceListParams as LegalCrmListParams,
  CrmWorkspaceProject as LegalCrmProject,
} from "../crm/create-crm-workspace-list";
export type LegalCrmList = Awaited<ReturnType<typeof listLegalCrmProjects>>;
