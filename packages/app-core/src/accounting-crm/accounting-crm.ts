import { createCrmWorkspaceList } from "../crm/create-crm-workspace-list";

const api = createCrmWorkspaceList({
  apiBasePath: "/accounting-crm",
  queryRoot: ["accounting-crm", "list"],
});

export const ACCOUNTING_CRM_QUERY_ROOT = api.QUERY_ROOT;
export const accountingCrmProjectSchema = api.projectSchema;
export const accountingCrmListParamsSchema = api.listParamsSchema;
export const accountingCrmProjectsQueryKey = api.queryKey;
export const listAccountingCrmProjects = api.list;

export type {
  CrmWorkspaceListParams as AccountingCrmListParams,
  CrmWorkspaceProject as AccountingCrmProject,
} from "../crm/create-crm-workspace-list";
export type AccountingCrmList = Awaited<
  ReturnType<typeof listAccountingCrmProjects>
>;
