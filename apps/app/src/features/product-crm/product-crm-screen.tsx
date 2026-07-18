import {
  listProductCrmProjects,
  productCrmProjectsQueryKey,
} from "@manut/app-core";

import { CrmWorkspaceListScreen } from "@/features/crm/crm-workspace-list-screen";

const PRODUCT_CRM_READ_PERMS = [
  "product-crm:read",
  "product-crm:read-all",
  "projects:read",
  "projects:read-all",
] as const;

export function ProductCrmScreen() {
  return (
    <CrmWorkspaceListScreen
      title="Product CRM"
      subtitle="Read-only product workspace list. Board, tasks, and import remain later."
      permissionCodes={PRODUCT_CRM_READ_PERMS}
      queryKey={productCrmProjectsQueryKey({ page: 1, limit: 20 })}
      list={listProductCrmProjects}
    />
  );
}
