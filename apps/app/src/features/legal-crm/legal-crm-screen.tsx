import {
  legalCrmProjectsQueryKey,
  listLegalCrmProjects,
} from "@manut/app-core";

import { CrmWorkspaceListScreen } from "@/features/crm/crm-workspace-list-screen";

const LEGAL_CRM_READ_PERMS = [
  "legal-crm:read",
  "legal-crm:read-all",
  "projects:read",
  "projects:read-all",
] as const;

export function LegalCrmScreen() {
  return (
    <CrmWorkspaceListScreen
      title="Legal CRM"
      subtitle="Read-only legal workspace list. Board, tasks, and details remain later."
      permissionCodes={LEGAL_CRM_READ_PERMS}
      queryKey={legalCrmProjectsQueryKey({ page: 1, limit: 20 })}
      list={listLegalCrmProjects}
    />
  );
}
