import {
  itCrmProjectsQueryKey,
  listItCrmProjects,
} from "@manut/app-core";

import { CrmWorkspaceListScreen } from "@/features/crm/crm-workspace-list-screen";

const IT_CRM_READ_PERMS = [
  "it-crm:read",
  "it-crm:read-all",
  "projects:read",
  "projects:read-all",
] as const;

export function ItCrmScreen() {
  return (
    <CrmWorkspaceListScreen
      title="IT CRM"
      subtitle="Read-only IT workspace list. Board, tasks, archive, and dashboard remain later."
      permissionCodes={IT_CRM_READ_PERMS}
      queryKey={itCrmProjectsQueryKey({ page: 1, limit: 20 })}
      list={listItCrmProjects}
    />
  );
}
