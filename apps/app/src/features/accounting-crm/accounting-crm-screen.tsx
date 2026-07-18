import {
  accountingCrmProjectsQueryKey,
  listAccountingCrmProjects,
} from "@manut/app-core";

import { CrmWorkspaceListScreen } from "@/features/crm/crm-workspace-list-screen";

const ACCOUNTING_CRM_READ_PERMS = [
  "accounting-crm:read",
  "accounting-crm:read-all",
  "projects:read",
  "projects:read-all",
] as const;

export function AccountingCrmScreen() {
  return (
    <CrmWorkspaceListScreen
      title="Accounting CRM"
      subtitle="Read-only accounting workspace list. Board, tasks, and details remain later."
      permissionCodes={ACCOUNTING_CRM_READ_PERMS}
      queryKey={accountingCrmProjectsQueryKey({ page: 1, limit: 20 })}
      list={listAccountingCrmProjects}
    />
  );
}
