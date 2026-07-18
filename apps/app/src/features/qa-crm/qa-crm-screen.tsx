import { listQaCrmProjects, qaCrmProjectsQueryKey } from "@manut/app-core";

import { CrmWorkspaceListScreen } from "@/features/crm/crm-workspace-list-screen";

const QA_CRM_READ_PERMS = ["qa-crm:read", "qa-crm:read-all"] as const;

export function QaCrmScreen() {
  return (
    <CrmWorkspaceListScreen
      title="QA CRM"
      subtitle="Read-only QA workspace list. Issue board, task detail, and import remain later."
      permissionCodes={QA_CRM_READ_PERMS}
      queryKey={qaCrmProjectsQueryKey({ page: 1, limit: 20 })}
      list={listQaCrmProjects}
    />
  );
}
