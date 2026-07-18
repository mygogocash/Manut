import { createCrmWorkspaceList } from "../crm/create-crm-workspace-list";

const api = createCrmWorkspaceList({
  apiBasePath: "/product-crm",
  queryRoot: ["product-crm", "list"],
});

export const PRODUCT_CRM_QUERY_ROOT = api.QUERY_ROOT;
export const productCrmProjectSchema = api.projectSchema;
export const productCrmListParamsSchema = api.listParamsSchema;
export const productCrmProjectsQueryKey = api.queryKey;
export const listProductCrmProjects = api.list;

export type {
  CrmWorkspaceListParams as ProductCrmListParams,
  CrmWorkspaceProject as ProductCrmProject,
} from "../crm/create-crm-workspace-list";
export type ProductCrmList = Awaited<ReturnType<typeof listProductCrmProjects>>;
