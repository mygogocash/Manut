"use client";

import { ProjectsView } from "@/components/projects/projects-view";

export default function HrCrmPage() {
  return (
    <ProjectsView
      team="hr"
      title="HR CRM"
      subtitle="Every project owned by the HR team"
      // Team-scoped create perm — the route also accepts the broader
      // `projects:create`, so admins keep working. PermissionButton
      // resolves via hasAnyPermission, so a user holding any matching
      // code sees the "+ New Project" button.
      createPermission="hr-crm:create"
    />
  );
}
